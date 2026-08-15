"use client";

import { useEffect, useRef } from "react";
import type { RunResult } from "@/lib/judge0";

interface OutputPanelProps {
  result: RunResult | null;
  isRunning: boolean;
  onClear: () => void;
  onClose: () => void;
  onJumpToLine?: (line: number) => void;
}

const STATUS_COLORS: Record<string, string> = {
  Accepted: "text-emerald-400",
  "Compilation Error": "text-amber-400",
  "Time Limit Exceeded": "text-amber-400",
  Unsupported: "text-zinc-500",
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status] ?? "text-red-400";
}

function formatMemory(kb: number | null): string {
  if (kb == null) return "—";
  if (kb < 1024) return `${kb} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/**
 * A parsed segment of an error line — either plain text or a clickable line-reference.
 */
interface ErrorSegment {
  type: "text" | "lineref";
  content: string;
  line?: number;
  col?: number;
}

/**
 * Patterns that match line number references across languages:
 *
 * Python:   `File "solution.py", line 5`
 * Node.js:  `solution.js:3:12`
 * Java:     `Main.java:5: error:`
 * C/C++:    `solution.c:5:5: error:`
 * TypeScript: `solution.ts(5,13): error`
 * Go:       `./main.go:8:2:`
 * Rust:     `--> src/main.rs:5:9`
 * Ruby:     `solution.rb:4:in`
 * Bash:     `solution.sh: line 5:`
 */
const LINE_REF_PATTERNS: Array<{
  regex: RegExp;
  lineGroup: number;
  colGroup?: number;
}> = [
  // Python: File "...", line N
  { regex: /File\s+"[^"]+",\s+line\s+(\d+)/g, lineGroup: 1 },
  // Rust: --> src/main.rs:N:M
  { regex: /-->\s+\S+:(\d+):(\d+)/g, lineGroup: 1, colGroup: 2 },
  // TypeScript: file.ts(N,M): error
  { regex: /\w[\w./\\-]*\.\w+\((\d+),(\d+)\):/g, lineGroup: 1, colGroup: 2 },
  // C/C++/Java/Go/Node/Ruby: file.ext:N:M: or file.ext:N:
  { regex: /[\w./\\-]+\.\w+:(\d+)(?::(\d+))?:/g, lineGroup: 1, colGroup: 2 },
  // Bash: script.sh: line N:
  { regex: /:\s+line\s+(\d+):/g, lineGroup: 1 },
];

/**
 * Parses a raw error string into segments, tagging line-number references
 * so they can be rendered as clickable chips.
 */
function parseErrorLine(raw: string): ErrorSegment[] {
  // Try each pattern; use the first match found
  for (const { regex, lineGroup, colGroup } of LINE_REF_PATTERNS) {
    regex.lastIndex = 0;
    const match = regex.exec(raw);
    if (!match) continue;

    const line = parseInt(match[lineGroup], 10);
    const col = colGroup && match[colGroup] ? parseInt(match[colGroup], 10) : undefined;

    const before = raw.slice(0, match.index);
    const after = raw.slice(match.index + match[0].length);

    const segments: ErrorSegment[] = [];
    if (before) segments.push({ type: "text", content: before });
    segments.push({ type: "lineref", content: match[0], line, col });
    // Recursively parse the rest
    const rest = parseErrorLine(after);
    return [...segments, ...rest];
  }

  // No pattern matched — plain text
  return [{ type: "text", content: raw }];
}

interface RenderedErrorProps {
  errorText: string;
  statusDescription: string;
  onJumpToLine?: (line: number) => void;
}

function RenderedError({ errorText, statusDescription, onJumpToLine }: RenderedErrorProps) {
  const lines = errorText.split("\n");
  const color = getStatusColor(statusDescription);

  return (
    <div className="space-y-0">
      {lines.map((rawLine, lineIdx) => {
        const segments = parseErrorLine(rawLine);
        const hasRef = segments.some((s) => s.type === "lineref");

        return (
          <div
            key={lineIdx}
            className={`leading-relaxed flex items-start gap-2 ${
              hasRef ? "bg-red-950/20 rounded px-1 -mx-1" : ""
            }`}
          >
            <pre className={`whitespace-pre-wrap break-words flex-1 ${color}`}>
              {segments.map((seg, segIdx) => {
                if (seg.type === "lineref") {
                  return (
                    <button
                      key={segIdx}
                      onClick={() => onJumpToLine?.(seg.line!)}
                      title={`Jump to line ${seg.line}${seg.col ? `, col ${seg.col}` : ""}`}
                      className={`
                        inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5
                        rounded border cursor-pointer align-middle
                        text-xs font-semibold font-mono
                        text-red-300 border-red-700 bg-red-900/40
                        hover:bg-red-800/60 hover:border-red-500 hover:text-red-100
                        transition-colors duration-100
                        focus:outline-none focus:ring-1 focus:ring-red-500
                      `}
                    >
                      {/* Line icon */}
                      <svg className="w-2.5 h-2.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h18M3 6h18M3 18h12" />
                      </svg>
                      {seg.content}
                    </button>
                  );
                }
                return <span key={segIdx}>{seg.content}</span>;
              })}
            </pre>

            {/* Jump button at end of line if it has a ref */}
            {hasRef && onJumpToLine && (() => {
              const ref = segments.find((s) => s.type === "lineref");
              return (
                <button
                  onClick={() => onJumpToLine(ref!.line!)}
                  title={`Go to line ${ref!.line}`}
                  className="shrink-0 mt-0.5 text-xs text-red-500 hover:text-red-300 transition-colors whitespace-nowrap"
                >
                  ↗ line {ref!.line}
                </button>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}

export function OutputPanel({
  result,
  isRunning,
  onClear,
  onClose,
  onJumpToLine,
}: OutputPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [result, isRunning]);

  const hasOutput = result?.output && result.output.length > 0;
  const hasError = result?.error && result.error.length > 0;

  return (
    <div className="output-panel flex flex-col bg-[#0d1117] border-t border-[#21262d] font-mono text-sm select-text h-full">
      {/* Panel Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#21262d] bg-[#161b22] shrink-0">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Output
          </span>
          {result && !isRunning && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                result.statusDescription === "Accepted"
                  ? "text-emerald-400 border-emerald-800 bg-emerald-950/50"
                  : result.statusDescription === "Unsupported"
                  ? "text-zinc-500 border-zinc-700 bg-zinc-900/50"
                  : "text-red-400 border-red-900 bg-red-950/50"
              }`}
            >
              {result.statusDescription}
            </span>
          )}
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              Running...
            </span>
          )}
        </div>

        {/* Meta info */}
        {result && !isRunning && result.supported && (
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            {result.time && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <circle cx="12" cy="12" r="10" strokeWidth="2" />
                  <polyline points="12 6 12 12 16 14" strokeWidth="2" />
                </svg>
                {result.time}s
              </span>
            )}
            {result.memory != null && (
              <span className="flex items-center gap-1">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <rect x="2" y="7" width="20" height="14" rx="2" strokeWidth="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" strokeWidth="2" />
                </svg>
                {formatMemory(result.memory)}
              </span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          {result && (
            <button
              onClick={onClear}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
              title="Clear output"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
            title="Close panel"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Output Body */}
      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {isRunning && !result && (
          <div className="flex flex-col gap-2 text-zinc-500">
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-bounce"
                    style={{ animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
              <span className="text-xs">Submitting to Judge0...</span>
            </div>
          </div>
        )}

        {!isRunning && !result && (
          <p className="text-zinc-600 text-xs italic">
            Press{" "}
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-400 not-italic">
              Ctrl+Enter
            </kbd>{" "}
            or click <span className="text-emerald-500 font-medium">▶ Run</span> to execute the
            current file.
          </p>
        )}

        {result && !result.supported && (
          <p className="text-zinc-500 text-xs italic">
            Language <span className="text-zinc-300 font-medium">not supported</span> for
            execution. Supported: JavaScript, TypeScript, Python, Java, C, C++, Go, Rust, Ruby,
            PHP, Swift, Kotlin, Bash, SQL...
          </p>
        )}

        {result?.supported && (
          <div className="space-y-3">
            {/* stdout */}
            {hasOutput && (
              <pre className="whitespace-pre-wrap break-words leading-relaxed text-zinc-200">
                {result.output}
              </pre>
            )}

            {/* stderr / error */}
            {hasError && (
              <div>
                {hasOutput && <div className="border-t border-[#21262d] my-3" />}

                {/* Error type badge */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-red-500">
                    {result.statusDescription === "Compilation Error"
                      ? "Compilation Error"
                      : result.statusDescription.startsWith("Runtime")
                      ? result.statusDescription
                      : "Error"}
                  </span>
                  {onJumpToLine && (
                    <span className="text-xs text-zinc-600 italic">
                      — click a line reference to jump to it in the editor
                    </span>
                  )}
                </div>

                <RenderedError
                  errorText={result.error!}
                  statusDescription={result.statusDescription}
                  onJumpToLine={onJumpToLine}
                />
              </div>
            )}

            {/* No output at all */}
            {!hasOutput && !hasError && result.statusDescription === "Accepted" && (
              <p className="text-zinc-500 text-xs italic">Program exited with no output.</p>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
