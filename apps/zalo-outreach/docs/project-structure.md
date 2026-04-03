# Zalo Outreach — Project Structure

```
apps/zalo-outreach/
│
├── manifest.json                          # Plugin Protocol manifest
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── .env.example
├── README.md
├── CHANGELOG.md
│
├── docs/                                  # Tài liệu
│   ├── routes-and-api.md                  # Routes + API spec
│   └── project-structure.md               # File này
│
├── prisma/
│   ├── schema.prisma                      # Database schema
│   ├── migrations/                        # Migration history
│   └── seed.ts                            # Seed data
│
├── public/
│   ├── assets/
│   │   ├── icon.svg                       # App icon
│   │   └── logo.svg
│   └── fonts/
│       └── inter-var.woff2                # Self-hosted font
│
├── src/
│   ├── app/                               # Next.js App Router (Frontend)
│   │   ├── layout.tsx                     # Root layout
│   │   ├── globals.css                    # Global styles + CSS variables
│   │   ├── page.tsx                       # / → redirect to /dashboard
│   │   ├── login/
│   │   │   └── page.tsx                   # Đăng nhập Zalo QR
│   │   ├── (app)/                         # Protected layout group
│   │   │   ├── layout.tsx                 # Sidebar + Header layout
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── groups/
│   │   │   │   ├── page.tsx               # Danh sách nhóm
│   │   │   │   ├── scan/
│   │   │   │   │   └── page.tsx           # Quét nhóm mới
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx           # Chi tiết nhóm
│   │   │   ├── contacts/
│   │   │   │   ├── page.tsx               # Tất cả contacts
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx           # Chi tiết contact
│   │   │   ├── campaigns/
│   │   │   │   ├── page.tsx               # Danh sách campaigns
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx           # Tạo campaign (wizard)
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx           # Chi tiết campaign
│   │   │   ├── templates/
│   │   │   │   ├── page.tsx               # Quản lý templates
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx           # Tạo template
│   │   │   │   └── [id]/
│   │   │   │       └── edit/
│   │   │   │           └── page.tsx       # Sửa template
│   │   │   ├── conversations/
│   │   │   │   ├── page.tsx               # Inbox
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx           # Chat detail
│   │   │   ├── accounts/
│   │   │   │   └── page.tsx               # Quản lý tài khoản Zalo
│   │   │   └── settings/
│   │   │       └── page.tsx               # Cài đặt
│   │   ├── embed/                         # Hub embed routes
│   │   │   ├── widget/
│   │   │   │   └── page.tsx               # Widget cho Hub dashboard
│   │   │   ├── full/
│   │   │   │   └── page.tsx               # Full page embed
│   │   │   └── settings/
│   │   │       └── page.tsx               # Settings embed
│   │   └── api/                           # API Routes
│   │       ├── health/
│   │       │   └── route.ts               # GET /health
│   │       ├── manifest/
│   │       │   └── route.ts               # GET /manifest
│   │       ├── execute/
│   │       │   └── route.ts               # POST /execute
│   │       ├── jobs/
│   │       │   └── [id]/
│   │       │       ├── route.ts           # GET /jobs/:id
│   │       │       └── cancel/
│   │       │           └── route.ts       # DELETE /jobs/:id/cancel
│   │       ├── webhooks/
│   │       │   └── events/
│   │       │       └── route.ts           # POST /webhooks/events
│   │       ├── auth/
│   │       │   ├── qr/
│   │       │   │   └── route.ts           # POST /api/auth/qr
│   │       │   └── session/
│   │       │       └── route.ts           # POST /api/auth/session
│   │       ├── accounts/
│   │       │   ├── route.ts               # GET, POST
│   │       │   └── [id]/
│   │       │       ├── route.ts           # GET, PUT, DELETE
│   │       │       ├── refresh/
│   │       │       │   └── route.ts       # POST
│   │       │       └── status/
│   │       │           └── route.ts       # GET
│   │       ├── groups/
│   │       │   ├── route.ts               # GET
│   │       │   └── [id]/
│   │       │       ├── route.ts           # GET, PUT, DELETE
│   │       │       ├── rescan/
│   │       │       │   └── route.ts       # POST
│   │       │       └── members/
│   │       │           └── route.ts       # GET
│   │       ├── scan/
│   │       │   ├── route.ts               # POST (start), GET (history)
│   │       │   └── [jobId]/
│   │       │       └── route.ts           # GET, DELETE
│   │       ├── contacts/
│   │       │   ├── route.ts               # GET
│   │       │   ├── export/
│   │       │   │   └── route.ts           # POST
│   │       │   ├── bulk-action/
│   │       │   │   └── route.ts           # POST
│   │       │   └── [id]/
│   │       │       ├── route.ts           # GET, PUT, DELETE
│   │       │       ├── status/
│   │       │       │   └── route.ts       # PUT
│   │       │       └── tags/
│   │       │           └── route.ts       # POST, DELETE
│   │       ├── campaigns/
│   │       │   ├── route.ts               # GET, POST
│   │       │   └── [id]/
│   │       │       ├── route.ts           # GET, PUT, DELETE
│   │       │       ├── start/
│   │       │       │   └── route.ts       # POST
│   │       │       ├── pause/
│   │       │       │   └── route.ts       # POST
│   │       │       ├── stop/
│   │       │       │   └── route.ts       # POST
│   │       │       ├── contacts/
│   │       │       │   └── route.ts       # GET
│   │       │       ├── stats/
│   │       │       │   └── route.ts       # GET
│   │       │       └── logs/
│   │       │           └── route.ts       # GET
│   │       ├── templates/
│   │       │   ├── route.ts               # GET, POST
│   │       │   ├── preview/
│   │       │   │   └── route.ts           # POST
│   │       │   └── [id]/
│   │       │       ├── route.ts           # GET, PUT, DELETE
│   │       │       └── duplicate/
│   │       │           └── route.ts       # POST
│   │       ├── conversations/
│   │       │   ├── route.ts               # GET
│   │       │   └── [id]/
│   │       │       ├── route.ts           # GET, PUT
│   │       │       ├── messages/
│   │       │       │   └── route.ts       # GET, POST
│   │       │       └── read/
│   │       │           └── route.ts       # PUT
│   │       └── dashboard/
│   │           ├── stats/
│   │           │   └── route.ts           # GET
│   │           ├── activity/
│   │           │   └── route.ts           # GET
│   │           └── charts/
│   │               ├── messages/
│   │               │   └── route.ts       # GET
│   │               ├── funnel/
│   │               │   └── route.ts       # GET
│   │               └── groups/
│   │                   └── route.ts       # GET
│   │
│   ├── components/
│   │   ├── ui/                            # Base UI components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── modal.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── dropdown.tsx
│   │   │   ├── pagination.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── tooltip.tsx
│   │   │   └── chart.tsx
│   │   ├── layout/
│   │   │   ├── sidebar.tsx                # Sidebar navigation
│   │   │   ├── header.tsx                 # Top header
│   │   │   ├── mobile-nav.tsx             # Mobile navigation
│   │   │   └── embed-layout.tsx           # Layout for Hub embeds
│   │   └── features/
│   │       ├── qr-login.tsx               # QR code login component
│   │       ├── group-scanner.tsx          # Scan progress UI
│   │       ├── contact-table.tsx          # Contacts table with filters
│   │       ├── campaign-wizard.tsx        # Campaign creation wizard
│   │       ├── campaign-progress.tsx      # Realtime campaign progress
│   │       ├── chat-window.tsx            # Chat/conversation UI
│   │       ├── template-editor.tsx        # Template editor with variables
│   │       ├── stats-cards.tsx            # Dashboard stat cards
│   │       ├── funnel-chart.tsx           # Conversion funnel
│   │       └── hub-bridge.tsx             # postMessage bridge for Hub
│   │
│   ├── lib/
│   │   ├── db.ts                          # Prisma client singleton
│   │   ├── zalo/
│   │   │   ├── client.ts                  # zca-js wrapper (init, connect, disconnect)
│   │   │   ├── scanner.ts                 # Group scanning logic (getGroupLinkInfo + pagination)
│   │   │   ├── messenger.ts              # Message sending logic (with delay, retry)
│   │   │   ├── listener.ts               # Incoming message listener (WebSocket)
│   │   │   ├── session.ts                # Session management (encrypt/decrypt credentials)
│   │   │   └── types.ts                  # Zalo-specific types
│   │   ├── queue/
│   │   │   ├── client.ts                 # BullMQ connection
│   │   │   ├── scan-worker.ts            # Worker: scan group members
│   │   │   ├── message-worker.ts         # Worker: send messages with delay
│   │   │   └── campaign-worker.ts        # Worker: orchestrate campaign execution
│   │   ├── hub/
│   │   │   ├── protocol.ts              # Plugin Protocol implementation
│   │   │   ├── events.ts                # Emit events to Hub
│   │   │   └── auth.ts                  # Verify Hub tokens
│   │   ├── crypto.ts                    # Encrypt/decrypt credentials (AES-256)
│   │   ├── utils.ts                     # General utilities
│   │   └── validations.ts              # Zod schemas for all inputs
│   │
│   ├── hooks/
│   │   ├── use-zalo-status.ts           # Zalo connection status
│   │   ├── use-realtime.ts              # WebSocket hook for realtime updates
│   │   ├── use-scan-progress.ts         # Scan progress tracking
│   │   └── use-campaign-progress.ts     # Campaign progress tracking
│   │
│   ├── services/
│   │   ├── accounts.ts                  # API client: accounts
│   │   ├── groups.ts                    # API client: groups + scan
│   │   ├── contacts.ts                 # API client: contacts
│   │   ├── campaigns.ts               # API client: campaigns
│   │   ├── templates.ts               # API client: templates
│   │   ├── conversations.ts           # API client: conversations
│   │   └── dashboard.ts               # API client: dashboard stats
│   │
│   ├── types/
│   │   ├── index.ts                   # All TypeScript types
│   │   ├── api.ts                     # API request/response types
│   │   ├── zalo.ts                    # Zalo-specific types
│   │   └── hub.ts                     # Hub Protocol types
│   │
│   └── constants/
│       ├── index.ts                   # App constants
│       ├── outreach-status.ts        # Status enums + labels + colors
│       └── routes.ts                 # Route paths
│
└── worker/                             # Standalone worker process (BullMQ)
    ├── index.ts                       # Worker entry point
    ├── scan.ts                        # Scan worker
    ├── message.ts                     # Message worker
    └── campaign.ts                    # Campaign orchestrator
```

## Tech Stack

| Layer | Tech | Lý do |
|-------|------|-------|
| **Frontend** | Next.js 15 (App Router) | SSR + API routes cùng project, deploy dễ |
| **UI** | Tailwind CSS + shadcn/ui | Nhanh, consistent, accessible |
| **Backend** | Next.js API Routes | Đủ cho app này, không cần Express riêng |
| **Database** | SQLite (dev) / PostgreSQL (prod) | SQLite cho local, Postgres khi scale |
| **ORM** | Prisma | Type-safe, migrations, seeding |
| **Queue** | BullMQ + Redis | Job queue cho scan + message sending |
| **Zalo API** | zca-js | Thư viện unofficial Zalo tốt nhất, TypeScript |
| **Realtime** | WebSocket (native) | Push scan progress, new messages |
| **Encryption** | AES-256-GCM | Mã hóa credentials Zalo |
| **Charts** | Recharts | Lightweight, React-native |
| **State** | React Query (TanStack) | Server state, caching, realtime sync |
