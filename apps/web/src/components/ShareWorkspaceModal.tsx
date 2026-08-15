"use client";

import React, { useState } from "react";
import { useSession } from "@/lib/auth-client";

export interface WorkspaceMember {
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

interface ShareWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
  members: WorkspaceMember[];
  onMembersChange: (updatedMembers: WorkspaceMember[]) => void;
}

export function ShareWorkspaceModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceName,
  members,
  onMembersChange,
}: ShareWorkspaceModalProps) {
  const { data: session } = useSession();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"EDITOR" | "VIEWER" | "OWNER">("EDITOR");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentMember = members.find((m) => m.userId === session?.user?.id);
  const isCurrentUserOwner = currentMember?.role === "OWNER";

  const handleCopyLink = async () => {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy link to clipboard");
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to invite member");
      }

      onMembersChange([...members, data]);
      setEmail("");
      setSuccess(`Invited ${data.user?.email || "user"} as ${role.toLowerCase()}!`);
      setTimeout(() => setSuccess(null), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite member");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateRole = async (memberId: string, newRole: "OWNER" | "EDITOR" | "VIEWER") => {
    setActionLoadingId(memberId);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update role");
      }

      onMembersChange(members.map((m) => (m.id === memberId ? data : m)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from this workspace?`)) {
      return;
    }

    setActionLoadingId(memberId);
    setError(null);

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members/${memberId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove member");
      }

      onMembersChange(members.filter((m) => m.id !== memberId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden text-zinc-100 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>👥</span> Share &ldquo;{workspaceName}&rdquo;
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Invite collaborators to write and run code in real time
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition"
            title="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Direct Link Share */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Workspace Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={typeof window !== "undefined" ? window.location.href : ""}
                className="flex-1 px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-300 select-all font-mono focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-3 py-2 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 rounded-lg text-zinc-200 transition shrink-0 flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <span className="text-emerald-400">✓</span> Copied!
                  </>
                ) : (
                  <>
                    <span>📋</span> Copy Link
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Invite Form (Owners Only) */}
          {isCurrentUserOwner ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Invite by Email
              </label>
              <form onSubmit={handleInvite} className="flex gap-2">
                <input
                  type="email"
                  placeholder="collaborator@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-zinc-500"
                  required
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as "EDITOR" | "VIEWER" | "OWNER")}
                  aria-label="Role to assign"
                  className="px-2 py-2 text-sm bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="EDITOR">Editor</option>
                  <option value="VIEWER">Viewer</option>
                  <option value="OWNER">Owner</option>
                </select>
                <button
                  type="submit"
                  disabled={isSubmitting || !email.trim()}
                  className="px-4 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition shrink-0 flex items-center gap-1.5"
                >
                  {isSubmitting ? "Inviting..." : "Invite"}
                </button>
              </form>
            </div>
          ) : (
            <div className="p-3 bg-zinc-950/60 border border-zinc-800 rounded-lg text-xs text-zinc-400">
              ℹ️ Only workspace owners can invite new members or change roles.
            </div>
          )}

          {/* Feedback messages */}
          {error && (
            <div className="p-3 text-xs bg-red-950/50 border border-red-800/80 rounded-lg text-red-300">
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div className="p-3 text-xs bg-emerald-950/50 border border-emerald-800/80 rounded-lg text-emerald-300">
              ✓ {success}
            </div>
          )}

          {/* Members List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Workspace Members ({members.length})
              </label>
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {members.map((member) => {
                const isSelf = member.userId === session?.user?.id;
                const canManage = isCurrentUserOwner && !isSelf;
                const initial = (member.user?.name || member.user?.email || "?")[0].toUpperCase();

                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2.5 bg-zinc-950/70 border border-zinc-800/80 rounded-lg"
                  >
                    {/* User info */}
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-xs text-zinc-200 overflow-hidden shrink-0">
                        {member.user?.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={member.user.image}
                            alt={member.user.name || "User"}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          initial
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-200 flex items-center gap-1.5 truncate">
                          <span>{member.user?.name || "Unnamed User"}</span>
                          {isSelf && (
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">{member.user?.email}</div>
                      </div>
                    </div>

                    {/* Role & Management */}
                    <div className="flex items-center gap-2 shrink-0">
                      {canManage ? (
                        <>
                          <select
                            value={member.role}
                            disabled={actionLoadingId === member.id}
                            onChange={(e) =>
                              handleUpdateRole(
                                member.id,
                                e.target.value as "OWNER" | "EDITOR" | "VIEWER"
                              )
                            }
                            aria-label={`Role for ${member.user?.email || "member"}`}
                            className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="OWNER">Owner</option>
                            <option value="EDITOR">Editor</option>
                            <option value="VIEWER">Viewer</option>
                          </select>
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveMember(member.id, member.user?.email || "this member")
                            }
                            disabled={actionLoadingId === member.id}
                            title="Remove member"
                            className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-red-950/40 transition text-xs"
                          >
                            🗑️
                          </button>
                        </>
                      ) : (
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            member.role === "OWNER"
                              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                              : member.role === "EDITOR"
                              ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                              : "bg-zinc-700/30 text-zinc-400 border border-zinc-700"
                          }`}
                        >
                          {member.role.toLowerCase()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-900/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
