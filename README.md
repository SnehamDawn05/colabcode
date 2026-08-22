# ColabCode - Real-Time Collaborative Code Editor

A production-grade real-time collaborative code editor similar to VS Code + Google Docs, enabling multiple users to work on the same coding workspace simultaneously.

## 🎯 Features

### Core Collaboration

- **Real-time synchronization** using Yjs CRDT for conflict-free concurrent editing
- **Multiple users editing** the same file simultaneously
- **Collaborator cursors** - See where other users are editing
- **Presence indicators** - Know who's online and working
- **Real-time chat** - Communicate within the workspace

### Workspace Management

- Create and manage coding workspaces
- Hierarchical file/folder structure
- Multiple file tabs with syntax highlighting
- Support for 17+ programming languages

### User & Permission Management

- Email/password authentication with Better Auth
- Google OAuth integration (optional)
- Three permission levels: Owner, Editor, Viewer
- Member role management
- Workspace sharing via secure links

### Editor Features

- Monaco Editor integration
- Dark/Light theme support
- Syntax highlighting for multiple languages
- Code folding, minimap, word wrap
- Customizable font size and tab width
- Line numbers and bracket matching

### Reliability

- Automatic reconnection handling
- Persistent storage with PostgreSQL
- Offline support with local state
- Browser refresh resilience

## 🏗️ Architecture

### High-Level Flow

```
┌─────────────────────┐
│   Next.js Frontend  │
│  (React + Monaco)   │
└──────────┬──────────┘
           │ WebSocket
           ▼
┌─────────────────────┐
│  Realtime Server    │
│ (Node.js + Socket.IO) │
│   + Yjs Sync        │
└──────────┬──────────┘
           │ Prisma ORM
           ▼
┌─────────────────────┐
│   PostgreSQL DB     │
└─────────────────────┘
```

## 🐳 Docker Quickstart (Run with 1 Command)

You can run the entire ColabCode stack (Frontend, Realtime WebSocket Server, PostgreSQL, and Auto-Migration/Seeding) with Docker Compose:

```bash
docker compose up --build
```

