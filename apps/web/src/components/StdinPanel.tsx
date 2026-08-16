"use client";

import { useRef } from "react";

interface StdinPanelProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export function StdinPanel({ value, onChange, onClose }: StdinPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="flex flex-col bg-[#0d1117] border-t border-[#21262d] font-mono text-sm shrink-0" style={{ height: "160px" }}>
      {/* Panel Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[#21262d] bg-[#161b22] shrink-0">
        <div className="flex items-center gap-2 flex-1">
          {/* Terminal / chevron-right icon */}
          <svg className="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Standard Input
          </span>
          <span className="text-xs text-zinc-600 font-sans normal-case tracking-normal">
            (stdin)
          </span>
          {value.trim().length > 0 && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-700/50 text-amber-400 text-[10px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              {value.split("\n").length} line{value.split("\n").length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Clear button */}
          {value.length > 0 && (
            <button
              onClick={() => {
                onChange("");
                textareaRef.current?.focus();
              }}
              className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
              title="Clear input"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
            </button>
          )}
          {/* Close button */}
          <button
            onClick={onClose}
            className="p-1.5 rounded text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
            title="Close input panel"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <polyline points="18 15 12 9 6 15" />
            </svg>
          </button>
        </div>
      </div>

      {/* Textarea body */}
      <div className="flex-1 relative min-h-0">
        <textarea
          ref={textareaRef}
          id="stdin-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={"Enter program input here, one value per line...\ne.g.  42\n      hello world"}
          spellCheck={false}
          className={`
            absolute inset-0 w-full h-full resize-none
            bg-transparent text-zinc-200 placeholder-zinc-700
            px-4 py-3 text-xs leading-relaxed
            focus:outline-none focus:ring-1 focus:ring-amber-500/30
            font-mono caret-amber-400
          `}
        />
        {/* Subtle amber left border accent when has content */}
        {value.trim().length > 0 && (
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-500/40 rounded-r pointer-events-none" />
        )}
      </div>
    </div>
  );
}
