# ColabCode - Quick Start Guide

## Prerequisites

- Node.js 18+ (recommended: 20 LTS)
- pnpm 9+
- PostgreSQL 13+
- Git

## Installation & Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd colabcode
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Setup Environment Variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```env
# Database - PostgreSQL connection
DATABASE_URL=postgresql://user:password@localhost:5432/colab_code

# Better Auth - Generate a random secret (min 32 chars)
AUTH_SECRET=your-very-secret-key-min-32-characters-long

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Frontend URLs
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_REALTIME_URL=http://localhost:3001

# Realtime Server
REALTIME_PORT=3001
NODE_ENV=development
```

### 4. Database Setup

Create the database and run migrations:

```bash
# Create PostgreSQL database
createdb colab_code

# Run migrations
pnpm db:migrate

# Seed with demo data
pnpm db:seed
```

### 5. Start Development Servers

In separate terminals:

```bash
# Terminal 1: Frontend (Next.js)
pnpm dev

# Terminal 2: Realtime Server
cd apps/realtime && pnpm dev
```

### 6. Access the Application

- **Frontend**: http://localhost:3000
- **Realtime Server**: ws://localhost:3001

### Demo Credentials

After running the seed, use these test accounts:

| Email               | Password    | Role   |
| ------------------- | ----------- | ------ |
| alice@example.com   | password123 | Owner  |
| bob@example.com     | password123 | Editor |
| charlie@example.com | password123 | Viewer |

## Project Structure

```
colabcode/
├── apps/
│   ├── web/                  # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/         # Pages and API routes
│   │   │   ├── components/  # React components
│   │   │   └── lib/         # Utilities
│   │   └── package.json
│   │
│   └── realtime/            # WebSocket/Yjs server
│       ├── src/
│       └── package.json
│
├── packages/
│   ├── db/                  # Prisma ORM
│   ├── shared/              # Types and constants
│   ├── validation/          # Zod schemas
│   └── ui/                  # Shared components
│
└── README.md
```

## Available Scripts

```bash
# Development
pnpm dev                 # Start all dev servers
pnpm dev --filter=@colab-code/web    # Frontend only
pnpm dev --filter=@colab-code/realtime  # Realtime only

# Building
pnpm build              # Build all packages
pnpm lint               # Lint all packages
pnpm typecheck          # Type check all packages

# Database
pnpm db:migrate         # Run database migrations
pnpm db:seed            # Seed demo data
pnpm db:studio          # Open Prisma Studio

# Testing
pnpm test               # Run all tests
```

## Architecture Overview

### Real-Time Collaboration Stack

```
┌─────────────────────────────────┐
│       Next.js Frontend          │
│    - React + Monaco Editor      │
│    - Yjs Documents              │
│    - Socket.IO Client           │
└──────────────┬──────────────────┘
               │ WebSocket
               ▼
┌─────────────────────────────────┐
│    Realtime Server              │
│    - Node.js + TypeScript       │
│    - Socket.IO Server           │
│    - Yjs Awareness              │
│    - Workspace Rooms            │
└──────────────┬──────────────────┘
               │ Prisma ORM
               ▼
┌─────────────────────────────────┐
│      PostgreSQL Database        │
│    - User Data                  │
│    - Workspaces                 │
│    - Files & Folders            │
│    - Chat Messages              │
│    - Snapshots                  │
└─────────────────────────────────┘
```

### Key Features

✅ **Real-Time Editing**

- Multiple users edit simultaneously using Yjs CRDT
- Changes sync with sub-second latency
- Automatic conflict resolution

✅ **Workspace Management**

- Create, organize, and share workspaces
- Hierarchical file/folder structure
- Multiple file tabs with syntax highlighting

✅ **User Collaboration**

- See collaborator cursors and selections
- Real-time presence indicators
- Workspace chat
- Workspace member management

✅ **Authentication & Authorization**

