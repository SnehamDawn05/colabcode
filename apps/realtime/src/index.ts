import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

// Render injects PORT; fall back to REALTIME_PORT for local dev, then 3001
const PORT = parseInt(process.env.PORT || process.env.REALTIME_PORT || "3001", 10);

const io = new Server(PORT, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_API_URL,
        "http://localhost:3000",
        "http://127.0.0.1:3000",
      ].filter(Boolean);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Store active workspaces and their connections
const workspaces = new Map<string, Set<string>>();
const socketWorkspaces = new Map<string, Set<string>>();

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // ── Workspace events ──────────────────────────────────────────
  socket.on("join_workspace", (workspaceId: string) => {
    socket.join(`workspace:${workspaceId}`);
    if (!workspaces.has(workspaceId)) {
      workspaces.set(workspaceId, new Set());
    }
    workspaces.get(workspaceId)!.add(socket.id);

    if (!socketWorkspaces.has(socket.id)) {
      socketWorkspaces.set(socket.id, new Set());
    }
    socketWorkspaces.get(socket.id)!.add(workspaceId);

    io.to(`workspace:${workspaceId}`).emit("user_joined", {
      userId: socket.id,
      timestamp: new Date(),
    });
  });

  socket.on("leave_workspace", (workspaceId: string) => {
    socket.leave(`workspace:${workspaceId}`);
    const ws = workspaces.get(workspaceId);
    if (ws) {
      ws.delete(socket.id);
      if (ws.size === 0) workspaces.delete(workspaceId);
    }
    const sw = socketWorkspaces.get(socket.id);
    if (sw) {
      sw.delete(workspaceId);
      if (sw.size === 0) socketWorkspaces.delete(socket.id);
    }
    io.to(`workspace:${workspaceId}`).emit("user_left", {
      userId: socket.id,
      timestamp: new Date(),
    });
  });

  // ── Real-time File Synchronization ────────────────────────────
  socket.on("file_change", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("file_change", payload);
  });

  socket.on("file_save", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("file_save", payload);
  });

  socket.on("file_create", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("file_create", payload);
  });

  socket.on("file_rename", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("file_rename", payload);
  });

  socket.on("file_delete", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("file_delete", payload);
  });

  // ── Real-time Folder Synchronization ──────────────────────────
  socket.on("folder_create", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("folder_create", payload);
  });

  socket.on("folder_rename", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("folder_rename", payload);
  });

  socket.on("folder_delete", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("folder_delete", payload);
  });

  socket.on("sync_update", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("sync_update", payload);
  });

  socket.on("presence", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("presence", payload);
  });

  socket.on("cursor", (data) => {
    const { workspaceId, ...payload } = data;
    socket.to(`workspace:${workspaceId}`).emit("cursor", payload);
  });

  socket.on("chat_message", (data) => {
    const { workspaceId, ...payload } = data;
    io.to(`workspace:${workspaceId}`).emit("chat_message", payload);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    const sw = socketWorkspaces.get(socket.id);
    if (sw) {
      sw.forEach((workspaceId) => {
        const ws = workspaces.get(workspaceId);
        if (ws) {
          ws.delete(socket.id);
          if (ws.size === 0) workspaces.delete(workspaceId);
        }
        io.to(`workspace:${workspaceId}`).emit("user_left", {
          userId: socket.id,
          timestamp: new Date(),
        });
      });
      socketWorkspaces.delete(socket.id);
    }
  });
});

console.log(`Real-time server running on port ${PORT}`);
