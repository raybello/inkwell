# Product Requirements Document — Inkwell Studio

**Version:** 0.1 — Draft  
**Date:** 2026-11-13  
**Status:** In Progress (competitive research pending)

---

## 1. Vision & Problem Statement

Writers, editors, and digital-content creators are split across a fragmented toolchain: they draft in one tool, organise research in another, lay out pages in a third, export through a fourth. No single platform covers the full arc from blank canvas to finished, publishable content without either being bloated (Scrivener) or too generic (Notion/Google Docs).

**Inkwell Studio** is a Next.js + Supabase platform that unifies the entire content-creation workflow — draft, illustrate, organise, review, preview, and publish — into one fast, focused workspace. It is intentionally opinionated: every feature earns its place by saving writers meaningful time.

**Primary personas**
| Persona | Core job-to-be-done |
|---|---|
| Solo fiction/non-fiction author | Write a full-length book, keep notes & research attached, export publish-ready files |
| Digital-content creator | Produce e-books, blog posts, and articles; drop in images; preview final layout before publishing |
| Editor/collaborator | Mark up manuscripts, leave threaded comments, approve chapters |
| Self-publisher | Format for Kindle/EPUB/PDF, manage cover art, track multiple titles |
| AI content agent | Programmatically create or update content via REST API |

---

## 2. Competitive Landscape

### 2.1 Key Competitors

| Platform | Strengths | Weaknesses |
|---|---|---|
| **Scrivener** | Deep outlining, corkboard, compile/export | Desktop-only, steep learning curve, no real-time collab, no AI, aging UI |
| **Reedsy Book Editor** | Clean writing UI, professional formatting/export (EPUB/DOCX/PDF), editorial marketplace | No whiteboard/canvas, no image storyboarding, limited AI, no blog/article mode |
| **Notion** | Flexible blocks, collaborative, database views | Generic (not writer-first), poor export fidelity, no canvas/whiteboard, no publish-ready formatting |
| **Atticus** | Great book formatting, Vellum alternative on web | Writing-only, no ideation tools, no collaboration |
| **Craft.do** | Beautiful UI, cards/blocks, iOS-native | Not writer-focused beyond notes, no book structure, limited export |
| **Google Docs** | Real-time collab, familiar | No structure/outlining, poor long-doc management |

### 2.2 Key Opportunity Gaps
1. No competitor combines **ideation canvas + structured writing + visual storyboard + publish-ready export** in a single web app.
2. AI-native integration is bolted on; no platform offers a **first-class agent API** for autonomous content generation/modification.
3. **Cover-art + inline image management** is universally weak.
4. Mobile web experience is poor across all serious writing tools.

---

## 3. Core Feature Set

### 3.1 Workspace & Project Structure

- **Library** — dashboard of all projects (books, e-books, articles, blogs). Card or list view, sortable by last modified, genre, type.
- **Project types** — Book, E-book, Article/Blog, Custom.
- **Folder hierarchy inside a project** — Parts > Chapters > Scenes/Sections (unlimited depth). Drag-and-drop reorder.
- **Project metadata** — title, subtitle, author, genre, target word count, cover image, description, tags, publishing target (Amazon KDP, Smashwords, own site, blog).

### 3.2 Writing Editor

- Rich-text block editor (built on **TipTap/ProseMirror**) with clean, distraction-free mode.
- Block types: paragraph, heading (H1–H4), blockquote, callout, divider, code block, image, table, footnote, comment anchor.
- **Focus mode** — hides all chrome, shows only current chapter and word count.
- **Typewriter scroll** — keeps active line vertically centred.
- **Daily writing goal** — set target words/day; progress bar in sidebar.
- **Version history** — auto-save every 30 s; named snapshots on demand; diff view to compare versions.
- **Find & Replace** — project-wide or chapter-scoped, regex support.
- Real-time word/character/page count per section and project total.
- **Inline comments** — highlight text → leave threaded comment; collaborators resolve threads.

### 3.3 Outline & Structure Panel

- Collapsible sidebar showing the full document tree (Parts / Chapters / Sections).
- Drag sections to reorder or move between chapters.
- Each node shows: title, word count, status badge (Draft / In Progress / Complete / Needs Review).
- **Synopsis card** per chapter — a short description that appears in Corkboard view.
- **Corkboard view** — visual card grid of chapters/scenes for plotting; drag to reorder; colour-code by POV, arc, subplot.

### 3.4 Image & Media Management

