# RPG Life Tracker — Tauri v2 Native Windows Build Guide (VS-Free Portable MSVC)

This `src-tauri/` project wraps **RPG Life Tracker** in a native Tauri v2 Windows shell featuring:

- **Two Native Windows**:
  - `main` (`1360×860`, centered): Full RPG Dashboard. Closing hides silently to the System Tray instead of quitting.
  - `hud` (`388×164`, frameless, transparent, always-on-top, skip-taskbar, route `index.html#/hud`): 16-bit 2D Pixel Discipline HUD docked bottom-right above the taskbar with bottom-anchored `resize_hud` (`mini` `276×72`, `normal` `388×164`, `expanded` `388×216`).
- **Native System Tray**:
  - Left-click opens the Dashboard; right-click opens: `Mở Dashboard`, `Bật/Tắt Mini HUD`, `Tạm im 1 giờ (DND)`, `Kết nối Điện thoại (QR)`, `Thoát hoàn toàn`.
- **Global Hotkeys** (`tauri-plugin-global-shortcut`):
  - `Ctrl + Shift + Space` — Toggle Floating Mini HUD visibility.
  - `Ctrl + Shift + Alt + H` — Show & focus Main Dashboard.
- **Silent Windows Autostart** (`tauri-plugin-autostart`):
  - Registers with `--autostart` so Windows login starts silently into System Tray + Floating Mini HUD (zero flashing dashboard window).
- **Zero-Zombie Backend Supervisor (`src/backend_manager.rs`)**:
  - Checks `http://127.0.0.1:3001/api/health`; if not running, spawns `npx.cmd tsx server/index.ts` silently (`CREATE_NO_WINDOW`) and binds it to a Windows Job Object (`JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`) so quitting or crashing Tauri always cleans up the Node process tree.
