# Architecture Documentation

## System Overview

ColabCode is a production-grade real-time collaborative code editor built with modern web technologies. This document explains the architecture, data flow, and design decisions.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Client Layer                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Next.js + React                                 │  │
│  │  - Pages & Components                            │  │
│  │  - Monaco Editor                                 │  │
│  │  - Yjs Text Documents                            │  │
│  │  - Socket.IO Client                              │  │
│  │  - Zustand State Management                      │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │ WebSocket (Socket.IO)
                     │ - Sync Updates (Uint8Array)
                     │ - Presence Events (JSON)
                     │ - Chat Messages (JSON)
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Realtime Server Layer                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Node.js + Socket.IO                             │  │
│  │  - Connection Management                         │  │
│  │  - Workspace Rooms                               │  │
│  │  - Yjs Awareness                                 │  │
│  │  - Update Broadcasting                           │  │
│  │  - Presence Tracking                             │  │
│  └───────────────────────────────────────────────────┘  │
└────────────────────┬────────────────────────────────────┘
                     │ Prisma ORM
                     │ - Persistence
                     │ - Snapshots
                     │ - Chat History
                     ▼
┌─────────────────────────────────────────────────────────┐
│            Data Persistence Layer                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                             │  │
│  │  - Users & Sessions                              │  │
│  │  - Workspaces & Members                          │  │
│  │  - Files & Folders                               │  │
│  │  - Chat Messages                                 │  │
│  │  - Document Snapshots                            │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
colabcode/
├── apps/
│   ├── web                          # Next.js Frontend
│   │   ├── src/
│   │   │   ├── app/               # Page routes & API
│   │   │   │   ├── auth/          # Login/Register
│   │   │   │   ├── dashboard/     # Workspace list
│   │   │   │   ├── workspace/     # Editor interface
│   │   │   │   └── api/           # REST API routes
│   │   │   ├── components/        # React components
│   │   │   │   ├── MonacoEditor   # Code editor wrapper
│   │   │   │   ├── FileTree       # File explorer
│   │   │   │   └── ChatPanel      # Chat UI
│   │   │   ├── hooks/             # Custom React hooks
│   │   │   ├── lib/               # Utilities
│   │   │   │   ├── auth.ts        # Auth configuration
│   │   │   │   ├── db.ts          # Database queries
│   │   │   │   └── realtime.ts    # WebSocket client
│   │   │   └── store/             # Zustand state
│   │   └── package.json
│   │
│   └── realtime                     # WebSocket Server
│       ├── src/
│       │   ├── index.ts            # Server entry point
│       │   ├── workspace-room.ts   # Room management
│       │   ├── handlers/           # Event handlers
│       │   └── utils/              # Helpers
│       └── package.json
│
├── packages/
│   ├── db/                          # Database Layer
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # Database schema
│   │   │   └── migrations/         # Migration history
│   │   ├── src/
│   │   │   └── index.ts            # Export Prisma client
│   │   └── package.json
│   │
│   ├── shared/                      # Shared Code
│   │   ├── src/
│   │   │   ├── types.ts            # TypeScript types
│   │   │   └── constants.ts        # Constants
│   │   └── package.json
│   │
│   ├── validation/                  # Zod Schemas
│   │   ├── src/
│   │   │   └── index.ts            # Validation schemas
│   │   └── package.json
│   │
│   └── ui/                          # UI Components
│       ├── src/
│       │   └── index.ts
│       └── package.json
│
├── package.json                     # Root workspace
├── pnpm-workspace.yaml              # Workspace config
├── turbo.json                       # Turborepo config
├── tsconfig.json                    # Root TypeScript
├── .eslintrc.json                   # Linting config
├── .prettierrc                      # Formatting config
├── .gitignore
├── .env.example
├── README.md
├── SETUP.md
└── ARCHITECTURE.md                  # This file
```

## Data Flow: Document Editing

### The Challenge

When multiple users edit the same document simultaneously, ensuring consistency is critical. Traditional approaches fail:

**❌ Naive Approach (Last-Write-Wins)**

```
User A: types "hello"  → Server stores: "hello"
User B: types "world"  → Server stores: "world"
Result: User A's changes are lost
```

**✅ Our Approach (CRDT with Yjs)**

```
User A: types "hello" → Yjs generates unique ID for chars
User B: types "world" → Yjs generates unique ID for chars
Server: merges based on character IDs, not order
Result: Both changes preserved, merged correctly
```

### Synchronization Flow

```
┌─────────────────────────────────────────────────────┐
│  User A Types "A" in Editor                         │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  Local Yjs Document Updated                         │
│  - Generates unique char ID                         │
│  - Creates update array                             │
│  - Monaco editor receives change event              │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  WebSocket: Send Binary Update                      │
│  - Encodes update as Uint8Array                     │
│  - Sends only delta (typically <100 bytes)          │
└────────────────┬────────────────────────────────────┘
                 │ WebSocket
                 ▼
