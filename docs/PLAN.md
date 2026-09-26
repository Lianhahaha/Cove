# Cove: build plan

Cove is a place for students to keep everything a class throws at them: links, notes, files and tasks. You paste something in, add a description, file it under a subject, and optionally turn it into a task with a due date. It runs in the browser, installs as an app on phone and desktop, and works offline.

This document is the plan: what gets built, with which tools, in what order, and the rules the code follows.

**Status (September 2026):** milestones 1–20 are built, along with these extras: auto-tagging links by site, smart views, a focus timer, the new-semester reset, search inside PDFs, and on-demand loading that keeps the first download near 75 KB gzipped. Still open: sync and shared spaces (21), which need a Firebase project, and the desktop bookmarklet.

## Goals

1. **Fast capture.** Saving a link from a phone takes one share-sheet tap or one paste.
2. **Works offline.** Everything saved is readable and editable with no connection. The network is only needed for link previews, AI and (later) sync.
3. **Light.** The first load should stay under about 150 KB of gzipped JavaScript, so the app feels quick on a mid-range Android phone on mobile data.
4. **Zero cost to run.** Static hosting plus two small serverless functions on free tiers. No paid APIs.
5. **Private by default.** Data lives in the browser's own database. Nothing leaves the device unless the user asks for a preview, turns on AI, or signs in to sync.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | Preact + TypeScript | React's API at about 4 KB. |
| Routing | preact-iso | Tiny router from the Preact team, with lazy-loaded routes. |
| State | @preact/signals | Fine-grained UI state without a store library. |
| Styling | Tailwind CSS v4 | Only the classes in use ship; theme lives in CSS variables. |
| Local database | Dexie (IndexedDB) | Stores items and file blobs offline, with live queries. |
| Search | MiniSearch | Full-text, fuzzy and prefix search, entirely in the browser. |
| Markdown | marked + DOMPurify | Notes support Markdown; every render is sanitized. |
| Icons | lucide-preact | Tree-shaken, so only used icons ship. |
| PWA | vite-plugin-pwa (Workbox, injectManifest) | Precached app shell, runtime caching, custom service worker for share target and notifications. |
| Zip | fflate (lazy-loaded) | Backup export and import with files. |
| Serverless | Vercel Functions (Node) | `/api/preview` and `/api/ai`, free on the Hobby plan. |
| AI | Groq free tier through `/api/ai` | The key stays on the server. Off by default. |
| Tests | Vitest + fake-indexeddb | Parser, database, guardrails and API handlers. |
| CI | GitHub Actions | Typecheck, test and build on every push. |

No web fonts: the system font stack keeps the first paint instant.

## Theme

Colors come from the ThesisWeb palette. The layout and interaction design are Cove's own.

- **Light:** cream page `#fdfcf0`, surfaces `#fffffa` / `#f8f6e9` / `#f0eddd`, borders `#e4e1cf` / `#ccc8b4`, ink `#1c1b18`, muted `#4a473f`, subtle `#635f55`, lavender accent `#684c96` with fills `#ede1fc` / `#e2d0fa`.
- **Dark:** warm charcoal `#191816`, surfaces `#21201d` / `#292724` / `#34322e`, borders `#3c3a35` / `#56534c`, text `#ede9e0`, muted `#beb8ac`, subtle `#9e988d`, soft lavender `#c6b4f0` with fills `#362e4a` / `#43395c`.
- Theme follows the OS until the user picks one in Settings.

## Data model

Every record has a UUID `id`, `createdAt` and `updatedAt`, and a `deletedAt` that is set when it goes to the trash. These fields also make a later sync possible (last write wins per record, tombstones for deletes).

- **Space**: a subject or project. Name, emoji, color, sort order, archived flag, and an "exclude from AI" flag.
- **Item**: the core record.
  - `kind`: `link`, `note` or `file`.
  - Content: `title`, `body` (Markdown description), `url`, link `preview` (title, description, image, site, favicon, fetch status).
  - Organizing: `spaceId` (none means Inbox), `tags`, `pinned`, `favorite`, `archived`, `order`.
  - Task fields, usable on any kind: `status` (`none`, `todo`, `doing`, `done`), `due`, `dueHasTime`, `priority` 0–3, `checklist`, `recurrence`, `remindAt`, `estimateMins`, `completedAt`.
  - Safety: `private` (never sent to AI, blurred in lists).
- **File**: a Blob stored in IndexedDB with name, type, size, owning item, optional thumbnail and extracted text.
- **Setting**: key/value pairs for preferences.

## Features

Legend: **M1** first release, **M2** second, **M3** later.

### Capture
- **M1** Quick-add bar that understands what you paste: a URL becomes a link, anything else a note. Inline syntax: `#tag`, `!` to `!!!` for priority, `@space`, and dates such as `today`, `tmr`, `fri`, `next week`, `dec 5`, `12/5`, `in 3 days`, `5pm`. A date turns the item into a task.
- **M1** Full editor: title, Markdown description, tags, space, due date, priority, checklist.
- **M1** Files: pick, drag and drop, or paste an image. Stored offline with size limits.
- **M1** Link previews fetched through `/api/preview`, queued while offline and fetched when back online.
- **M2** Share target: share from any Android app straight into Cove (links, text and files).
- **M2** Paste a whole announcement and extract every link and date from it.
- **M3** Bookmarklet for desktop browsers.

