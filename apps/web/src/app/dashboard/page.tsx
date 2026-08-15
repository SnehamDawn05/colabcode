"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

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
  createdAt: string;
  updatedAt: string;
  members: WorkspaceMember[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await fetch("/api/workspaces", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch workspaces");
      const data = await response.json();
      setWorkspaces(data);
    } catch (err) {
      console.error("Error fetching workspaces:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);

    try {
      const response = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newWorkspaceName }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create workspace");
      }

      const newWorkspace = await response.json();
      setWorkspaces([newWorkspace, ...workspaces]);
      setNewWorkspaceName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authClient.signOut();
      router.push("/auth/login");
    } catch (err) {
      console.error("Logout failed:", err);
      router.push("/auth/login");
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Workspaces</h1>
          <p className="text-foreground/60 mt-1">
            Create and manage your collaborative coding workspaces
          </p>
        </div>
        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-foreground/60 hover:text-foreground"
        >
          Logout
        </button>
      </div>

      {/* Create Workspace Form */}
      <div className="bg-secondary/50 border border-border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Create New Workspace</h2>
        <form onSubmit={handleCreateWorkspace} className="flex gap-3">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="My New Workspace"
            className="flex-1 px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            required
          />
          <button
            type="submit"
            disabled={creating || !newWorkspaceName.trim()}
            className="px-6 py-2 bg-primary text-background rounded-lg font-medium hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create"}
          </button>
        </form>
        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
      </div>

      {/* Workspaces Grid */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-foreground/60">Loading workspaces...</p>
        </div>
      ) : workspaces.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-foreground/60">No workspaces yet. Create one above!</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {workspaces.map((workspace) => (
            <Link
              key={workspace.id}
              href={`/workspace/${workspace.id}`}
              className="block p-4 bg-secondary/30 hover:bg-secondary/50 border border-border rounded-lg transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{workspace.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-sm text-foreground/60">
                    <span>{workspace.members.length} members</span>
                    <span>{new Date(workspace.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="text-primary">→</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
