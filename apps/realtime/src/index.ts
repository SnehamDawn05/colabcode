import { Server } from "socket.io";
import dotenv from "dotenv";

dotenv.config();

// Render injects PORT; fall back to REALTIME_PORT for local dev, then 3001
const PORT = parseInt(process.env.PORT || process.env.REALTIME_PORT || "3001", 10);

const io = new Server(PORT, {
  cors: {
    origin: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Store active workspaces and their connections
const workspaces = new Map<string, Set<string>>();

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // ── Workspace events ──────────────────────────────────────────
  socket.on("join_workspace", (workspaceId: string) => {
    socket.join(`workspace:${workspaceId}`);
    if (!workspaces.has(workspaceId)) {
      workspaces.set(workspaceId, new Set());
    }
    workspaces.get(workspaceId)!.add(socket.id);
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
    io.to(`workspace:${workspaceId}`).emit("user_left", {
      userId: socket.id,
      timestamp: new Date(),
    });
  });

  socket.on("sync_update", (data) => {
    const { workspaceId, ...payload } = data;
    io.to(`workspace:${workspaceId}`).emit("sync_update", payload);
  });

  socket.on("presence", (data) => {
    const { workspaceId, ...payload } = data;
    io.to(`workspace:${workspaceId}`).emit("presence", payload);
  });

  socket.on("cursor", (data) => {
    const { workspaceId, ...payload } = data;
    io.to(`workspace:${workspaceId}`).emit("cursor", payload);
  });

  socket.on("chat_message", (data) => {
    const { workspaceId, ...payload } = data;
    io.to(`workspace:${workspaceId}`).emit("chat_message", payload);
  });

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

console.log(`Real-time server running on port ${PORT}`);
