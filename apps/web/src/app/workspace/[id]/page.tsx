"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MonacoEditor } from "@/components/MonacoEditor";
import { OutputPanel } from "@/components/OutputPanel";
import { ChatPanel } from "@/components/ChatPanel";
import { ShareWorkspaceModal } from "@/components/ShareWorkspaceModal";
import { runCode, isLanguageSupported, type RunResult } from "@/lib/judge0";
import type * as Monaco from "monaco-editor";

interface File {
  id: string;
  name: string;
  language: string;
  content: string;
  workspaceId: string;
  folderId?: string;
}

interface Folder {
  id: string;
  name: string;
  workspaceId: string;
  parentId?: string;
}

interface WorkspaceMember {
  id: string;
  userId: string;
  role: string;
  user?: {
    id: string;
    name?: string | null;
    email: string;
    image?: string | null;
  };
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
  members: WorkspaceMember[];
  files: File[];
  folders: Folder[];
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "📘";
    case "js":
    case "jsx":
    case "mjs":
      return "🟨";
    case "py":
      return "🐍";
    case "html":
      return "🌐";
    case "css":
    case "scss":
      return "🎨";
    case "json":
      return "📦";
    case "md":
      return "📝";
    case "sql":
      return "🗄️";
    case "rs":
      return "🦀";
    case "go":
      return "🐹";
    case "cpp":
    case "c":
    case "h":
    case "hpp":
      return "⚙️";
    case "java":
      return "☕";
    default:
      return "📄";
  }
}