- **Pure-Rust Win32 Activity Tracker (`src/win_tracker.rs`)**:
  - Polls active foreground window, UWP (`ApplicationFrameHost`) inner app, and idle time every 5 seconds via `windows-sys`, pushing JSON samples (`source: "tauri-rust"`) to `POST /api/assistant/activity/ingest` (automatically pausing Node's PowerShell fallback).

---

## 1. Recommended Setup: Zero Visual Studio, Zero Admin UAC (~1.9 GB total vs 6–8 GB VS)

This PC already has **Rust (`--profile minimal`)** and **Portable MSVC + Windows 11 SDK** installed in user space without Visual Studio Build Tools:

- **Rust Toolchain**: `%USERPROFILE%\.cargo\bin` (`stable-x86_64-pc-windows-msvc`, minimal profile — skips `rust-docs`).
- **Portable MSVC + Windows 11 SDK**: `D:\tools\msvc` (~1.27 GB unpacked, includes `link.exe`, `cl.exe`, `lib.exe`, `rc.exe`, UCRT, and Win11 SDK libs).
- **Build Helper**: [`scripts/build-tauri-light.ps1`](../scripts/build-tauri-light.ps1) automatically sets `PATH`, `INCLUDE`, `LIB`, `RC`, `RC_x86_64_pc_windows_msvc`, and `CARGO_TARGET_X86_64_PC_WINDOWS_MSVC_LINKER` for every build.

### Reproducing on a Fresh Windows 11 Machine (Zero VS Installer)

1. **Install Minimal Rust (User-Space, No UAC)**:
   ```powershell
   curl.exe -fsSL https://win.rustup.rs/x86_64 -o $env:TEMP\rustup-init.exe
   $env:RUSTUP_CONCURRENT_DOWNLOADS = '1'
   & $env:TEMP\rustup-init.exe -y --default-toolchain stable --default-host x86_64-pc-windows-msvc --profile minimal
   ```
2. **Extract Portable MSVC + Windows SDK via `portable-msvc.py` (Python 3.12+, No UAC)**:
   ```powershell
   New-Item -ItemType Directory -Force D:\tools | Out-Null
   Set-Location D:\tools
   curl.exe -fsSL https://gist.githubusercontent.com/mmozeiko/7f3162ec2988e81e56d5c4e22cde9977/raw/portable-msvc.py -o portable-msvc.py
   python portable-msvc.py --accept-license --target x64 --host x64
   Remove-Item -Recurse -Force D:\tools\downloads
   ```
3. **WebView2 Runtime**: Pre-installed on Windows 11. On Windows 10, install the [Microsoft Edge WebView2 Evergreen Bootstrapper](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).

---

## 2. Building & Launching with `scripts/build-tauri-light.ps1`

From `d:\LinhTinh\SoloLeveling` in PowerShell:

```powershell
# Optimized standalone release binary (builds Vite dist/ + statically linked rpg-life-tracker.exe):
powershell -ExecutionPolicy Bypass -File scripts\build-tauri-light.ps1 -Mode release

# Build release and launch immediately:
powershell -ExecutionPolicy Bypass -File scripts\build-tauri-light.ps1 -Mode release -Launch

# Fast debug binary (skips LTO, ~15 MB):
powershell -ExecutionPolicy Bypass -File scripts\build-tauri-light.ps1 -Mode debug

# Fast compile-only check:
powershell -ExecutionPolicy Bypass -File scripts\build-tauri-light.ps1 -Mode check
```

Outputs:
- Standalone optimized `.exe`: `src-tauri\target\release\rpg-life-tracker.exe` (statically links `WebView2LoaderStatic.lib` — zero loose DLLs required!)
- Debug `.exe`: `src-tauri\target\debug\rpg-life-tracker.exe`

---

## 3. Optional Full Installer Packaging (`.exe` NSIS / `.msi`)

If you later want shareable NSIS/MSI installers via Tauri CLI v2, add `@tauri-apps/cli@^2` and these scripts to `package.json`:

```json
{
  "scripts": {
    "tauri": "tauri",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build"
  }
}
```

Then run `D:\tools\msvc\setup_x64.bat` (plus `$env:RC` pointing to `D:\tools\msvc\Windows Kits\10\bin\<sdk>\x64\rc.exe`) before `npm.cmd run tauri:build`.

*(Optional)* Regenerate all platform icons from `src-tauri/icons/icon.png`:

```powershell
cargo tauri icon src-tauri/icons/icon.png
```

---

## 4. Exposed Tauri Commands (via `window.__TAURI__.core.invoke`)

`app.withGlobalTauri` is enabled in `tauri.conf.json`, so the frontend can invoke these directly with zero extra JS bundle weight:

| Command | Arguments | Behavior |
| :--- | :--- | :--- |
| `resize_hud` | `{ mode: "mini" \| "normal" \| "expanded" }` | Resizes the 2D Pixel Discipline HUD between `276×72` (`mini`), `388×164` (`normal`), and `388×216` (`expanded`) while keeping the bottom edge anchored above the taskbar. |
| `open_main_dashboard` | *(none)* | Unminimizes, shows, and focuses the `main` dashboard window. |
| `toggle_hud_window` | *(none)* | Toggles `hud` window visibility and returns the new `boolean` state. |
| `get_tauri_env` | *(none)* | Returns `{ isTauri, platform, appVersion, autostartLaunched, backendUrl, backendManagedByTauri, nativeWinTracker }`. |

---

## 5. Quick Troubleshooting

- **Hotkey conflict (`Ctrl+Shift+Space`)**: If PowerToys or another app already claims `Ctrl+Shift+Space`, Tauri logs a non-fatal warning to stderr and continues launching normally.
- **Custom workspace path in release builds**: Set `RPG_LIFE_TRACKER_ROOT` to the directory containing `server/index.ts` if launching the standalone `.exe` from outside the repository tree.
- **Reclaiming debug build disk space**: Once `target\release\rpg-life-tracker.exe` is built, you can remove `src-tauri\target\debug` (`Remove-Item -Recurse -Force src-tauri\target\debug`) to free ~1.5–2 GB on `D:`.
- **SQLite data safety**: Tauri reuses `d:\LinhTinh\SoloLeveling\data\the_system.sqlite` through the same local Express backend (`127.0.0.1:3001`).
