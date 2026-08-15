"use client";

import React, { useEffect, useState, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useSession } from "@/lib/auth-client";

interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  workspaceId: string;
  createdAt: string;
  user?: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface ChatPanelProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatPanel({ workspaceId, isOpen, onClose }: ChatPanelProps) {
  const { data: session } = useSession();
  const currentUser = session?.user;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch initial chat history
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchHistory = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/workspaces/${workspaceId}/chat`);
        if (!res.ok) throw new Error("Failed to fetch chat history");
        const data = await res.json();
        if (isMounted) {
          setMessages(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error fetching chat history:", err);
        if (isMounted) setLoading(false);
      }
    };
    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [isOpen, workspaceId]);

  // Setup Socket.IO for realtime messages
  useEffect(() => {
    if (!isOpen) return;

    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL || "http://localhost:3001";
    const socket = io(realtimeUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_workspace", workspaceId);
    });

    socket.on("chat_message", (message: ChatMessage) => {
      setMessages((prev) => {
        // Prevent duplicates if we already added it locally
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isOpen, workspaceId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !currentUser) return;

    const content = inputValue.trim();
    setInputValue("");

    try {
      // Optimistic update
      const tempId = `temp-${Date.now()}`;
      const tempMsg: ChatMessage = {
        id: tempId,
        content,
        userId: currentUser.id,
        workspaceId,
        createdAt: new Date().toISOString(),
        user: {
          id: currentUser.id,
          name: currentUser.name ?? null,
          image: currentUser.image ?? null,
        },
      };
      setMessages((prev) => [...prev, tempMsg]);

      // Save to database
      const res = await fetch(`/api/workspaces/${workspaceId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) throw new Error("Failed to send message");
      const savedMsg: ChatMessage = await res.json();

      // Update local state with real message ID (or let socket handle it)
      setMessages((prev) => prev.map((m) => (m.id === tempId ? savedMsg : m)));

      // Emit over socket
      if (socketRef.current?.connected) {
        socketRef.current.emit("chat_message", savedMsg);
      }
    } catch (err) {
      console.error("Error sending message:", err);
      // Could show a toast or error state here
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-80 h-full flex flex-col bg-background border-l border-border shrink-0">
      <div className="h-12 px-4 flex items-center justify-between border-b border-border shrink-0">
        <h3 className="font-semibold text-sm">Workspace Chat</h3>
        <button
          onClick={onClose}
          className="p-1.5 rounded-md hover:bg-secondary text-foreground/70 hover:text-foreground transition"
          title="Close Chat"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {loading ? (
          <div className="flex justify-center p-4">
            <span className="text-xs text-foreground/50">Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-foreground/40 text-sm space-y-2">
            <span className="text-2xl">💬</span>
            <p>No messages yet.</p>
            <p className="text-xs">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = currentUser?.id === msg.userId;
            const showHeader = index === 0 || messages[index - 1].userId !== msg.userId;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                {showHeader && (
                  <span className="text-[10px] text-foreground/50 mb-1 px-1">
                    {msg.user?.name || "Unknown"}
                  </span>
                )}
                <div
                  className={`px-3 py-2 rounded-xl text-sm max-w-[85%] break-words ${
                    isMe
                      ? "bg-primary text-black rounded-tr-sm"
                      : "bg-secondary text-secondary-foreground rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-border bg-secondary/10 shrink-0"
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-foreground/40"
          />
          <button
            type="submit"
            disabled={!inputValue.trim()}
            className="px-3 py-2 bg-primary text-black rounded-md text-sm font-medium hover:bg-primary/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