- **Asset Library** — project-scoped image/media store; upload from device or paste URL; drag into editor or storyboard.
- Supported types: JPEG, PNG, WebP, GIF, SVG, MP4 preview thumbnail.
- **Image blocks in editor** — inline images with caption, alt text, alignment (left/centre/right/full-bleed), resize handle.
- **Cover Art Studio** — upload or generate cover image; apply title/subtitle/author text overlay with font/colour controls; export as print-ready PNG (300 dpi equivalent) or screen-optimised.
- Images stored in **Supabase Storage** with per-project access control.

### 3.5 Storyboard

- Dedicated storyboard view per project: a **horizontal scroll lane of cards** (one per chapter/scene).
- Each card: cover image/mood image, title, synopsis, word count, status.
- Drag cards to reorder scenes/chapters.
- **Image pinning** — drag any asset-library image onto a storyboard card as its visual reference.
- **Mood board strip** — attach multiple mood/reference images to a card; displayed as a thumbnail row.
- Clicking a card opens the chapter in the editor.
- Storyboard is the visual equivalent of Scrivener's corkboard but image-first.

### 3.6 Whiteboard / Idea Canvas

- Infinite canvas (built on **tldraw** or **Excalidraw** open-source lib) accessible from each project.
- Elements: sticky notes, text boxes, freehand drawing, shapes, images, arrows/connectors.
- **Image import** — drag from asset library or upload directly onto canvas.
- **Clip to project** — select canvas items → "Save to Storyboard" or "Save to Chapter Notes".
- Multiple named canvases per project (e.g. "World Map", "Character Web", "Plot Arcs").
- Auto-save; named snapshots.

### 3.7 Research & Notes Panel

- **Notes sidebar** — per-chapter or project-wide sticky notes.
- **Research section** — attach web links, PDFs, or images to a chapter; inline preview of linked content.
- **Character / World-building sheets** — structured forms: Character (name, role, traits, arc), Location (name, description, map image), Event (date, description, linked chapters).
- Tags and cross-links between notes and chapters.

### 3.8 Content Preview

- **Live preview panel** — toggle split-screen: left editor, right formatted preview.
- Preview modes: E-book (EPUB-style), Blog/Article (web typography), Print (book page layout with margins/headers).
- Font, size, line-height, margin controls in preview (do not affect raw content).
- **Full-screen preview** — simulates e-reader or browser viewport.

### 3.9 Export & Publishing

| Export format | Notes |
|---|---|
| EPUB 3 | With embedded images, TOC, metadata |
| PDF (print) | A5/6×9/custom trim, bleed, page numbers |
| PDF (screen) | Hyperlinked TOC, optimised for screen |
| DOCX | Manuscript format (industry standard courier/TNR) |
| Markdown | Clean, portable |
| HTML | For blog/website publish |
| JSON | Full project data (for backup / API consumers) |

- **Custom style templates** — pre-built themes (Literary, Modern, Minimal); user can create/save own.
- **Chapter-level export** — export single chapter as any format.

### 3.10 Collaboration

- **Invite by email** — roles: Owner, Editor (can edit + comment), Reviewer (comment-only), Viewer.
- Real-time collaborative editing (Supabase Realtime + CRDT via Yjs).
- **Change tracking** — accept/reject individual edits (for editor workflow).
- **Notification centre** — in-app alerts for new comments, mentions, status changes.
- Activity feed per project.

### 3.11 AI Writing Assistant (in-app)

- **Inline AI actions** (highlight text → AI menu):
  - Rephrase / Improve
  - Expand / Shorten
  - Change tone (formal, casual, literary, punchy)
  - Translate
  - Summarise into synopsis
- **AI Chat panel** — contextual assistant aware of current chapter; ask questions, brainstorm, get continuations.
- **AI Image generation** — prompt → generate cover art or mood image; powered by pluggable provider (OpenAI DALL-E, Stability AI, etc.).
- **AI-powered outline suggester** — from a premise, generate a chapter outline.
- Model selection configurable per workspace (Claude, GPT-4o, etc.).

---

## 4. Public Agent API

A first-class REST API that allows AI agents, automation scripts, and third-party integrations to programmatically read and write content.

### 4.1 Authentication

- **API keys** — workspace-scoped, generated in settings; include in `Authorization: Bearer <key>` header.
- Scopes: `projects:read`, `projects:write`, `chapters:read`, `chapters:write`, `assets:read`, `assets:write`, `storyboard:write`.
- Rate limiting: configurable per key (default 100 req/min).

### 4.2 Core Endpoints

