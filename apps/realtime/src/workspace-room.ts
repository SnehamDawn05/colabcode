import { Server as HTTPServer, createServer } from "http";
import { Server, Socket } from "socket.io";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync.js";
import * as awarenessProtocol from "y-protocols/awareness.js";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

export interface RoomUser {
  socket: Socket;
  id?: string;
  name?: string;
  email?: string;
  [key: string]: unknown;
}

export interface PresencePayload {
  userId: string;
  fileId?: string;
  line: number;
  column: number;
}

export interface ChatMessagePayload {
  id: string;
  content: string;
  userId: string;
  userName: string;
}

export class WorkspaceRoom {
  public id: string;
  public doc: Y.Doc;
  public awareness: awarenessProtocol.Awareness;
  public users: Map<string, RoomUser> = new Map();
  private io: Server;

  constructor(id: string, io: Server) {
    this.id = id;
    this.io = io;
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);

    // Setup awareness change handler
    this.awareness.on(
      "change",
      (changes: { added: number[]; updated: number[]; removed: number[] }) => {
        const changedClients = changes.added.concat(changes.updated, changes.removed);
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 1); // message type: awareness
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
        );
        this.broadcast(encoding.toUint8Array(encoder));
      }
    );

    // Setup doc update handler
    this.doc.on("update", (update: Uint8Array) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0); // message type: sync update
      encoding.writeVarUint8Array(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder));
    });
  }

  addUser(userId: string, socket: Socket, userData: Omit<RoomUser, "socket">) {
    this.users.set(userId, {
      socket,
      ...userData,
    });

    // Send initial sync state
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0);
    syncProtocol.writeSyncStep1(encoder, this.doc);
    socket.emit("sync_step_1", encoding.toUint8Array(encoder));

    // Send awareness
    const awarenessEncoder = encoding.createEncoder();
    encoding.writeVarUint(awarenessEncoder, 1);
    encoding.writeVarUint8Array(
      awarenessEncoder,
      awarenessProtocol.encodeAwarenessUpdate(
        this.awareness,
        Array.from(this.awareness.getStates().keys())
      )
    );
    socket.emit("awareness_update", encoding.toUint8Array(awarenessEncoder));
  }

  removeUser(userId: string) {
    const user = this.users.get(userId);
    if (user) {
      this.awareness.setLocalState(null);
      this.users.delete(userId);
    }
  }

  handleSync(message: Uint8Array, userId: string) {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    if (messageType === 0) {
      // Sync step 1
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, 0);
      syncProtocol.writeSyncStep1(encoder, this.doc);
      const user = this.users.get(userId);
      if (user) {
        user.socket.emit("sync_step_1", encoding.toUint8Array(encoder));
      }
    } else if (messageType === 1) {
      // Sync step 2
      const encoder = encoding.createEncoder();
      syncProtocol.readSyncStep2(decoder, this.doc, encoder);
    } else if (messageType === 2) {
      // Update
      const update = decoding.readVarUint8Array(decoder);
      Y.applyUpdate(this.doc, update);
    }
  }

  broadcast(message: Uint8Array, excludeUserId?: string) {
    this.users.forEach((user, userId) => {
      if (excludeUserId && userId === excludeUserId) return;
      user.socket.emit("sync_message", message);
    });
  }

  getState() {
    return {
      userCount: this.users.size,
      users: Array.from(this.users.values()).map((u) => ({
        id: u.socket.id,
        name: u.name,
        email: u.email,
      })),
    };
  }
}

