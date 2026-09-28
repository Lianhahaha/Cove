# Cove

Cove is a place for students to keep everything a class throws at them: links, notes, files and tasks. Paste a link, add a description, file it under a subject, and turn anything into a task with a due date. It installs as an app on phones and computers and works fully offline.

Everything is stored in the browser on your own device. Nothing leaves it unless you ask for a link preview or use an AI helper.

## Features

**Capture**
- One box for everything. A URL, or a bare address like `example.com`, becomes a link, anything else a note, and the same line can carry `#tags`, `!`/`!!`/`!!!` priority, `@space`, and a due date such as `tmr`, `bukas`, `fri 5pm`, `next week`, `in 3 days`, `dec 5` or `12/5`, and a repeat such as `every fri`, `every other week`, `every 3 days` or `araw-araw`. The parsed parts show as chips you can dismiss.
- Paste a multi-line announcement and split it into one item per line.
- Attach PDFs, slides and photos by picking, dropping or pasting them. Files are stored offline, up to 25 MB each.
- Share links, text and files into Cove from any Android app, or paste and drop anywhere in the app.
- Link previews (title, description, image, site icon) fetched through a guarded server function, with oEmbed for YouTube, Vimeo, TikTok and Spotify.
- A Notes page and a New note button (in each space, the + sheet and the palette) that opens straight into the Markdown editor. Notes left empty are discarded.
- Quick links on Home: one tap opens Google Classroom (there by default), Drive, Gmail or any site, or its app when one is installed. Tiles show each app's real logo: bundled for Google apps (`public/brand/`, trademarks of Google LLC, used only to link to those services), and the site's own icon for anything else.

**Organize**
- Spaces for each subject, with an emoji, color and order; Unsorted holds anything not in a space yet.
- Tags, pins, favorites, archive, and a 30-day trash with undo.
- List and grid layouts, type filters, sorting, and bulk actions (move, tag, finish, archive, delete).
- Drag items onto a space in the sidebar to move them.
- Light, dark or system theme in four soft palettes: Lavender, Sage, Sky and Rose. All four pass WCAG AA contrast.

**Tasks**
- Any item can be a task, with status, due date and time, priority, checklist and repeats (daily, weekly, monthly, every N).
- List grouped by Overdue, Today, Tomorrow, Next 7 days and Later; a Kanban board with drag and drop; a month calendar where tasks can be dragged to another day.
- Reminders as notifications while Cove is open, and `.ics` export so the phone's own calendar can alert even when it isn't.
- The installed app's icon shows how many tasks are due today.
- A focus timer (15, 25 or 50 minutes) on any task that logs your focused time, with breaks.

**Find**
- Offline full-text search over titles, notes, links, previews, tags, file names and the text inside attached PDFs, with prefix matching and typo tolerance.
- Search filters that work alone or with words: `is:task`, `is:open`, `is:done`, `is:overdue`, `is:pinned`, `is:fav`, `is:private`, `is:archived`, `is:repeating`, `type:link|note|file` and `tag:name`.
- Smart views: This week, No tags and Recently edited.
- A command palette (`Ctrl/⌘ + K`) and keyboard shortcuts (`N` new, `/` search, `G` then `H/I/T/A/F/S` to jump, `?` for the list).