- **Frontend Web App**: [http://localhost:3000](http://localhost:3000)
- **Realtime Server**: [http://localhost:3001](http://localhost:3001)
- **Auto-seeded demo account**: `alice@example.com` / `password123`

For advanced configuration, logs, and troubleshooting, see [DOCKER.md](file:///d:/colabcode/DOCKER.md).

### Technology Stack

#### Frontend

- **Next.js 14** - React framework with server components
- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Monaco Editor** - Professional code editor
- **Yjs** - CRDT library for collaboration
- **Socket.IO Client** - WebSocket communication
- **Zustand** - State management
- **Zod** - Schema validation

#### Backend

- **Node.js + TypeScript** - Runtime
- **Socket.IO** - Real-time WebSocket server
- **Yjs** - Distributed state management
- **Better Auth** - Authentication
- **Prisma ORM** - Database abstraction
- **PostgreSQL** - Primary data store

#### Package Management & Build

- **pnpm** - Fast package manager
- **Turborepo** - Monorepo orchestration
- **TypeScript** - Strict mode enabled

### Monorepo Structure

```
colab-code/
├── apps/
│   ├── web/                    # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/           # Pages and layouts
│   │   │   ├── components/    # React components
│   │   │   ├── lib/           # Utilities
│   │   │   └── hooks/         # Custom hooks
│   │   └── package.json
│   │
│   └── realtime/               # WebSocket server
│       ├── src/
│       │   ├── index.ts       # Server entry point
│       │   ├── rooms/         # Workspace rooms
│       │   ├── handlers/      # Event handlers
│       │   └── utils/         # Helpers
│       └── package.json
│
├── packages/
│   ├── db/                    # Database layer
│   │   ├── src/
│   │   ├── prisma/
│   │   │   └── schema.prisma  # Database schema
│   │   └── package.json
│   │
│   ├── shared/                 # Shared types & constants
│   │   ├── src/
│   │   │   ├── types.ts
│   │   │   └── constants.ts
│   │   └── package.json
│   │
│   ├── validation/             # Zod schemas
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── ui/                    # Reusable components
│       ├── src/
│       └── package.json
│
├── package.json               # Root workspace
├── pnpm-workspace.yaml        # Workspace config
├── turbo.json                 # Turborepo config
├── tsconfig.json              # Root TypeScript config
└── README.md
```

## 📊 Database Schema

### Key Models

**User**

- id, email, name, password, image, createdAt, updatedAt

**Workspace**

- id, name, slug (unique), createdAt, updatedAt

**WorkspaceMember**

- id, workspaceId, userId, role (OWNER/EDITOR/VIEWER), joinedAt, updatedAt

**File**

- id, name, content, language, workspaceId, folderId, createdAt, updatedAt

**Folder**

- id, name, workspaceId, parentId, createdAt, updatedAt

**ChatMessage**

- id, content, workspaceId, userId, createdAt, updatedAt

**WorkspaceSnapshot**

- id, workspaceId, state (JSON), version, createdAt, updatedAt

**Session**

- id, userId, token, expiresAt, createdAt, updatedAt

## 🔄 Real-Time Synchronization

### Yjs / CRDT Strategy

We use **Yjs**, a battle-tested CRDT (Conflict-free Replicated Data Type) library, to handle concurrent document editing:

1. **Document State**: Each file is a Yjs Y.Text for character-level synchronization
2. **Awareness Protocol**: Track cursor positions and selections of all users
3. **Update Broadcasting**: Changes are broadcast as delta updates (small diffs, not entire documents)
4. **Automatic Merging**: Concurrent edits from different users merge correctly without manual conflict resolution
5. **Offline Support**: Local edits accumulate in Yjs and sync when connection restores

### Synchronization Flow

```
User A Types
    ↓
Local Yjs Document Updated
    ↓
Update Event Generated
    ↓
Send Delta Update via WebSocket
    ↓
Realtime Server Receives Update
    ↓
Broadcast to Workspace
    ↓
User B Yjs Document Merges Update
    ↓
Monaco Editor Re-renders
```

### Why Not Naive Sync?

❌ **Naive**: Send entire file on every keystroke

- Huge bandwidth waste
- Race conditions with concurrent edits
- Last-write-wins loses data

✅ **CRDT with Yjs**: Send only diffs

- Efficient (kilobytes vs megabytes)
- Automatic conflict resolution
- Works offline
- Battle-tested in production apps

## 🔐 Authentication & Authorization

### Authentication Flow

1. **Register/Login** → Better Auth handles credentials
2. **Session Token** → Stored in cookies (HTTPOnly)
3. **WebSocket Auth** → Token passed on connection
4. **Backend Validation** → Verify token before allowing operations

### Authorization Levels

**OWNER**

- All permissions
- Invite/remove members
- Change member roles
- Delete workspace

**EDITOR**

- Edit files
- Create/delete files
- Create/delete folders
- Send chat messages

**VIEWER**

- View files
- Read chat
- Cannot edit or create

### Backend Enforcement

- All API endpoints check user permissions
- WebSocket events validate user role for workspace
- Permission checks on file operations
- Rate limiting on chat messages

## 💾 Persistence Strategy

### The Challenge

Real-time collaboration must not depend entirely on PostgreSQL. Hitting the database on every keystroke would be:

- Extremely slow
- Inefficient
- Unnecessary

### Our Approach

```
Editor Changes
     ↓
Yjs Document (In-Memory)
     ↓
WebSocket Sync to All Clients
     ↓
    ✓ Real-time (Instant to users)
     ↓
Debounced Persistence (500ms)
     ↓
PostgreSQL Update
     ↓
    ✓ Durable (Survives server restart)
```

### Key Principles

1. **Yjs is the Source of Truth** during collaboration
2. **PostgreSQL is the Archive** - stores final state
3. **Debouncing** prevents database thrashing
4. **On Disconnect**, persist final state
5. **On Reconnect**, load latest state from Yjs snapshot

### File Persistence

Files are persisted:

- When last user leaves workspace
- On explicit "Save" action
- Periodically (every 30 seconds of activity)
- When server shuts down

## 🌐 WebSocket Architecture

### Connection Lifecycle

```
Client Connects
     ↓
Send Auth Token
     ↓
Server Validates Token
     ↓
Authenticate Socket
     ↓
Join Workspace Room
     ↓
Load Document State from Yjs
     ↓
Sync Document to Client
     ↓
Receive/Broadcast Updates
     ↓
Client Leaves or Disconnects
```

### Message Types

| Type              | Direction       | Payload           | Purpose                  |
| ----------------- | --------------- | ----------------- | ------------------------ |
| `auth`            | Client → Server | token             | Authenticate connection  |
| `join_workspace`  | Client → Server | workspaceId       | Join workspace room      |
| `leave_workspace` | Client → Server | workspaceId       | Leave workspace          |
| `sync_update`     | Bidirectional   | Yjs update        | Document synchronization |
| `presence`        | Bidirectional   | user, status      | Online/offline status    |
| `cursor`          | Bidirectional   | fileId, line, col | Cursor position          |
| `chat_message`    | Bidirectional   | content, userId   | Chat message             |

### Room Isolation

- Each workspace is a separate Socket.IO room: `workspace:{id}`
- Users only receive events for their joined workspaces
- No workspace data crosses room boundaries
- Server maintains separate Yjs documents per workspace

## 🚀 Local Setup

### Prerequisites

- Node.js 18+
- pnpm 9+
- PostgreSQL 13+
- Git

### Installation

1. **Clone & Install**

   ```bash
   git clone <repo>
   cd colab-code
   pnpm install
   ```

2. **Environment Setup**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

3. **Database Setup**

   ```bash
   pnpm db:migrate
   pnpm db:seed
   ```

4. **Run Development**

   ```bash
   # Terminal 1: Frontend
   pnpm dev

   # Terminal 2: Realtime server
   cd apps/realtime && pnpm dev
   ```

5. **Access**
   - Frontend: http://localhost:3000
   - Realtime Server: ws://localhost:3001

## 📋 Environment Variables

### Root `.env.local`

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/colab_code

# Auth
AUTH_SECRET=min-32-chars-secret-key-here
GOOGLE_CLIENT_ID=your-google-id
GOOGLE_CLIENT_SECRET=your-google-secret

# URLs
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_REALTIME_URL=http://localhost:3001

# Server
REALTIME_PORT=3001
NODE_ENV=development
```

## 🧪 Testing

### Run Tests

```bash
pnpm test
```

### Test Suites

**Backend Tests**

- Authentication flows
- Workspace CRUD
- Permission checks
- File operations

**Realtime Tests**

- User joins workspace
- User leaves workspace
- Concurrent document edits
- Presence updates
- Reconnection recovery

**Frontend Tests**

- Workspace creation
- File operations
- Editor loading
- Chat interactions
- Permission states

## 🔧 Development Scripts

```bash
pnpm dev              # Start dev servers
pnpm build            # Build all packages
pnpm lint             # Lint all packages
pnpm typecheck        # Type check all packages
pnpm test             # Run tests
pnpm db:migrate       # Run DB migrations
pnpm db:seed          # Seed development data
pnpm db:studio        # Open Prisma Studio
```

## 📈 Development Phases

### Phase 1: Foundation ✅

- Monorepo setup
- TypeScript configuration
- Basic Next.js app
- Prisma database setup

### Phase 2: Dashboard

- Workspace CRUD
- User dashboard
- Workspace listing

### Phase 3: File System

- Files/folders management
- File tree component
- Tab system

### Phase 4: Monaco Integration

- Editor setup
- Language detection
- Settings panel

### Phase 5: Realtime Server

- WebSocket setup
- Authentication
- Room management

### Phase 6: Yjs Collaboration

- Shared documents
- Monaco/Yjs binding
- Synchronization

### Phase 7: Presence

- Online users display
- Cursor sharing
- Selection indicators

### Phase 8: Permissions

- Role implementation
- Backend enforcement
- WebSocket validation

### Phase 9: Chat

- Real-time messaging
- Message persistence
- Rate limiting

### Phase 10-13: Polish & Testing

- Error handling
- Reconnection
- Tests
- UI refinement

## 🎯 Key Engineering Decisions

### Why Yjs over Custom CRDT?

Yjs is a proven, battle-tested library used by Google Docs, Microsoft Word, and other production editors. Building a custom CRDT would require:

- Extensive testing
- Performance optimization
- Conflict resolution algorithms
- Offline support

Yjs gives us all this out of the box.

### Why Socket.IO over Raw WebSockets?

Socket.IO provides:

- Automatic reconnection
- Fallback protocols
- Room management
- Built-in compression

This saves significant engineering time compared to managing raw WebSockets.

### Why No Redis?

The specification explicitly forbids Redis to keep the architecture simple:

- PostgreSQL for persistence
- Yjs for real-time state
- WebSockets for broadcasting

This is sufficient for a single-instance deployment. Scaling would require Redis, but adding it prematurely violates the architecture constraint.

### Why Monorepo?

Monorepo with Turborepo enables:

- Shared packages across frontend/backend
- Consistent types and validation
- Single version control
- Efficient builds

## 🛡️ Security Considerations

✅ **Implemented**

- Zod input validation
- Permission checks on all operations
- Secure session handling
- HTTPOnly cookies for auth tokens
- CORS configuration
- Rate limiting on chat

❌ **Not Implemented (Out of Scope)**

- Rate limiting on file operations (easily added)
- SQL injection protection (Prisma handles this)
- XSS protection (React & Monaco handle this)
- HTTPS/TLS (deployment layer)

## ⚠️ Known Limitations

1. **Single-Server Deployment**: WebSockets require sticky sessions. Multiple servers need Redis (which is prohibited by the spec).
2. **Large File Handling**: Yjs keeps entire document in memory. Very large files (>100MB) may cause issues.
3. **Concurrent Cursor Updates**: High frequency cursor updates may cause network overhead.
4. **Browser Storage**: Relies on localStorage/IndexedDB - subject to browser limits.

## 🚀 Future Improvements

1. **Real-Time Linting**: Integrated error checking
2. **Code Execution**: Run code in isolated environments
3. **Debug Support**: Integrated debugging for Python/JavaScript
4. **Version History**: Track file changes over time
5. **Search & Replace**: Workspace-wide search
6. **Comments & Annotations**: Inline code comments
7. **AI Integration**: Copilot-like suggestions
8. **Performance Monitoring**: Telemetry and analytics
9. **Data Export**: Export workspace as ZIP
10. **Mobile Support**: Touch-optimized interface

## 📚 References

- [Yjs Documentation](https://docs.yjs.dev/)
- [Socket.IO Docs](https://socket.io/docs/v4/)
- [Prisma ORM](https://www.prisma.io/docs/)
- [Next.js](https://nextjs.org/docs)
- [Monaco Editor API](https://microsoft.github.io/monaco-editor/docs.html)

## 📄 License

MIT

---

**Built with ❤️ for teams who code together**
