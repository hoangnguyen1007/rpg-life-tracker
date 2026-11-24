import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9229;
const userDataDir = path.join(process.env.TEMP || '.', `sl-cdp-profile-${Date.now()}`);
const outDir = path.join(process.env.TEMP || '.', 'sl-verify-shots');

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,960',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl(): Promise<string> {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
      const list = (await res.json()) as Array<{ type: string; webSocketDebuggerUrl?: string }>;
      const page = list.find((t) => t.type === 'page');
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      // retry
    }
    await sleep(250);
  }
  throw new Error('Chrome CDP failed to start');
}

async function main() {
  try {
    const wsUrl = await getWsUrl();
    const ws = new WebSocket(wsUrl);
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve();
      ws.onerror = (e) => reject(e);
    });

    let nextId = 1;
    const pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
    const errors: string[] = [];

    ws.onmessage = (ev) => {
      const msg = JSON.parse(String(ev.data));
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id)!;
        pending.delete(msg.id);
        if (msg.error) p.reject(new Error(msg.error.message));
        else p.resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push(`EXCEPTION: ${JSON.stringify(msg.params?.exceptionDetails?.text)}`);
      } else if (
        msg.method === 'Console.messageAdded' &&
        msg.params?.message?.level === 'error'
      ) {
        errors.push(`CONSOLE ERROR: ${msg.params.message.text}`);
      }
    };

    const send = (method: string, params: Record<string, unknown> = {}) =>
      new Promise<any>((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Console.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 960,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // Onboard temporarily so screenshots inspect live main game screen
    await fetch('http://localhost:3001/api/player/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOnboarded: true }),
    });

    await send('Page.navigate', { url: 'http://localhost:3001' });
    await sleep(1800);

    const checkLayout = async (label: string) => {
      const evalRes = await send('Runtime.evaluate', {
        returnByValue: true,
        expression: `JSON.stringify({
          title: document.title,
          scrollW: document.documentElement.scrollWidth,
          innerW: window.innerWidth,
          overflowX: document.documentElement.scrollWidth > window.innerWidth,
          hearts: document.querySelectorAll('[aria-label*="HP"] svg').length,
          textLen: document.body.innerText.length
        })`,
      });
      const parsed = JSON.parse(evalRes.result.value);
      console.log(label, parsed);
      if (parsed.overflowX) {
        throw new Error(`Horizontal overflow detected on ${label}: scrollW=${parsed.scrollW} > innerW=${parsed.innerW}`);
      }
      return parsed;
    };

    fs.mkdirSync(outDir, { recursive: true });

    const r1 = await checkLayout('TAB 1 (Hầm Ngục 2D)');
    if (r1.hearts < 5) throw new Error(`Expected >= 5 Pixel Hearts in top-left HUD, got ${r1.hearts}`);
    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'tab1-dungeon.png'), Buffer.from(shot1.data, 'base64'));

    // Click Strike button in live UI to test live React state & VFX!
    await send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Chém Kiếm'))?.click()`,
    });
    await sleep(700);
    const shot1b = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, 'tab1-combat.png'), Buffer.from(shot1b.data, 'base64'));

    const tabLabels = [
      'Cây Kĩ Năng',
      'Nhiệm Vụ & Lịch',
      'Cửa Hàng & Bóng Tối',
      'Anh Hùng & Mục Tiêu',
    ];
    for (let i = 0; i < tabLabels.length; i++) {
      const lbl = tabLabels[i];
      await send('Runtime.evaluate', {
        expression: `Array.from(document.querySelectorAll('nav button')).find(b => b.innerText.includes(${JSON.stringify(lbl)}))?.click()`,
      });
      await sleep(550);
      await checkLayout(`TAB ${i + 2} (${lbl})`);
      if (i === 0) {
        const shot2 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync(path.join(outDir, 'tab2-skilltree.png'), Buffer.from(shot2.data, 'base64'));
      }
    }

    // Mobile 390px responsiveness check
    await send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true,
    });
    await send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('nav button')).find(b => b.innerText.includes('Hầm Ngục 2D'))?.click()`,
    });
    await sleep(550);
    await checkLayout('MOBILE 390px (Hầm Ngục 2D)');

    await send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('nav button')).find(b => b.innerText.includes('Cây Kĩ Năng'))?.click()`,
    });
    await sleep(550);
    await checkLayout('MOBILE 390px (Cây Kĩ Năng)');

    console.log('CONSOLE/PAGE ERRORS:', errors.length, errors);
    console.log('SCREENSHOTS_DIR:', outDir);
    ws.close();
    if (errors.length > 0) process.exit(1);
  } finally {
    chrome.kill();
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error('UI SMOKE FAILED:', err);
  process.exit(1);
});