### Organize
- **M1** Spaces with emoji and color, Inbox for unfiled items.
- **M1** Tags with a tag browser.
- **M1** Pin, favorite, archive.
- **M1** List and grid layouts.
- **M2** Smart views: Due this week, Untagged, Files, Links, Recently edited.
- **M2** Bulk select: move, tag, archive, delete.
- **M2** Auto-tag by domain (YouTube, GitHub, Google Docs, Drive, Canva, Figma).
- **M3** Semester archive: archive every space at once and start fresh.

### Tasks
- **M1** Any item can become a task: status, due date and time, priority, checklist.
- **M1** Views: list grouped by due date (Overdue, Today, Tomorrow, This week, Later, No date), Kanban board (To do, Doing, Done), month calendar.
- **M1** Today on the home screen: overdue, due today, pinned.
- **M2** Recurring tasks (daily, weekly, monthly, every N): completing one creates the next.
- **M2** Reminders while the app is open or installed, plus `.ics` export so the phone's own calendar handles alerts reliably.
- **M2** App icon badge with the count of tasks due today (Badging API).
- **M3** Focus timer attached to a task.

### Find
- **M1** Search over titles, descriptions, URLs, tags and file names, with fuzzy and prefix matching.
- **M1** Filters: kind, space, tag, status.
- **M1** Command palette (Ctrl/Cmd+K) to jump anywhere or run actions.
- **M2** Search inside PDFs (text extracted with pdf.js, loaded only when needed).

### AI (optional, off by default)
- **M2** Summarize an item.
- **M2** Suggest tags.
- **M2** Extract tasks and dates from pasted text.
- **M2** Make a practice quiz from a note.
- Every result is a suggestion the user accepts or discards. Nothing is applied automatically.

### Data and safety
- **M1** Trash with undo, kept 30 days and then purged.
- **M1** Export: full backup (JSON plus files, zipped), Markdown export.
- **M1** Import: Cove backup, browser bookmarks HTML.
- **M1** Storage meter and persistent-storage request, so the browser doesn't evict data.
- **M2** Private items: excluded from AI, blurred in lists.
- **M3** Optional sign-in and sync across devices (Firebase Auth + Firestore on the free Spark plan, loaded only for users who sign in), then shared spaces for group projects.

### App feel
- **M1** Installable, offline, update prompt when a new version is ready.
- **M1** Light, dark and system themes.
- **M1** Keyboard shortcuts on desktop (`n` new, `/` search, `Ctrl+K`, `?` help), bottom navigation and a capture button on phones.
- **M2** Home-screen shortcuts (long-press the icon): Quick add, Today.
- **M2** Stats: items saved, tasks finished, streak.

## AI guardrails

The AI is a convenience, so it has to be safe to leave on.

**On the server (`/api/ai`)**
- Only four task types exist: `summarize`, `tags`, `extract_tasks`, `quiz`. Each has a fixed system prompt, a fixed temperature and a fixed `max_tokens` cap. The client cannot send its own prompt.
- The model comes from an allowlist and can be changed through an environment variable.
- `AI_ENABLED` is a kill switch. Without `GROQ_API_KEY` the endpoint reports AI as unavailable.
- Requests must be `POST` JSON under 32 KB, from an allowed origin. Input text is capped at 8,000 characters.
- Per-IP rate limit (best effort, in memory) and a per-instance daily cap.
- User content is wrapped in delimiters, and the system prompt says to treat it as data and ignore any instructions inside it.
- The model must answer in JSON. The server validates the shape, clamps every length (for example at most 8 tags of 32 characters), and strips HTML before returning.
- 20-second timeout. Logs record task, status and latency only, never content.

**In the app**
- AI is off until the user turns it on and accepts a one-time notice explaining that the text goes to Groq.
- Items marked private and spaces marked "exclude from AI" are never sent.
- Before sending, the app redacts emails, phone numbers, and strings that look like API keys, tokens or passwords.
- The user sees results as suggestions and chooses what to keep.
- AI output is rendered as plain text, never as HTML.
- A local daily counter caps usage per device.

## Link preview guardrails (`/api/preview`)

Fetching arbitrary URLs from a server is a classic SSRF risk, so:
- Only `http` and `https`, default ports only, no credentials in the URL.
- The hostname is resolved and every address is checked. Private, loopback, link-local, carrier-grade NAT, multicast and reserved ranges are refused (IPv4 and IPv6, including IPv4-mapped IPv6). The check runs inside the connection's DNS lookup, so a rebinding DNS answer can't slip past it.
- At most 3 redirects, each one checked again.
- 6-second timeout, at most 512 KB read, HTML only.
- Only metadata tags are parsed, and every value is length-clamped. Image and favicon URLs must be `http(s)`.
- Responses are cached at the edge for a day.

## Offline behavior

- The app shell (HTML, JS, CSS, icons) is precached by the service worker.
- All data is in IndexedDB, so every screen works offline.
- Link previews and AI requests wait in a queue and run when the connection returns.
- The app asks for persistent storage so the browser keeps the data under storage pressure.

## Milestone order

Each step is its own commit, pushed as soon as it builds and passes tests.

1. Plan (this document)
2. Scaffold: Vite, Preact, TypeScript, Tailwind, theme tokens
3. Database layer and tests
4. Quick-add parser and tests
5. App shell: layout, routing, navigation, theme switch
6. Items: create, edit, list and grid, detail view, Markdown
7. Spaces
8. Tasks: list, board, calendar, checklist
9. Files
10. Link preview API and client queue
11. Search and command palette
12. PWA: manifest, icons, service worker, install and update prompts
13. Trash, undo and auto-purge
14. Export and import
15. Reminders, badge and `.ics` export
16. Share target and home-screen shortcuts
17. AI endpoint with guardrails, then AI features in the app
18. Stats
19. CI
20. README
21. Sync and shared spaces (M3)
