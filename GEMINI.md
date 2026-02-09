# GEMINI.md — hwdc-022026

## 📋 Project Overview

**Electron desktop app** that connects to your **Gmail** and **Google Calendar**, then uses **AI agents** to auto-research emails/events and extract actionable insights.

- **Stack:** Electron 39 + React 19 + TypeScript, bundled with `electron-vite`
- **AI:** Anthropic Claude Haiku 4.5 via Vercel AI SDK (`ai`), web search via Linkup SDK
- **Data:** SQLite (`better-sqlite3`), stored locally
- **Styling:** Tailwind CSS v4 (Vite plugin)
- **Auth:** Google OAuth2 (offline access for Gmail + Calendar scopes)

## 🏗 Architecture

```
src/
├── main/               # Electron main process
│   ├── index.ts         # App lifecycle, IPC handlers, fetch+upsert pipeline
│   └── services/
│       ├── google-auth.ts       # OAuth2 flow & token management
│       ├── gmail-service.ts     # Fetch emails via Gmail API
│       ├── calendar-service.ts  # Fetch events via Calendar API
│       ├── database.ts          # SQLite schema, CRUD, upsert logic
│       ├── research-agent.ts    # AI agent: drafts replies / meeting briefs
│       ├── insights-agent.ts    # AI agent: extracts insights from replies/transcripts
│       ├── mock-data.ts         # Type definitions + mock email/calendar data
│       └── insights-mock-data.ts
├── preload/             # Context bridge (IPC API surface)
│   ├── index.ts
│   └── index.d.ts
└── renderer/            # React frontend
    └── src/
        ├── App.tsx              # Main layout with resizable split panes
        └── components/
            ├── SourcePicker.tsx         # Email/Calendar list sidebar
            ├── SourceDetail.tsx         # Selected item detail view
            ├── ResearchOutput.tsx       # Research agent results panel
            ├── InsightsPage.tsx         # Insights agent page
            ├── InsightsSourcePicker.tsx  # Reply/Transcript picker
            └── InsightsOutput.tsx       # Insights results display
```

## 🔑 Environment Variables

Copy `.env.example` → `.env` and fill in:

| Variable            | Purpose                        |
| ------------------- | ------------------------------ |
| `ANTHROPIC_API_KEY` | Claude API access              |
| `LINKUP_API_KEY`    | Linkup web search for research |

**Google OAuth** uses `client_secret*.json` file in the project root (gitignored).

## 🚀 Common Commands

```bash
npm install          # Install dependencies
npm run dev          # Start in dev mode (with --no-sandbox)
npm run lint         # ESLint
npm run format       # Prettier
npm run typecheck    # TypeScript checking (main + renderer)
npm run build:linux  # Production build (Linux)
npm run build:mac    # Production build (macOS)
npm run build:win    # Production build (Windows)
```

## 🧠 AI Agents

### Research Agent (`research-agent.ts`)

- **Triggered:** Per email or calendar event (auto-processes new items on fetch)
- **Tools:** `linkupSearch` — web search via Linkup API
- **Output:** Email draft replies or meeting briefing docs
- **Caching:** Results stored in SQLite; skips re-processing on cache hit

### Insights Agent (`insights-agent.ts`)

- **Triggered:** On-demand for email replies or meeting transcripts
- **Output:** Structured `{ keyInsights, feedback, actionSteps }` via Zod schema
- **Actions:** Each action step can be "executed" (logged to DB action log)

## 💾 Database

SQLite via `better-sqlite3`, stored locally. Tables:

- `emails` — fetched Gmail messages (upserted by message ID)
- `events` — fetched Calendar events (upserted by event ID)
- `research` — cached research agent results
- `insights` — cached insights agent results
- `action_log` — executed insight action steps

## ⚠️ Key Conventions

- **IPC pattern:** All main↔renderer communication via `ipcRenderer.invoke` / `ipcMain.handle`
- **Preload bridge:** API surface defined in `src/preload/index.ts`, types in `index.d.ts`
- **No tests yet** — project is in rapid prototyping phase
- **Auto-processing:** On email/event fetch, unprocessed items are queued and run through the research agent sequentially
- **Config files are gitignored:** `.env`, `client_secret*.json`, `*.db`
