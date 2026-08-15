"use client";

import { useRef } from "react";
import Editor, { OnMount, OnChange, loader } from "@monaco-editor/react";
import type * as Monaco from "monaco-editor";

// Configure @monaco-editor/react to load Monaco from the npm package
// (bundled via its own CDN/loader mechanism) instead of webpack chunks.
// This is what properly solves the "Unexpected usage" worker error in Next.js.
loader.config({ monaco: undefined }); // use the default CDN loader

interface MonacoEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: string;
  readOnly?: boolean;
  theme?: "vs" | "vs-dark";
  onEditorMount?: (editor: Monaco.editor.IStandaloneCodeEditor) => void;
}

export function MonacoEditor({
  value,
  onChange,
  language,
  readOnly = false,
  theme = "vs-dark",
  onEditorMount,
}: MonacoEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor;
    if (onEditorMount) {
      onEditorMount(editor);
    }
  };

  const handleChange: OnChange = (newValue) => {
    if (onChange && newValue !== undefined) {
      onChange(newValue);
    }
  };

  return (
    <Editor
      height="100%"
      width="100%"
      language={language}
      value={value}
      theme={theme}
      onChange={handleChange}
      onMount={handleMount}
      options={{
        readOnly,
        automaticLayout: true,
        fontSize: 14,
        fontFamily: "Fira Code, monospace",
        lineNumbers: "on",
        minimap: { enabled: true },
        wordWrap: "on",
        formatOnPaste: true,
        formatOnType: true,
        scrollBeyondLastLine: false,
      }}
    />
  );
}