```
# Projects
GET    /api/v1/projects                       List all projects
POST   /api/v1/projects                       Create project
GET    /api/v1/projects/:id                   Get project details + metadata
PATCH  /api/v1/projects/:id                   Update metadata
DELETE /api/v1/projects/:id                   Delete project

# Structure
GET    /api/v1/projects/:id/chapters          List chapters (with hierarchy)
POST   /api/v1/projects/:id/chapters          Create chapter/section
GET    /api/v1/projects/:id/chapters/:cid     Get chapter content (rich JSON or Markdown)
PATCH  /api/v1/projects/:id/chapters/:cid     Update chapter content / metadata
DELETE /api/v1/projects/:id/chapters/:cid     Delete chapter
POST   /api/v1/projects/:id/chapters/reorder  Reorder chapters

# Content operations
POST   /api/v1/projects/:id/chapters/:cid/append    Append text block
POST   /api/v1/projects/:id/chapters/:cid/prepend   Prepend text block
PATCH  /api/v1/projects/:id/chapters/:cid/blocks/:bid  Update a specific block

# Assets / Images
GET    /api/v1/projects/:id/assets            List assets
POST   /api/v1/projects/:id/assets            Upload asset (multipart)
DELETE /api/v1/projects/:id/assets/:aid       Delete asset

# Storyboard
GET    /api/v1/projects/:id/storyboard        Get storyboard cards
POST   /api/v1/projects/:id/storyboard/:cid/image   Pin image to storyboard card
DELETE /api/v1/projects/:id/storyboard/:cid/image   Remove pinned image

# Canvas
GET    /api/v1/projects/:id/canvases          List canvases
POST   /api/v1/projects/:id/canvases/:vid/elements  Add element (note, image, shape)

# Export
POST   /api/v1/projects/:id/export            Trigger async export; returns job ID
GET    /api/v1/exports/:jobId                 Poll export status; get download URL

# AI (proxied through API key)
POST   /api/v1/projects/:id/ai/generate       Generate content from prompt
POST   /api/v1/projects/:id/ai/image          Generate/suggest image for scene
```

### 4.3 Webhook Events
Outbound webhooks (configured per project) notify external agents of:
- `chapter.created`, `chapter.updated`, `chapter.deleted`
- `asset.uploaded`
- `export.completed`
- `comment.created`

---

## 5. Frontend Architecture

### 5.1 Tech Stack
| Layer | Choice | Rationale |
|---|---|---|
| Framework | **Next.js 15** (App Router) | SSR/ISR for public previews; RSC for dashboard perf |
| Styling | **Tailwind CSS v4** + shadcn/ui | Fast iteration, accessible primitives |
| Editor | **TipTap 2** (ProseMirror) | Extensible, collaborative (Yjs), battle-tested |
| Canvas/Whiteboard | **tldraw v2** or **Excalidraw** | Open source, React-native, full canvas API |
| Real-time | **Supabase Realtime** (Yjs provider) | Collab cursors + CRDT merging |
| State | **Zustand** (local UI state) + TanStack Query (server state) | Minimal boilerplate |
| Drag & drop | **@dnd-kit** | Accessible, works with virtual lists |
| Auth | **Supabase Auth** (email/password, Google, GitHub OAuth) | — |
| File upload | **Supabase Storage** via signed upload URLs | — |
| Forms | **React Hook Form** + **Zod** | Validation co-located with schema |

### 5.2 Route Structure
```
/                            Marketing / landing page
/auth/login                  Sign in
/auth/signup                 Register
/app                         Dashboard / Library (protected)
/app/projects/new            Create project wizard
/app/projects/[id]           Project home (outline + recent chapters)
/app/projects/[id]/editor/[chapterId]   Writing editor
/app/projects/[id]/storyboard           Storyboard view
/app/projects/[id]/canvas/[canvasId]    Whiteboard canvas
/app/projects/[id]/assets               Asset library
/app/projects/[id]/preview              Content preview
/app/projects/[id]/export               Export options
/app/projects/[id]/settings             Project settings + collaborators
/app/settings                           User/workspace settings + API keys
/app/settings/api                       API key management
/share/[token]               Public share link (read-only preview)
```

### 5.3 Key UI Components
| Component | Description |
|---|---|
| `ProjectCard` | Library grid card — cover, title, type, word count, last-modified |
| `EditorToolbar` | TipTap toolbar — formatting, insert block, AI menu |
| `OutlinePanel` | Collapsible tree with drag handles and status badges |
| `StoryboardLane` | Horizontal scroll with draggable chapter cards |
| `CanvasBoard` | Full-screen tldraw/Excalidraw wrapper with asset-library sidebar |
| `AssetLibrary` | Grid of uploaded images; drag source for editor/storyboard/canvas |
| `PreviewPane` | Rendered output with mode switcher (e-book/blog/print) |
| `CommentThread` | Inline anchored comment with replies + resolve button |
| `AIAssistPanel` | Sliding panel: AI chat + action buttons |
| `ExportModal` | Format picker, style template selector, download trigger |
| `CollabAvatars` | Live presence indicators in editor header |
| `WordCountBar` | Daily goal progress; total + chapter counts |