**AI helpers (optional)**
- Summarize an item, suggest tags, pull tasks and deadlines out of an announcement, or make an interactive practice quiz. See [AI safety](#ai-safety).

**Your data**
- Backups as a zip with every file, your quick links and focus history, importable on any device without overwriting newer edits.
- Export everything as Markdown, one folder per space. Import browser bookmarks.
- Storage meter and a request for persistent storage.
- Start a new semester by archiving every space in one step.
- Light, dark and system themes, and a stats page with streaks, focus time and a 14-day activity chart.

## AI safety

The AI features are off until you turn them on, and they're built to be safe to leave on.

On the server (`api/ai.ts`, `api/_lib/ai-guard.ts`):
- Only four fixed tasks exist. The prompt, model, temperature and token cap for each are set on the server; the client can't send its own prompt or pick a model.
- The model comes from an allowlist, and `AI_ENABLED=false` switches everything off.
- Requests must be JSON under 32 KB from the app's own origin, and are rate-limited per IP and per instance.
- Input is capped at 8,000 characters and wrapped in delimiters the text can't close. The system prompt tells the model to treat it as data and ignore instructions inside it.
- The model must reply in JSON. Every field is validated, stripped of HTML and clamped before it reaches the app.
- Logs record the task, status and timing only, never content.

In the app (`src/lib/ai.ts`):
- A one-time notice explains what's sent and to whom before AI can be turned on.
- Private items and spaces marked "keep away from AI" are never sent.
- Emails, phone numbers, passwords, PINs, API keys, tokens and card numbers are redacted first, and a review step shows the exact text before it goes out.
- Results are suggestions you accept or discard. Each device is capped at 40 requests a day.

## Link preview safety

`/api/preview` fetches URLs that users typed, which is a classic server-side request forgery risk. It only fetches public `http(s)` URLs on default ports, checks every address a hostname resolves to inside the connection's own DNS lookup (so DNS rebinding can't slip past), refuses private, loopback, link-local, carrier-grade NAT, multicast and other reserved ranges for both IPv4 and IPv6, re-checks each redirect, and stops after 6 seconds or 1 MB (with headers capped at 64 KB). See `api/_lib/net-guard.ts` and its tests.

## Tech stack

- [Preact](https://preactjs.com) + TypeScript, built with [Vite](https://vite.dev)
- [Tailwind CSS v4](https://tailwindcss.com), with the theme in CSS variables
- Self-hosted fonts from [Fontsource](https://fontsource.org): DM Sans, Fraunces, JetBrains Mono and Instrument Serif
- [Dexie](https://dexie.org) over IndexedDB for items, spaces and file blobs
- [MiniSearch](https://lucaong.github.io/minisearch/) for offline search
- [marked](https://marked.js.org) + [DOMPurify](https://github.com/cure53/DOMPurify) for safe Markdown
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) with a custom Workbox service worker
- Vercel Functions for `/api/preview` and `/api/ai`, calling [Groq](https://groq.com)'s free tier
- [Vitest](https://vitest.dev) and fake-indexeddb for tests, GitHub Actions for CI

The first load is about 75 KB of gzipped JavaScript. The item editor, AI panel, command palette, search index, backups and less-used screens load the first time they are opened, and the service worker precaches them all for offline use. pdf.js (1.7 MB) is the exception: it downloads the first time a PDF is attached and is cached from then on.

## Getting started

Requires Node.js 20.19 or later.

```bash
npm install
npm run dev
```

The dev server runs at `http://localhost:5173` and serves the `/api` functions too, so link previews work locally.

To try the AI helpers locally, copy `.env.example` to `.env` and add a free Groq API key from [console.groq.com/keys](https://console.groq.com/keys):

```env
GROQ_API_KEY=your-key
```

Server-side variables are never prefixed with `VITE_`, so they stay out of the app bundle.

| Script | Does |
| --- | --- |
| `npm run dev` | Dev server with the API functions |
| `npm run build` | Production build with the service worker |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | TypeScript check |
| `npm test` | Run the test suite |

## Deploying

Cove runs on Vercel's free Hobby plan. Import the repository in Vercel; `vercel.json` sets the build, single-page-app rewrites and security headers (including a strict Content-Security-Policy). Add `GROQ_API_KEY` in the project's environment variables to enable AI, or leave it out and the AI features stay hidden.

## Project structure

```
api/                 Vercel functions
  preview.ts         Link previews
  ai.ts              AI helpers
  _lib/              Guards, parsers and rate limiting (not routes)
src/
  lib/               Data layer, parser, search, backups, AI client, reminders
  components/        Shared UI: shell, cards, editor, dialogs
  pages/             One file per route
  sw.ts              Service worker
docs/PLAN.md         Build plan and roadmap
```

## Roadmap

- Optional sign-in and sync across devices (Firebase on the free Spark plan, loaded only for users who sign in)
- Shared spaces for group projects
