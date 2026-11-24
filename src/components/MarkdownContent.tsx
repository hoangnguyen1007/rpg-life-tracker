import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';

interface MarkdownContentProps {
  content: string;
  className?: string;
}

function normalizeMarkdownInput(raw: string): string {
  let text = (raw || '').replace(/\r\n/g, '\n').trim();
  if (!text) return '';

  // Unescape literal \n when backend or LLM returned escaped newline string
  if (!text.includes('\n') && text.includes('\\n')) {
    text = text.replace(/\\n/g, '\n').replace(/\\t/g, '  ');
  }

  // Strip stray outer ```markdown / ```md fence wrapping the entire reply
  const outerFence = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
  if (outerFence) {
    text = outerFence[1].trim();
  }

  // Ensure space after # outside code blocks (e.g. "###Tiêu đề" -> "### Tiêu đề")
  const lines = text.split('\n');
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (!inFence) {
      lines[i] = lines[i].replace(/^(\s{0,3}#{1,4})([^\s#])/, '$1 $2');
    }
  }

  return lines.join('\n');
}

function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let idx = 0;

  // Ordered priority: inline code, http(s) link, bold+italic, bold, italic (*...* or bounded _..._), strikethrough
  const tokenRegex =
    /(`[^`\n]+`)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))|(\*\*\*[^*\n]+?\*\*\*)|(\*\*[^*\n]+?\*\*)|(\*(?!\s)[^*\n]+?(?<!\s)\*)|((?:^|(?<=[\s(\["']))_(?!\s)[^_\n]+?(?<!\s)_(?=$|[\s).,!?;:\]"']))|(~~[^~\n]+?~~)/;

  while (remaining.length > 0) {
    const match = remaining.match(tokenRegex);
    if (!match || match.index === undefined) {
      nodes.push(remaining);
      break;
    }

    if (match.index > 0) {
      nodes.push(remaining.slice(0, match.index));
    }

    const full = match[0];
    const k = `${keyPrefix}-${idx++}`;

    if (match[1]) {
      nodes.push(
        <code
          key={k}
          className="rounded-[2px] border px-1 py-0.5 font-mono text-[11px] text-amber-600 dark:text-amber-300 studio-subtle rpg-divider"
        >
          {full.slice(1, -1)}
        </code>
      );
    } else if (match[2] && match[3] && match[4]) {
      nodes.push(
        <a
          key={k}
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-sky-600 underline hover:text-sky-500 dark:text-cyan-400"
        >
          {match[3]}
        </a>
      );
    } else if (match[5]) {
      nodes.push(
        <strong key={k} className="font-bold text-main">
          <em>{renderInlineMarkdown(full.slice(3, -3), k)}</em>
        </strong>
      );
    } else if (match[6]) {
      nodes.push(
        <strong key={k} className="font-bold text-main">
          {renderInlineMarkdown(full.slice(2, -2), k)}
        </strong>
      );
    } else if (match[7]) {
      nodes.push(
        <em key={k} className="italic text-main">
          {renderInlineMarkdown(full.slice(1, -1), k)}
        </em>
      );
    } else if (match[8]) {
      nodes.push(
        <em key={k} className="italic text-main">
          {renderInlineMarkdown(full.slice(1, -1), k)}
        </em>
      );
    } else if (match[9]) {
      nodes.push(
        <del key={k} className="text-dim line-through">
          {renderInlineMarkdown(full.slice(2, -2), k)}
        </del>
      );
    } else {
      nodes.push(full);
    }

    remaining = remaining.slice(match.index + full.length);
  }

  return nodes;
}

const CodeBlock: React.FC<{ code: string; lang?: string }> = ({ code, lang }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="my-2 overflow-hidden rounded-[2px] border-2 bg-[#0b0e16] rpg-divider">
      <div className="flex items-center justify-between border-b px-2.5 py-1 text-[10px] font-mono text-dim rpg-divider bg-[#101522]">
        <span className="uppercase">{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[10px] text-sub hover:text-amber-400"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Đã copy</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-2.5 font-mono text-[11px] leading-relaxed text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
};

function splitTableRow(row: string): string[] {
  let line = row.trim();
  if (line.startsWith('|')) line = line.slice(1);
  if (line.endsWith('|')) line = line.slice(0, -1);
  return line.split('|').map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  const cells = splitTableRow(trimmed);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

export const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, className = '' }) => {
  const normalized = normalizeMarkdownInput(content);
  if (!normalized) return null;

  const lines = normalized.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // 1. Fenced Code Block
    const fenceOpen = line.match(/^\s*```([\w+-]*)\s*$/);
    if (fenceOpen) {
      const lang = fenceOpen[1];
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length && /^\s*```\s*$/.test(lines[i])) {
        i++;
      }
      blocks.push(<CodeBlock key={`code-${i}`} lang={lang} code={codeLines.join('\n')} />);
      continue;
    }

    // 2. Horizontal Rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={`hr-${i}`} className="my-2 border-t-2 rpg-divider" />);
      i++;
      continue;
    }

    // 3. Heading (# to ####)
    const headingMatch = line.match(/^\s{0,3}(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const cls =
        level === 1
          ? 'mt-2 mb-1 font-display text-sm font-extrabold text-amber-500 dark:text-amber-300'
          : level === 2
            ? 'mt-2 mb-1 font-display text-[13px] font-extrabold text-amber-500 dark:text-amber-300'
            : level === 3
              ? 'mt-1.5 mb-0.5 font-display text-xs font-extrabold text-amber-600 dark:text-amber-400'
              : 'mt-1 mb-0.5 font-display text-xs font-bold text-main';
      blocks.push(
        <div key={`h-${i}`} className={cls}>
          {renderInlineMarkdown(text, `h-${i}`)}
        </div>
      );
      i++;
      continue;
    }

    // 4. GFM Table
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      const headers = splitTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(splitTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={`tbl-${i}`} className="my-2 overflow-x-auto rounded-[2px] border-2 rpg-divider">
          <table className="w-full border-collapse text-left text-[11px]">
            <thead className="border-b-2 studio-subtle rpg-divider">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-2.5 py-1.5 font-bold text-main">
                    {renderInlineMarkdown(h, `th-${i}-${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y rpg-divider">
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {headers.map((_, ci) => (
                    <td key={ci} className="px-2.5 py-1.5 align-top text-sub">
                      {renderInlineMarkdown(r[ci] ?? '', `td-${i}-${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // 5. Blockquote (> ...)
    if (/^\s*>\s?/.test(line)) {
      const quoteLines: string[] = [];
      const startIdx = i;
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${startIdx}`}
          className="my-1.5 border-l-2 border-amber-500/70 bg-amber-500/5 px-2.5 py-1.5 text-xs italic text-sub"
        >
          {quoteLines.map((ql, qi) => (
            <div key={qi}>{renderInlineMarkdown(ql, `bq-${startIdx}-${qi}`)}</div>
          ))}
        </blockquote>
      );
      continue;
    }

    // 6. Unordered List (- , * , • )
    if (/^\s*([-*•])\s+/.test(line)) {
      const items: Array<{ indent: number; text: string }> = [];
      const startIdx = i;
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) {
        const m = lines[i].match(/^(\s*)([-*•])\s+(.*)$/);
        if (m) {
          items.push({
            indent: m[1].length >= 2 ? 1 : 0,
            text: m[3],
          });
        }
        i++;
      }
      blocks.push(
        <ul key={`ul-${startIdx}`} className="my-1.5 space-y-1 pl-4 text-xs leading-relaxed">
          {items.map((it, li) => (
            <li
              key={li}
              className={`list-disc text-sub ${it.indent > 0 ? 'ml-4' : ''}`}
            >
              {renderInlineMarkdown(it.text, `ul-${startIdx}-${li}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // 7. Ordered List (1. , 2) )
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: Array<{ num: string; text: string }> = [];
      const startIdx = i;
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        const m = lines[i].match(/^\s*(\d+)[.)]\s+(.*)$/);
        if (m) {
          items.push({ num: m[1], text: m[2] });
        }
        i++;
      }
      blocks.push(
        <ol key={`ol-${startIdx}`} className="my-1.5 space-y-1 pl-4 text-xs leading-relaxed">
          {items.map((it, li) => (
            <li key={li} className="list-decimal text-sub" value={Number(it.num) || undefined}>
              {renderInlineMarkdown(it.text, `ol-${startIdx}-${li}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // 8. Paragraph (group consecutive text lines until blank line or another block marker)
    const paraLines: string[] = [];
    const startIdx = i;
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s{0,3}(#{1,4})\s+/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim()) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^\s*([-*•])\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i]);
      i++;
    }

    if (paraLines.length > 0) {
      blocks.push(
        <p key={`p-${startIdx}`} className="my-1 text-xs leading-relaxed text-main">
          {paraLines.map((pl, pi) => (
            <React.Fragment key={pi}>
              {pi > 0 && <br />}
              {renderInlineMarkdown(pl, `p-${startIdx}-${pi}`)}
            </React.Fragment>
          ))}
        </p>
      );
    } else {
      // Safety guard against unforeseen stuck loop
      blocks.push(
        <p key={`raw-${i}`} className="my-1 text-xs leading-relaxed text-main">
          {line}
        </p>
      );
      i++;
    }
  }

  return <div className={`space-y-1 ${className}`}>{blocks}</div>;
};