---

## 6. Backend Architecture

### 6.1 Supabase Schema (key tables)

```sql
-- Users (managed by Supabase Auth; extended below)
profiles (id uuid PK, display_name, avatar_url, plan, api_keys jsonb)

-- Projects
projects (
  id uuid PK,
  owner_id uuid FK profiles,
  title text,
  subtitle text,
  type text,              -- book | ebook | article | blog | custom
  genre text,
  cover_image_url text,
  description text,
  target_word_count int,
  publishing_target text,
  tags text[],
  settings jsonb,
  created_at timestamptz,
  updated_at timestamptz
)

-- Chapters / Sections (self-referential for nesting)
chapters (
  id uuid PK,
  project_id uuid FK projects,
  parent_id uuid FK chapters NULLABLE,
  title text,
  synopsis text,
  content jsonb,          -- TipTap JSON document
  content_md text,        -- Markdown mirror (generated on save)
  position int,           -- ordering within parent
  status text,            -- draft | in_progress | complete | needs_review
  word_count int,
  pov text,
  tags text[],
  created_at timestamptz,
  updated_at timestamptz
)

-- Assets
assets (
  id uuid PK,
  project_id uuid FK projects,
  uploader_id uuid FK profiles,
  filename text,
  storage_path text,
  public_url text,
  mime_type text,
  size_bytes int,
  alt_text text,
  tags text[],
  created_at timestamptz
)

-- Storyboard entries (linking chapters to their mood images)
storyboard_cards (
  id uuid PK,
  project_id uuid FK projects,
  chapter_id uuid FK chapters,
  primary_image_id uuid FK assets NULLABLE,
  mood_image_ids uuid[],
  position int,
  notes text
)

-- Canvases
canvases (
  id uuid PK,
  project_id uuid FK projects,
  name text,
  content jsonb,          -- tldraw/Excalidraw snapshot
  created_at timestamptz,
  updated_at timestamptz
)

-- Comments
comments (
  id uuid PK,
  chapter_id uuid FK chapters,
  author_id uuid FK profiles,
  anchor_start int,
  anchor_end int,
  body text,
  parent_id uuid FK comments NULLABLE,
  resolved bool DEFAULT false,
  created_at timestamptz
)

-- Project collaborators
project_members (
  project_id uuid FK projects,
  user_id uuid FK profiles,
  role text,              -- owner | editor | reviewer | viewer
  invited_at timestamptz,
  accepted_at timestamptz NULLABLE
)

-- Version history
chapter_versions (
  id uuid PK,
  chapter_id uuid FK chapters,
  content jsonb,
  word_count int,
  saved_by uuid FK profiles,
  label text NULLABLE,
  created_at timestamptz
)

-- API keys
api_keys (
  id uuid PK,
  workspace_id uuid FK profiles,
  name text,
  key_hash text UNIQUE,
  scopes text[],
  rate_limit_rpm int DEFAULT 100,
  last_used_at timestamptz,
  created_at timestamptz,
  revoked_at timestamptz NULLABLE
)

-- Export jobs
export_jobs (
  id uuid PK,
  project_id uuid FK projects,
  format text,
  style_template text,
  status text,            -- queued | processing | done | failed
  download_url text NULLABLE,
  error text NULLABLE,
  created_at timestamptz,
  completed_at timestamptz NULLABLE
)
```

### 6.2 Row-Level Security (RLS) Principles
- `projects` — readable/writable only by owner and invited members (via `project_members`).
- `chapters`, `assets`, `canvases`, `storyboard_cards` — inherit project membership.
- `api_keys` — readable only by the workspace owner.
- API routes bypass RLS using `service_role` key; auth is enforced at the route handler layer by validating API key hash.

### 6.3 Next.js API Routes (`/app/api/`)
| Route | Purpose |
|---|---|
| `POST /api/auth/[...nextauth]` | Supabase Auth integration (if needed) |
| `GET/POST /api/v1/projects` | Public agent API — project CRUD |
| `GET/PATCH/DELETE /api/v1/projects/[id]/chapters/[cid]` | Chapter operations |
| `POST /api/v1/projects/[id]/assets` | Asset upload (streams to Supabase Storage) |
| `POST /api/v1/projects/[id]/export` | Enqueue export job |
| `GET /api/v1/exports/[jobId]` | Poll export status |
| `POST /api/v1/projects/[id]/ai/generate` | Proxy AI completion (Claude / GPT) |
| `POST /api/v1/webhooks/[projectId]` | Inbound webhook registration |