export class RealtimeServer {
  private io: Server;
  private rooms: Map<string, WorkspaceRoom> = new Map();
  private userToRoom: Map<string, string> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`[Socket] Client connected: ${socket.id}`);

      socket.on(
        "join_workspace",
        (data: { workspaceId: string; user: Omit<RoomUser, "socket"> & { id: string } }) => {
          const { workspaceId, user } = data;

          // Get or create room
          if (!this.rooms.has(workspaceId)) {
            this.rooms.set(workspaceId, new WorkspaceRoom(workspaceId, this.io));
          }

          const room = this.rooms.get(workspaceId)!;
          room.addUser(user.id, socket, user);

          socket.join(`workspace:${workspaceId}`);
          this.userToRoom.set(socket.id, workspaceId);

          console.log(`[Room] User ${user.id} joined workspace ${workspaceId}`);

          // Notify others
          this.io.to(`workspace:${workspaceId}`).emit("user_joined", {
            userId: user.id,
            userName: user.name,
            timestamp: new Date(),
            state: room.getState(),
          });
        }
      );

      socket.on("leave_workspace", (workspaceId: string) => {
        socket.leave(`workspace:${workspaceId}`);

        const room = this.rooms.get(workspaceId);
        if (room) {
          // Find user by socket
          let userId: string | null = null;
          for (const [uid, u] of room.users) {
            if (u.socket.id === socket.id) {
              userId = uid;
              break;
            }
          }

          if (userId) {
            room.removeUser(userId);
            console.log(`[Room] User ${userId} left workspace ${workspaceId}`);

            this.io.to(`workspace:${workspaceId}`).emit("user_left", {
              userId,
              timestamp: new Date(),
              state: room.getState(),
            });

            // Cleanup empty room
            if (room.users.size === 0) {
              this.rooms.delete(workspaceId);
            }
          }
        }

        this.userToRoom.delete(socket.id);
      });

      socket.on("sync_message", (message: Uint8Array) => {
        const workspaceId = this.userToRoom.get(socket.id);
        if (!workspaceId) return;

        const room = this.rooms.get(workspaceId);
        if (!room) return;

        // Find user ID for this socket
        let userId: string | null = null;
        for (const [uid, u] of room.users) {
          if (u.socket.id === socket.id) {
            userId = uid;
            break;
          }
        }

        if (userId) {
          room.handleSync(message, userId);
        }
      });

      socket.on("presence_update", (data: PresencePayload) => {
        const workspaceId = this.userToRoom.get(socket.id);
        if (!workspaceId) return;

        this.io.to(`workspace:${workspaceId}`).emit("presence_update", {
          userId: data.userId,
          fileId: data.fileId,
          line: data.line,
          column: data.column,
          timestamp: new Date(),
        });
      });

      socket.on("chat_message", (data: ChatMessagePayload) => {
        const workspaceId = this.userToRoom.get(socket.id);
        if (!workspaceId) return;

        this.io.to(`workspace:${workspaceId}`).emit("chat_message", {
          id: data.id,
          content: data.content,
          userId: data.userId,
          userName: data.userName,
          timestamp: new Date(),
        });
      });

      socket.on("disconnect", () => {
        const workspaceId = this.userToRoom.get(socket.id);
        if (workspaceId) {
          socket.leave(`workspace:${workspaceId}`);

          const room = this.rooms.get(workspaceId);
          if (room) {
            let userId: string | null = null;
            for (const [uid, u] of room.users) {
              if (u.socket.id === socket.id) {
                userId = uid;
                break;
              }
            }

            if (userId) {
              room.removeUser(userId);
              this.io.to(`workspace:${workspaceId}`).emit("user_left", {
                userId,
                timestamp: new Date(),
                state: room.getState(),
              });

              if (room.users.size === 0) {
                this.rooms.delete(workspaceId);
              }
            }
          }
        }

        this.userToRoom.delete(socket.id);
        console.log(`[Socket] Client disconnected: ${socket.id}`);
      });
    });
  }

  listen(port: number) {
    return new Promise<void>((resolve) => {
      const httpServer = createServer();
      this.io.attach(httpServer);
      httpServer.listen(port, () => {
        console.log(`🚀 Realtime server listening on port ${port}`);
        resolve();
      });
    });
  }
}
