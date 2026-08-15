// WebSocket message types
export type WebSocketMessage =
  | { type: "auth"; payload: { token: string } }
  | { type: "join_workspace"; payload: { workspaceId: string } }
  | { type: "leave_workspace"; payload: { workspaceId: string } }
  | { type: "sync_update"; payload: unknown }
  | { type: "presence"; payload: PresenceUpdate }
  | { type: "cursor"; payload: CursorUpdate }
  | { type: "chat_message"; payload: { content: string; fileId?: string } }
  | { type: "ping" };

export interface PresenceUpdate {
  userId: string;
  userName: string;
  userImage?: string;
  workspaceId: string;
  fileId?: string;
  status: "online" | "away" | "offline";
}

export interface CursorUpdate {
  userId: string;
  fileId: string;
  line: number;
  column: number;
  selection?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
}

export interface CollaborativeFile {
  id: string;
  name: string;
  language: string;
  content: string;
  version: number;
}

export interface WorkspaceState {
  workspaceId: string;
  files: Map<string, CollaborativeFile>;
  presence: Map<string, PresenceUpdate>;
  cursors: Map<string, CursorUpdate>;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}