┌─────────────────────────────────────────────────────┐
│  Realtime Server                                    │
│  - Receives binary update                           │
│  - Merges into workspace Y.Doc                      │
│  - Broadcasts to all other clients                  │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────┐
│  User B Receives Binary Update                      │
│  - Decodes update array                             │
│  - Applies to local Yjs document                    │
│  - Monaco editor automatically re-renders           │
│  - User sees change instantly (no permission check) │
└─────────────────────────────────────────────────────┘
                 │
                 ▼ (500ms debounce)
┌─────────────────────────────────────────────────────┐
│  Persist to PostgreSQL                              │
│  - Final document state written to DB               │
│  - Survives server restart                          │
└─────────────────────────────────────────────────────┘
```

### Key Points

1. **Local Changes are Instant**: Users see their edits immediately in Monaco
2. **Remote Changes are Fast**: Updates broadcast in <50ms typically
3. **Conflict Resolution is Automatic**: Yjs handles concurrent edits deterministically
4. **No Last-Write-Wins**: All changes preserved in correct order
5. **Works Offline**: Edits accumulate locally and sync when reconnected

## Authentication & Authorization

### Session Flow

```
┌─────────────────────────────┐
│  User Registration          │
│  POST /api/auth/sign-up     │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Better Auth                │
│  - Hash password (bcryptjs) │
│  - Create session           │
│  - Set HTTPOnly cookie      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│  Redirect to Dashboard      │
│  - Cookie sent with request │
│  - Session validated        │
└─────────────────────────────┘
```

### Permission Hierarchy

```
OWNER (Can do everything)
├── Edit files
├── Create/Delete files
├── Create/Delete folders
├── Invite/Remove members
├── Change member roles
└── Delete workspace

EDITOR (Can edit)
├── Edit files
├── Create/Delete files
├── Create/Delete folders
└── Send chat messages

VIEWER (Can read only)
├── View files
├── Read chat
└── See online presence
```

### Permission Enforcement

All permission checks happen on the **backend**:

```typescript
// In API route
const hasPermission = await verifyWorkspacePermission(
  workspaceId,
  userId,
  "EDITOR"  // Required role
);

if (!hasPermission) {
  return 403 Forbidden;
}

// WebSocket server also checks
room.addUser(userId, socket, userData);
if (!hasPermission) {
  socket.disconnect();
}
```

**Never trust client-side checks!**

## Real-Time Collaboration Architecture

### Workspace Rooms

Each workspace has an isolated **room** with its own:

```typescript
class WorkspaceRoom {
  id: string; // Workspace ID
  doc: Y.Doc; // Shared CRDT document
  awareness: Awareness; // Presence tracking
  users: Map<string, UserData>; // Connected users
}
```

### Why Rooms?

1. **Isolation**: Workspace A events never reach Workspace B
2. **Memory Efficiency**: Only active workspaces loaded in memory
3. **Scalability**: Can route rooms to different servers
4. **Privacy**: Data leakage prevention

### Presence & Awareness

Yjs **Awareness** tracks real-time user presence:

```javascript
// User A broadcasts awareness
awareness.setLocalState({
  user: {
    id: "user-123",
    name: "Alice",
    email: "alice@example.com"
  },
  cursor: {
    fileId: "file-456",
    line: 24,
    column: 8,
    selection: { ... }
  }
});