- Email/password login with Better Auth
- Google OAuth integration
- Role-based access control (Owner, Editor, Viewer)
- Server-side permission enforcement

✅ **Reliability**

- Automatic reconnection handling
- Offline-first with local storage
- Persistent storage in PostgreSQL
- Session recovery

## Development Phases

### ✅ Completed

1. Monorepo & TypeScript setup
2. Database schema & Prisma
3. Authentication with Better Auth
4. Workspace CRUD operations
5. File system & API routes
6. Monaco Editor integration
7. WebSocket server foundation

### 🚀 In Progress / Next

8. Yjs document synchronization
9. Real-time presence & cursors
10. Permission enforcement
11. Chat system
12. Error handling & reconnection
13. UI polish & responsiveness
14. Testing & verification

## Troubleshooting

### Database Connection Error

```bash
# Check PostgreSQL is running
psql postgres

# Verify database exists
\l

# Create if missing
createdb colab_code
```

### Port Already in Use

```bash
# Change REALTIME_PORT in .env.local
# Or kill existing process
lsof -i :3001
kill -9 <PID>
```

### Prisma Client Not Found

```bash
cd packages/db
pnpm install
pnpm exec prisma generate
```

### WebSocket Connection Fails

- Verify `NEXT_PUBLIC_REALTIME_URL` is correct
- Check realtime server is running on port 3001
- Check browser console for CORS errors

## API Endpoints

### Authentication

- `POST /api/auth/sign-up` - Register
- `POST /api/auth/sign-in` - Login
- `POST /api/auth/sign-out` - Logout
- `GET /api/auth/session` - Get current session

### Workspaces

- `GET /api/workspaces` - List user's workspaces
- `POST /api/workspaces` - Create workspace
- `GET /api/workspaces/:id` - Get workspace
- `PATCH /api/workspaces/:id` - Update workspace
- `DELETE /api/workspaces/:id` - Delete workspace

### Files

- `GET /api/workspaces/:id/files` - List files
- `POST /api/workspaces/:id/files` - Create file
- `GET /api/workspaces/:id/files/:fileId` - Get file
- `PATCH /api/workspaces/:id/files/:fileId` - Update file
- `DELETE /api/workspaces/:id/files/:fileId` - Delete file

### Folders

- `GET /api/workspaces/:id/folders` - List folders
- `POST /api/workspaces/:id/folders` - Create folder

## WebSocket Events

### Client → Server

- `join_workspace` - Join a workspace
- `leave_workspace` - Leave a workspace
- `sync_message` - CRDT sync message
- `presence_update` - Update cursor/selection
- `chat_message` - Send message

### Server → Client

- `sync_step_1` - Initial sync response
- `sync_message` - Broadcast sync updates
- `user_joined` - User joined workspace
- `user_left` - User left workspace
- `presence_update` - Broadcast presence
- `chat_message` - Broadcast chat message

## Performance Considerations

1. **Yjs Documents**: Kept in memory during active sessions, persisted to DB periodically
2. **WebSocket Messages**: Binary protocol to minimize bandwidth
3. **Database Writes**: Debounced to prevent thrashing (recommended 500ms-1s)
4. **File Size**: Tested up to 100KB files (large files may slow Yjs)

## Security Notes

✅ **Implemented**

- Zod input validation on all APIs
- Backend permission checks
- Secure session handling (HTTPOnly cookies)
- CORS configuration
- Rate limiting on messages

⚠️ **Production Deployment**

- Use HTTPS/TLS
- Set `NODE_ENV=production`
- Use secure `AUTH_SECRET` (min 32 random characters)
- Enable database backups
- Use environment-specific secrets
- Configure proper CORS origins

## Support & Resources

- **Yjs**: https://docs.yjs.dev/
- **Socket.IO**: https://socket.io/docs/
- **Prisma**: https://www.prisma.io/docs/
- **Next.js**: https://nextjs.org/docs/
- **Monaco**: https://microsoft.github.io/monaco-editor/

## License

MIT