export default function WorkspacePage() {
  const params = useParams();
  const workspaceId = params.id as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<File[]>([]);

  // Code execution state
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [outputOpen, setOutputOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  // File/Folder creation & rename state
  const [activeCreation, setActiveCreation] = useState<{
    type: "file" | "folder";
    folderId?: string;
  } | null>(null);
  const [creationName, setCreationName] = useState("");
  const [editingItem, setEditingItem] = useState<{
    type: "file" | "folder";
    id: string;
  } | null>(null);
  const [editingName, setEditingName] = useState("");
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set());

  // Tracks the live editor content (may differ from saved file content)
  const editorValueRef = useRef<string>("");
  const monacoEditorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);

  const fetchWorkspace = useCallback(async () => {
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch workspace");
      const data = await response.json();
      setWorkspace(data);

      // Open first file by default if no active file
      if (!activeFileId && data.files && data.files.length > 0) {
        const firstFile = data.files[0];
        setActiveFileId(firstFile.id);
        setOpenTabs([firstFile]);
        editorValueRef.current = firstFile.content ?? "";
      }
    } catch (err) {
      console.error("Error fetching workspace:", err);
    } finally {
      setLoading(false);
    }
  }, [workspaceId, activeFileId]);

  useEffect(() => {
    fetchWorkspace();
  }, [fetchWorkspace]);

  const openFile = (file: File) => {
    setActiveFileId(file.id);
    editorValueRef.current = file.content ?? "";
    if (!openTabs.find((f) => f.id === file.id)) {
      setOpenTabs((prev) => [...prev, file]);
    }
  };

  const closeTab = (fileId: string) => {
    const newTabs = openTabs.filter((f) => f.id !== fileId);
    setOpenTabs(newTabs);
    if (activeFileId === fileId) {
      const next = newTabs[0] ?? null;
      setActiveFileId(next?.id ?? null);
      editorValueRef.current = next?.content ?? "";
    }
  };

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  /** Create a new File */
  const handleCreateFile = async (name: string, folderId?: string) => {
    if (!name.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/files`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), folderId, content: "" }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create file");
      }
      const newFile: File = await res.json();
      setWorkspace((w) => (w ? { ...w, files: [...w.files, newFile] } : w));
      openFile(newFile);
      setActiveCreation(null);
      setCreationName("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create file");
    }
  };

  /** Create a new Folder */
  const handleCreateFolder = async (name: string, parentId?: string) => {
    if (!name.trim()) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/folders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), parentId }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create folder");
      }
      const newFolder: Folder = await res.json();
      setWorkspace((w) => (w ? { ...w, folders: [...w.folders, newFolder] } : w));
      setActiveCreation(null);
      setCreationName("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create folder");
    }
  };

  /** Rename File */
  const handleRenameFile = async (fileId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingItem(null);
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to rename file");
      }
      const updatedFile: File = await res.json();
      setWorkspace((w) =>
        w
          ? {
              ...w,
              files: w.files.map((f) => (f.id === fileId ? { ...f, ...updatedFile } : f)),
            }
          : w
      );
      setOpenTabs((tabs) =>
        tabs.map((t) => (t.id === fileId ? { ...t, ...updatedFile } : t))
      );
      setEditingItem(null);
      setEditingName("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename file");
    }
  };

  /** Rename Folder */
  const handleRenameFolder = async (folderId: string, newName: string) => {
    if (!newName.trim()) {
      setEditingItem(null);
      return;
    }
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/folders/${folderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to rename folder");
      }
      const updatedFolder: Folder = await res.json();
      setWorkspace((w) =>
        w
          ? {
              ...w,
              folders: w.folders.map((f) => (f.id === folderId ? { ...f, ...updatedFolder } : f)),
            }
          : w
      );
      setEditingItem(null);
      setEditingName("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to rename folder");
    }
  };

  /** Delete File */
  const handleDeleteFile = async (fileId: string, fileName: string) => {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete file");
      }
      setWorkspace((w) =>
        w ? { ...w, files: w.files.filter((f) => f.id !== fileId) } : w
      );
      closeTab(fileId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete file");
    }
  };

  /** Delete Folder */
  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete folder "${folderName}" and all its subfolders and files?`
      )
    )
      return;
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/folders/${folderId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete folder");
      }

      // Find all descendant folder IDs recursively
      const allFolders = workspace?.folders || [];
      const folderIdsToDelete = new Set<string>([folderId]);
      let added = true;
      while (added) {
        added = false;
        for (const f of allFolders) {
          if (f.parentId && folderIdsToDelete.has(f.parentId) && !folderIdsToDelete.has(f.id)) {
            folderIdsToDelete.add(f.id);
            added = true;
          }
        }
      }

      // Close tabs for all files in any deleted folder
      const filesToDelete =
        workspace?.files.filter((f) => f.folderId && folderIdsToDelete.has(f.folderId)) || [];
      filesToDelete.forEach((f) => closeTab(f.id));

      setWorkspace((w) =>
        w
          ? {
              ...w,
              folders: w.folders.filter((f) => !folderIdsToDelete.has(f.id)),
              files: w.files.filter((f) => !f.folderId || !folderIdsToDelete.has(f.folderId)),
            }
          : w
      );
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete folder");
    }
  };

  /** Recursive Folder Renderer */
  const renderFolderItem = (folder: Folder, depth = 0) => {
    const isCollapsed = collapsedFolders.has(folder.id);
    const childFolders = workspace?.folders?.filter((f) => f.parentId === folder.id) || [];
    const folderFiles = workspace?.files?.filter((f) => f.folderId === folder.id) || [];
    const isEditing = editingItem?.type === "folder" && editingItem.id === folder.id;
    const isCreatingInsideThis = activeCreation && activeCreation.folderId === folder.id;

    return (
      <div key={folder.id} className="space-y-0.5">
        <div
          className="group flex items-center justify-between p-1.5 text-xs rounded hover:bg-secondary/50 cursor-pointer text-foreground/80 hover:text-foreground"
          style={{ paddingLeft: `${depth * 12 + 6}px` }}
        >
          <div
            className="flex items-center gap-1.5 min-w-0 flex-1"
            onClick={() => toggleFolderCollapse(folder.id)}
          >
            <span className="text-[10px] text-foreground/40 font-mono">
              {isCollapsed ? "▶" : "▼"}
            </span>
            <span>{isCollapsed ? "📁" : "📂"}</span>
            {isEditing ? (
              <input
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleRenameFolder(folder.id, editingName);
                  } else if (e.key === "Escape") {
                    setEditingItem(null);
                  }
                }}
                onBlur={() => handleRenameFolder(folder.id, editingName)}
                className="bg-background border border-primary/50 rounded px-1 text-xs text-foreground focus:outline-none flex-1 font-mono"
              />
            ) : (
              <span className="font-medium truncate">{folder.name}</span>
            )}
          </div>

          {!isEditing && (
            <div className="hidden group-hover:flex items-center gap-1 shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isCollapsed) toggleFolderCollapse(folder.id);
                  setActiveCreation({ type: "file", folderId: folder.id });
                  setCreationName("");
                }}
                title="New File in folder"
                className="p-0.5 hover:text-primary text-[11px]"
              >
                📄+
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isCollapsed) toggleFolderCollapse(folder.id);
                  setActiveCreation({ type: "folder", folderId: folder.id });
                  setCreationName("");
                }}
                title="New Folder inside this folder"
                className="p-0.5 hover:text-primary text-[11px]"
              >
                📁+
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingItem({ type: "folder", id: folder.id });
                  setEditingName(folder.name);
                }}
                title="Rename Folder"
                className="p-0.5 hover:text-blue-400 text-[11px]"
              >
                ✏️
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(folder.id, folder.name);
                }}
                title="Delete Folder"
                className="p-0.5 hover:text-red-400 text-[11px]"
              >
                🗑️
              </button>
            </div>
          )}
        </div>

        {/* Folder Contents */}
        {!isCollapsed && (
          <div className="space-y-0.5">
            {/* Inline Creation inside this folder (file or folder) */}
            {isCreatingInsideThis && (
              <div
                className="flex items-center gap-1.5 p-1 bg-secondary/60 rounded border border-primary/50 text-xs"
                style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
              >
                <span>{activeCreation.type === "file" ? "📄" : "📁"}</span>
                <input
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  type="text"
                  placeholder={
                    activeCreation.type === "file" ? "filename.js" : "subfolder_name"
                  }
                  value={creationName}
                  onChange={(e) => setCreationName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (activeCreation.type === "file") {
                        handleCreateFile(creationName, folder.id);
                      } else {
                        handleCreateFolder(creationName, folder.id);
                      }
                    } else if (e.key === "Escape") {
                      setActiveCreation(null);
                      setCreationName("");
                    }
                  }}
                  onBlur={() => {
                    if (creationName.trim()) {
                      if (activeCreation.type === "file") {
                        handleCreateFile(creationName, folder.id);
                      } else {
                        handleCreateFolder(creationName, folder.id);
                      }
                    } else {
                      setActiveCreation(null);
                    }
                  }}
                  className="w-full bg-transparent text-xs text-foreground focus:outline-none font-mono"
                />
              </div>
            )}

            {/* Recursive Subfolders */}
            {childFolders.map((childFolder) => renderFolderItem(childFolder, depth + 1))}

            {/* Folder Files */}
            {folderFiles.map((file) => {
              const isEditingFile =
                editingItem?.type === "file" && editingItem.id === file.id;
              const isActive = activeFileId === file.id;

              return (
                <div
                  key={file.id}
                  onClick={() => !isEditingFile && openFile(file)}
                  style={{ paddingLeft: `${(depth + 1) * 12 + 6}px` }}
                  className={`group flex items-center justify-between p-1.5 text-xs rounded cursor-pointer transition ${
                    isActive
                      ? "bg-primary/20 text-primary font-medium"
                      : "hover:bg-secondary/40 text-foreground/70 hover:text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span>{getFileIcon(file.name)}</span>
                    {isEditingFile ? (
                      <input
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleRenameFile(file.id, editingName);
                          } else if (e.key === "Escape") {
                            setEditingItem(null);
                          }
                        }}
                        onBlur={() => handleRenameFile(file.id, editingName)}
                        className="bg-background border border-primary/50 rounded px-1 text-xs text-foreground focus:outline-none flex-1 font-mono"
                      />
                    ) : (
                      <span className="truncate">{file.name}</span>
                    )}
                  </div>

                  {!isEditingFile && (
                    <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingItem({ type: "file", id: file.id });
                          setEditingName(file.name);
                        }}
                        title="Rename File"
                        className="p-0.5 hover:text-blue-400 text-[11px]"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(file.id, file.name);
                        }}
                        title="Delete File"
                        className="p-0.5 hover:text-red-400 text-[11px]"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const activeFile = openTabs.find((f) => f.id === activeFileId);

  /** Execute the current file's code */
  const handleRun = useCallback(async () => {
    if (!activeFile || isRunning) return;

    const code = editorValueRef.current || activeFile.content;
    setIsRunning(true);
    setOutputOpen(true);
    setRunResult(null);

    try {
      const result = await runCode(activeFile.language, code);
      setRunResult(result);
    } catch (err) {
      setRunResult({
        output: "",
        error: err instanceof Error ? err.message : "Unknown execution error",
        statusDescription: "Internal Error",
        time: null,
        memory: null,
        languageId: null,
        supported: true,
      });
    } finally {
      setIsRunning(false);
    }
  }, [activeFile, isRunning]);

  const handleSave = useCallback(async () => {
    if (!activeFile || isSaving) return;
    setIsSaving(true);
    try {
      const content = editorValueRef.current || activeFile.content;
      const res = await fetch(`/api/workspaces/${workspaceId}/files/${activeFile.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        throw new Error("Failed to save file");
      }
      
      // Update local state so it matches the saved content
      setOpenTabs((tabs) =>
        tabs.map((t) => (t.id === activeFile.id ? { ...t, content } : t))
      );
      setWorkspace((w) => {
        if (!w) return w;
        return {
          ...w,
          files: w.files.map((f) => (f.id === activeFile.id ? { ...f, content } : f)),
        };
      });
    } catch (err) {
      console.error("Error saving file:", err);
      alert("Failed to save file");
    } finally {
      setIsSaving(false);
    }
  }, [activeFile, isSaving, workspaceId]);

  // Global shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        handleRun();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleRun, handleSave]);

  const supported = activeFile ? isLanguageSupported(activeFile.language) : false;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading workspace...</p>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Workspace not found</p>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="h-16 border-b border-border bg-secondary/30 flex items-center px-4 justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/dashboard"
            className="p-1.5 rounded-md hover:bg-secondary text-foreground/70 hover:text-foreground transition text-xs font-semibold shrink-0"
            title="Back to Dashboard"
          >
            ← Dashboard
          </Link>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="min-w-0">
            <h1 className="font-semibold truncate text-sm sm:text-base">{workspace.name}</h1>
            <p className="text-xs text-foreground/60">{workspace.members.length} members</p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            id="chat-toggle-button"
            onClick={() => setChatOpen(!chatOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-xs font-semibold transition shadow-sm ${
              chatOpen
                ? "bg-primary/20 border-primary/50 text-primary"
                : "bg-secondary/80 hover:bg-secondary border-border text-foreground"
            }`}
          >
            <span>💬</span>
            <span>Chat</span>
          </button>
          <button
            id="share-workspace-button"
            onClick={() => setShareOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary/80 hover:bg-secondary active:bg-secondary/60 border border-border text-foreground rounded-md text-xs font-semibold transition shadow-sm"
          >
            <span>👥</span>
            <span>Share</span>
          </button>
          <div className="h-4 w-px bg-border shrink-0" />
          <div className="text-xs text-foreground/60 hidden sm:block">
            Connected • {activeFile?.language || "No file"}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r border-border bg-secondary/20 flex flex-col overflow-hidden select-none">
          {/* Explorer Header with Action Buttons */}
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-foreground/60">
              Explorer
            </h2>
            <div className="flex items-center gap-1">
              <button
                id="new-file-button"
                onClick={() => {
                  setActiveCreation({ type: "file" });
                  setCreationName("");
                }}
                title="New File"
                className="p-1 rounded hover:bg-secondary text-foreground/70 hover:text-foreground transition text-xs flex items-center gap-1 font-medium"
              >
                <span>📄+</span>
              </button>
              <button
                id="new-folder-button"
                onClick={() => {
                  setActiveCreation({ type: "folder" });
                  setCreationName("");
                }}
                title="New Folder"
                className="p-1 rounded hover:bg-secondary text-foreground/70 hover:text-foreground transition text-xs flex items-center gap-1 font-medium"
              >
                <span>📁+</span>
              </button>
            </div>
          </div>

          {/* Files & Folders List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {/* Root Inline Creation Input */}
            {activeCreation && !activeCreation.folderId && (
              <div className="flex items-center gap-1.5 p-1.5 bg-secondary/60 rounded border border-primary/50">
                <span className="text-sm">
                  {activeCreation.type === "file" ? "📄" : "📁"}
                </span>
                <input
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  type="text"
                  placeholder={
                    activeCreation.type === "file" ? "filename.js" : "folder_name"
                  }
                  value={creationName}
                  onChange={(e) => setCreationName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (activeCreation.type === "file") {
                        handleCreateFile(creationName);
                      } else {
                        handleCreateFolder(creationName);
                      }
                    } else if (e.key === "Escape") {
                      setActiveCreation(null);
                      setCreationName("");
                    }
                  }}
                  onBlur={() => {
                    if (creationName.trim()) {
                      if (activeCreation.type === "file") {
                        handleCreateFile(creationName);
                      } else {
                        handleCreateFolder(creationName);
                      }
                    } else {
                      setActiveCreation(null);
                    }
                  }}
                  className="w-full bg-transparent text-xs text-foreground focus:outline-none font-mono"
                />
              </div>
            )}

            {/* Folders (Render root folders recursively) */}
            {workspace.folders
              ?.filter((f) => !f.parentId)
              .map((rootFolder) => renderFolderItem(rootFolder, 0))}

            {/* Root Files (Files not in any folder) */}
            {workspace.files
              .filter((f) => !f.folderId)
              .map((file) => {
                const isEditingFile =
                  editingItem?.type === "file" && editingItem.id === file.id;
                const isActive = activeFileId === file.id;

                return (
                  <div
                    key={file.id}
                    onClick={() => !isEditingFile && openFile(file)}
                    className={`group flex items-center justify-between p-1.5 text-xs rounded cursor-pointer transition ${
                      isActive
                        ? "bg-primary/20 text-primary font-medium"
                        : "hover:bg-secondary/40 text-foreground/70 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span>{getFileIcon(file.name)}</span>
                      {isEditingFile ? (
                        <input
                          // eslint-disable-next-line jsx-a11y/no-autofocus
                          autoFocus
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleRenameFile(file.id, editingName);
                            } else if (e.key === "Escape") {
                              setEditingItem(null);
                            }
                          }}
                          onBlur={() => handleRenameFile(file.id, editingName)}
                          className="bg-background border border-primary/50 rounded px-1 text-xs text-foreground focus:outline-none flex-1 font-mono"
                        />
                      ) : (
                        <span className="truncate">{file.name}</span>
                      )}
                    </div>

                    {!isEditingFile && (
                      <div className="hidden group-hover:flex items-center gap-1 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingItem({ type: "file", id: file.id });
                            setEditingName(file.name);
                          }}
                          title="Rename File"
                          className="p-0.5 hover:text-blue-400 text-[11px]"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFile(file.id, file.name);
                          }}
                          title="Delete File"
                          className="p-0.5 hover:text-red-400 text-[11px]"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

            {/* Empty Explorer state */}
            {(!workspace.files || workspace.files.length === 0) &&
              (!workspace.folders || workspace.folders.length === 0) &&
              !activeCreation && (
                <div className="text-center py-6 text-xs text-foreground/40 space-y-2">
                  <p>No files yet</p>
                  <button
                    onClick={() => {
                      setActiveCreation({ type: "file" });
                      setCreationName("");
                    }}
                    className="px-2 py-1 bg-secondary hover:bg-secondary/80 rounded text-[11px] text-foreground/70"
                  >
                    + Create a file
                  </button>
                </div>
              )}
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs + Run Button row */}
          <div className="border-b border-border bg-secondary/30 flex items-center">
            {/* Tabs */}
            <div className="flex-1 flex items-center overflow-x-auto h-12">
              {openTabs.map((file) => (
                <div
                  key={file.id}
                  onClick={() => {
                    setActiveFileId(file.id);
                    editorValueRef.current = file.content ?? "";
                  }}
                  className={`flex items-center gap-2 px-4 h-full border-r border-border cursor-pointer text-sm whitespace-nowrap ${
                    activeFileId === file.id
                      ? "bg-background border-b-2 border-primary"
                      : "hover:bg-secondary/50"
                  }`}
                >
                  {file.name}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(file.id);
                    }}
                    className="ml-2 text-foreground/40 hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            {activeFile && (
              <div className="px-3 shrink-0 flex items-center gap-2">
                <button
                  id="save-code-button"
                  onClick={handleSave}
                  disabled={isSaving}
                  title="Save file (Ctrl+S)"
                  className={`
                    flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold
                    transition-all duration-150 select-none
                    ${
                      isSaving
                        ? "bg-blue-700/40 text-blue-300 cursor-wait"
                        : "bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm hover:shadow-blue-500/25 hover:shadow-md"
                    }
                  `}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  id="run-code-button"
                  onClick={handleRun}
                  disabled={isRunning || !supported}
                  title={
                    !supported
                      ? `${activeFile.language} is not supported for execution`
                      : "Run code (Ctrl+Enter)"
                  }
                  className={`
                    flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-semibold
                    transition-all duration-150 select-none
                    ${
                      !supported
                        ? "bg-zinc-700/40 text-zinc-500 cursor-not-allowed"
                        : isRunning
                        ? "bg-emerald-700/40 text-emerald-300 cursor-wait"
                        : "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-sm hover:shadow-emerald-500/25 hover:shadow-md"
                    }
                  `}
                >
                  {isRunning ? (
                    <>
                      {/* Spinner */}
                      <svg
                        className="w-3.5 h-3.5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Running…
                    </>
                  ) : (
                    <>
                      {/* Play triangle */}
                      <svg
                        className="w-3.5 h-3.5"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                      >
                        <path d="M3 2.5l10 5.5-10 5.5V2.5z" />
                      </svg>
                      Run
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Editor + Output split */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Editor */}
            <div
              className="overflow-hidden bg-background"
              style={{ flex: outputOpen ? "1 1 0%" : "1 1 100%" }}
            >
              {activeFile ? (
                <MonacoEditor
                  value={activeFile.content}
                  language={activeFile.language}
                  theme="vs-dark"
                  readOnly={false}
                  onChange={(val) => {
                    editorValueRef.current = val;
                  }}
                  onEditorMount={(editor) => {
                    monacoEditorRef.current = editor;
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-foreground/60">
                  No file selected
                </div>
              )}
            </div>

            {/* Output Panel */}
            {outputOpen && (
              <div style={{ height: "260px", flexShrink: 0 }}>
                <OutputPanel
                  result={runResult}
                  isRunning={isRunning}
                  onClear={() => setRunResult(null)}
                  onClose={() => setOutputOpen(false)}
                  onJumpToLine={(line) => {
                    if (monacoEditorRef.current) {
                      monacoEditorRef.current.revealLineInCenter(line);
                      monacoEditorRef.current.setPosition({ lineNumber: line, column: 1 });
                      monacoEditorRef.current.focus();
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
        
        {/* Chat Sidebar */}
        <ChatPanel
          workspaceId={workspaceId}
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
        />
      </div>

      {/* Share / Invite Modal */}
      <ShareWorkspaceModal
        isOpen={shareOpen}
        onClose={() => setShareOpen(false)}
        workspaceId={workspace.id}
        workspaceName={workspace.name}
        members={workspace.members}
        onMembersChange={(updatedMembers) => {
          setWorkspace((prev) => (prev ? { ...prev, members: updatedMembers } : prev));
        }}
      />
    </div>
  );
}