// All other users receive this immediately
awareness.on("change", (changes) => {
  // Update UI with cursors
  renderCollaboratorCursors(changes);
});
```

## Database Schema

### User Model

```prisma
model User {
  id        String    @id @default(cuid())
  email     String    @unique
  name      String?
  password  String    // Hashed with bcryptjs
  image     String?   // Avatar URL
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}
```

### Workspace Model

```prisma
model Workspace {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique              // URL-friendly slug
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members   WorkspaceMember[]
  files     File[]
  folders   Folder[]
  messages  ChatMessage[]
  snapshots WorkspaceSnapshot[]
}
```

### File & Folder Hierarchy

```prisma
model File {
  id          String   @id @default(cuid())
  name        String
  content     String   @default("")       // Latest content
  language    String   @default("javascript")
  workspaceId String
  folderId    String?                     // Nested in folder
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Folder {
  id          String   @id @default(cuid())
  name        String
  workspaceId String
  parentId    String?                     // Nested folders
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}
```

### Snapshot (For Recovery)

```prisma
model WorkspaceSnapshot {
  id          String   @id @default(cuid())
  workspaceId String
  state       Json     // Serialized Yjs state
  version     Int      // Document version
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([workspaceId, version])  // One snapshot per version
}
```

## Persistence Strategy

### The Problem

Writing to PostgreSQL on every keystroke would:

- Cause database overload
- Waste bandwidth
- Create redundant writes
- Slow down real-time responsiveness

### Our Solution

```
User Types
    │
    ├─→ Update Yjs Document (instant)
    │   └─→ Update Monaco Editor (instant)
    │
    ├─→ WebSocket Broadcast (50ms)
    │   └─→ Other users see change
    │
    ├─→ Debounce Timer (500ms)
    │   └─→ Persist to PostgreSQL
    │
    └─→ (If offline, buffer locally)
        └─→ Sync on reconnect
```

### Key Points

1. **Yjs is Source of Truth** during collaboration
2. **PostgreSQL is the Archive** for durability
3. **Debouncing Prevents Thrashing** (500ms recommended)
4. **On Disconnect, Persist Immediately** before losing data
5. **On Reconnect, Load from Latest Snapshot** and sync deltas

### Reconnection Recovery

```
Client Disconnects
    │
    ▼
Buffer local edits locally
    │
    ▼
Connection Restored
    │
    ├─→ Re-authenticate with token
    │
    ├─→ Join workspace room again
    │
    ├─→ Receive latest document state
    │
    └─→ Apply buffered edits
        └─→ Automatic sync with others
```

## Security Architecture

### Input Validation

All inputs validated with **Zod** schemas:

```typescript
const CreateWorkspaceSchema = z.object({
  name: z.string().min(1).max(255),
});

// Frontend
const data = CreateWorkspaceSchema.parse(input);

// Backend
const data = CreateWorkspaceSchema.parse(body);
```

### Authentication

- Passwords hashed with **bcryptjs**
- Sessions managed by **Better Auth**
- HTTPOnly cookies (prevents XSS)
- CSRF protection via tokens

### Authorization

- All APIs verify user has permission
- WebSocket connections authenticated
- Room access controlled
- Role checks on every operation

```typescript
// Before any modification
const hasPermission = await verifyWorkspacePermission(workspaceId, userId, requiredRole);
if (!hasPermission) throw new Error("Forbidden");
```

## Performance Optimizations

### 1. Yjs Document Compression

- Binary protocol (not JSON)
- Delta encoding (only changes sent)
- Automatic garbage collection

### 2. WebSocket Binary Frames

- Uint8Array instead of JSON
- ~70% bandwidth reduction
- Faster parsing

### 3. Room Isolation

- Workspace rooms isolated in memory
- Only active rooms loaded
- Automatic cleanup when empty

### 4. Database Indexing

```prisma
// Indexes on common queries
@@index([workspaceId])
@@index([userId])
@@index([email])
@@unique([workspaceId, userId])
```

### 5. Pagination Ready

- Query structure supports pagination
- Avoid loading all files at once
- Stream large file listings

## Scaling Considerations

### Current Limitations (Single Server)

✅ Suitable for:

- Up to 100 concurrent users
- Workspaces < 100MB
- < 1000 files per workspace

⚠️ Constraints:

- All rooms in single process memory
- No distributed state
- Sticky WebSocket sessions required

### Future Scaling (Multi-Server)

To scale beyond single server:

1. **Add Redis** for distributed Yjs state
2. **Message Queue** (RabbitMQ/Kafka) for events
3. **Load Balancer** with sticky sessions
4. **Separate API & Realtime** servers
5. **Database Replication** for HA

_Note: Current spec prohibits Redis, so single-server deployment is the constraint_

## Error Handling

### Categories

**Client Errors (4xx)**

```
400 Bad Request    - Invalid input
401 Unauthorized   - Not authenticated
403 Forbidden      - No permission
404 Not Found      - Resource missing
409 Conflict       - Duplicate operation
```

**Server Errors (5xx)**

```
500 Internal Error - Unexpected failure
502 Bad Gateway    - Upstream unavailable
503 Unavailable    - Server down for maintenance
```

### Resilience

- ✅ Automatic WebSocket reconnection (exponential backoff)
- ✅ Client-side error boundary components
- ✅ Fallback UI states (loading, error, empty)
- ✅ Optimistic updates (revert on failure)
- ✅ Request retry logic

## Testing Strategy

### Unit Tests

- Validation schemas (Zod)
- Permission logic
- Utility functions
- Hooks (custom React)

### Integration Tests

- API endpoints
- Database operations
- Auth flows
- WebSocket events

### E2E Tests

- Two-user collaboration
- File creation/editing
- Permission changes
- Reconnection recovery
- Chat functionality

## Future Enhancements

1. **Code Execution** - Run Python/JavaScript in sandbox
2. **Code Comments** - Inline annotations and discussions
3. **Version History** - Track file changes over time
4. **Search & Replace** - Workspace-wide search
5. **Extensions** - Plugin system for editors
6. **Webhooks** - Integration with external services
7. **AI Integration** - Code suggestions and completions
8. **Mobile Support** - Touch-optimized interface
9. **Offline Mode** - Full app works without internet
10. **Analytics** - Usage metrics and insights

---

**Built with ❤️ for teams that code together**