### 6.4 Background Jobs
- **Export worker** — Supabase Edge Function (or Next.js background route) that assembles EPUB/PDF/DOCX from chapter JSON; uses `pandoc` or a JS library (`epub-gen`, `jsPDF`, `docx`).
- **Word count sync** — trigger-based Postgres function that recomputes chapter `word_count` on content update.
- **Version snapshot** — Supabase Postgres function: auto-saves a `chapter_versions` row every N minutes if content changed.

---

## 7. Third-party Integrations

| Integration | Purpose | Priority |
|---|---|---|
| **Claude API** (Anthropic) | In-app AI assistant, writing suggestions, outline generation | P0 |
| **OpenAI** (DALL-E / GPT) | Alternative AI provider; image generation | P1 |
| **Stability AI** | Alternative image generation | P2 |
| **Unsplash API** | Free stock images for mood boards and covers | P1 |
| **Amazon KDP** (future) | Direct upload to KDP for self-publishers | P3 |
| **Stripe** | Subscription billing (Free / Pro / Studio plans) | P0 |
| **Resend / SendGrid** | Transactional email (invites, export ready, comments) | P0 |
| **Vercel Analytics** | Performance + usage telemetry | P1 |

---

## 8. Non-functional Requirements

| Requirement | Target |
|---|---|
| Auto-save latency | ≤ 500 ms after keystroke pause (debounced) |
| Editor load time | ≤ 1.5 s (chapter open) |
| Collab conflict resolution | CRDT (Yjs) — no data loss on simultaneous edits |
| Export turnaround | ≤ 30 s for a 100,000-word EPUB |
| API rate limit | 100 req/min per key (configurable) |
| Uptime target | 99.5 % |
| Mobile support | Responsive down to 390 px width; core editor functional on tablet |
| Accessibility | WCAG 2.1 AA for all primary flows |
| Data residency | Supabase region selectable at workspace creation |

---

## 9. Phased Delivery Roadmap

### Phase 1 — MVP (months 1–3)
- Auth (email + Google OAuth)
- Library dashboard + project CRUD
- Writing editor (TipTap, basic blocks, auto-save, version history)
- Outline panel (tree, drag-to-reorder, status badges)
- Asset library + inline images in editor
- Basic export: EPUB, PDF, DOCX, Markdown
- Supabase schema + RLS

### Phase 2 — Storyboard & Canvas (months 3–5)
- Storyboard view with image pinning
- Whiteboard canvas (tldraw integration)
- Cover Art Studio (upload + text overlay)
- Corkboard view

### Phase 3 — Collaboration & Preview (months 5–7)
- Real-time collab (Yjs + Supabase Realtime)
- Inline comments + threaded replies
- Change tracking (accept/reject)
- Live preview pane (e-book/blog/print modes)
- Collaborator invites + roles

### Phase 4 — AI & Agent API (months 7–9)
- In-app AI assistant (inline actions + chat panel)
- AI image generation (cover art + mood images)
- Public REST API v1 (full CRUD + storyboard + assets)
- API key management UI
- Outbound webhooks

### Phase 5 — Growth & Monetisation (months 9–12)
- Stripe subscription billing
- Usage-based API quotas
- Public share links + embedded previews
- Mobile-optimised writing view
- Unsplash integration
- Advanced export templates

---

## 10. Open Questions

1. **Conflict resolution UX** — when two collaborators edit the same paragraph, do we show a merge notification or silently apply CRDT? Need to validate with beta users.
2. **Canvas library** — tldraw v2 vs. Excalidraw: tldraw has a more polished React API; Excalidraw has a larger community. Decision pending prototype.
3. **Export rendering** — client-side (jsPDF / epub-gen) vs. server-side Edge Function. Server-side is more reliable for large docs; adds latency.
4. **AI model routing** — route all AI through a single model or let users configure per-project? Per-project adds complexity but is a differentiator.
5. **Offline mode** — IndexedDB + service worker for offline writing? Adds significant complexity; defer to Phase 5+.
6. **Pricing tiers** — Free (1 project, no collab, no API), Pro ($12/mo, 10 projects, 1 collaborator), Studio ($29/mo, unlimited, full API). Needs validation.

---

*This document will be updated with competitive research findings from live platform analysis.*