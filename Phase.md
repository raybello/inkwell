# Implementation Phases — Inkwell Studio

**Version:** 0.1  
**Date:** 2026-11-13  
**Purpose:** Break down the PRD into parallelizable work streams

---

## Overview

This document organizes the implementation into **4 major phases** with **parallel work streams** within each phase. Work streams marked with matching emoji (🔵/🟢/🟡/🟣) can be developed concurrently by different teams/developers.

---

## Phase 1: Foundation (Months 1–3)
**Goal:** Ship a functional MVP — auth, projects, basic writing, and export

### 🔵 Stream 1A: Infrastructure & Data Layer
**Owner:** Backend Engineer  
**Dependencies:** None

- Set up Next.js 15 project (App Router)
- Supabase project creation + region config
- Implement complete database schema (all tables from section 6.1)
- Row-Level Security (RLS) policies for:
  - `projects`, `chapters`, `assets`, `comments`, `project_members`
- Supabase Auth integration (email + Google OAuth)
- API route structure (`/app/api/v1/*`)
- Middleware for auth protection

**Deliverables:**
- Working database with seed data
- Auth flow (login/signup/logout)
- Protected `/app` routes

---

### 🟢 Stream 1B: Core Editor Experience
**Owner:** Frontend Engineer (Editor)  
**Dependencies:** 1A (auth + basic schema)

- TipTap 2 editor setup with ProseMirror
- Block types: paragraph, H1–H4, blockquote, code, divider, table
- Editor toolbar component
- Auto-save (debounced, every 30s)
- Version history UI + named snapshots
- Focus mode toggle
- Typewriter scroll
- Word/character count (live)
- Find & Replace (chapter-scoped + project-wide)

**Deliverables:**
- `/app/projects/[id]/editor/[chapterId]` route fully functional
- Editor saves to `chapters.content` (jsonb)

---

### 🟡 Stream 1C: Project Structure & Navigation
**Owner:** Frontend Engineer (UI)  
**Dependencies:** 1A (auth + schema)

- Library dashboard (`/app`)
  - ProjectCard component (grid/list view)
  - Sort by last modified, type, genre
- Project creation wizard (`/app/projects/new`)
- Project metadata form (title, subtitle, type, genre, cover, tags, target word count)
- Outline panel (collapsible tree)
  - Drag-and-drop reorder with @dnd-kit
  - Status badges (Draft/In Progress/Complete/Needs Review)
  - Word count per chapter
  - Synopsis card per chapter
- Route structure for project home

**Deliverables:**
- Full library + project CRUD UI
- Navigable outline sidebar

---

### 🟣 Stream 1D: Asset Management & Images
**Owner:** Full-stack Engineer  
**Dependencies:** 1A (storage setup)

- Supabase Storage bucket setup (per-project access control)
- Asset upload flow (drag/drop or file picker)
- `AssetLibrary` component (grid view, search/filter by tags)
- Image block in editor (inline, caption, alt text, alignment, resize)
- API route: `POST /api/v1/projects/:id/assets`
- Asset deletion + storage cleanup

**Deliverables:**
- Working asset library UI
- Images insertable into editor
- Storage policies enforced

---

### 🔵 Stream 1E: Export System (Foundational)
**Owner:** Backend Engineer  
**Dependencies:** 1A (chapters schema), 1B (content format)

- Export job queue (`export_jobs` table)
- API route: `POST /api/v1/projects/:id/export`
- Export formats:
  - **Markdown** (direct from `content_md`)
  - **DOCX** (using `docx` npm package)
  - **EPUB 3** (using `epub-gen` or custom builder)
  - **PDF** (using `jsPDF` or `pdfkit` for screen/print modes)
- Export UI modal (`ExportModal` component)
- Polling mechanism: `GET /api/v1/exports/:jobId`

**Deliverables:**
- All 4 core export formats working
- 30s max turnaround for 100k-word project

---

## Phase 2: Visual Tools (Months 3–5)
**Goal:** Add storyboard, canvas, and cover art studio — image-first workflows

### 🟢 Stream 2A: Storyboard View
**Owner:** Frontend Engineer  
**Dependencies:** Phase 1 complete (chapters + assets exist)

- Storyboard route: `/app/projects/[id]/storyboard`
- Horizontal scroll lane with chapter cards
- `StoryboardLane` + `StoryboardCard` components
- Card displays: cover image, title, synopsis, word count, status
- Drag-to-reorder chapters from storyboard
- Image pinning: drag asset-library image → storyboard card
- Mood board strip (multiple images per card)
- API: `POST /api/v1/projects/:id/storyboard/:cid/image`

**Deliverables:**
- Full storyboard UI with image management
- Clicking card opens editor

---

### 🟡 Stream 2B: Whiteboard Canvas
**Owner:** Frontend Engineer (Canvas)  
**Dependencies:** Phase 1A (canvases schema)

- Canvas route: `/app/projects/[id]/canvas/[canvasId]`
- Integrate **tldraw v2** (or Excalidraw fallback)
- Canvas elements: sticky notes, text, shapes, freehand, images, arrows
- Multiple named canvases per project
- Auto-save canvas state to `canvases.content` (jsonb)
- "Clip to project" action: save canvas selection → chapter notes or storyboard
- Asset library sidebar in canvas view (drag images onto canvas)

**Deliverables:**
- Infinite whiteboard with full element support
- Canvas persistence in DB

---

### 🔵 Stream 2C: Cover Art Studio
**Owner:** Full-stack Engineer  
**Dependencies:** 1D (asset upload working)

- Cover art upload + preview
- Text overlay editor:
  - Title, subtitle, author name
  - Font picker (Google Fonts integration)
  - Colour picker
  - Position/alignment controls
- Export cover as 300 dpi PNG (print-ready)
- Save cover as project metadata (`projects.cover_image_url`)
- Optional: basic templates (minimalist, literary, modern)

**Deliverables:**
- Cover art studio UI
- Export high-res cover image

---

### 🟢 Stream 2D: Corkboard View
**Owner:** Frontend Engineer  
**Dependencies:** 2A (storyboard cards)

- Corkboard view: grid layout of chapter synopsis cards
- Drag-to-reorder in grid
- Colour-code by POV, arc, subplot (metadata tags on chapters)
- Toggle between storyboard (horizontal) and corkboard (grid)

**Deliverables:**
- Corkboard as alternative view of chapters

---

## Phase 3: Collaboration (Months 5–7)
**Goal:** Real-time editing, comments, change tracking, preview

### 🟣 Stream 3A: Real-time Collaboration
**Owner:** Full-stack Engineer (Collab)  
**Dependencies:** 1B (editor working)

- Integrate **Yjs** CRDT provider
- Supabase Realtime connection for presence + collab
- Collaborative cursors in editor
- `CollabAvatars` component (live presence indicators)
- Conflict-free simultaneous editing
- Test with multiple users editing same chapter

**Deliverables:**
- Google Docs–style real-time collab
- No data loss on concurrent edits

---

### 🟢 Stream 3B: Comments & Change Tracking
**Owner:** Frontend Engineer  
**Dependencies:** 3A (collab setup), 1A (comments schema)

- Inline comment anchors (highlight text → add comment)
- `CommentThread` component (replies, resolve button)
- Comment panel/sidebar
- Change tracking UI (accept/reject edits)
- Notification centre (in-app alerts for new comments, mentions)
- Activity feed per project

**Deliverables:**
- Full commenting + change-tracking workflow

---

### 🔵 Stream 3C: Collaborator Management
**Owner:** Backend Engineer  
**Dependencies:** 1A (project_members schema)

- Invite by email flow
- Role-based access: Owner, Editor, Reviewer, Viewer
- API route: `POST /api/v1/projects/:id/invites`
- Email notification (via Resend/SendGrid)
- Accept/decline invite UI
- RLS updates to enforce role permissions

**Deliverables:**
- Invite + role management fully functional

---

### 🟡 Stream 3D: Live Preview Pane
**Owner:** Frontend Engineer  
**Dependencies:** 1B (editor content), 1E (export logic)

- Preview route: `/app/projects/[id]/preview`
- Split-screen mode (editor left, preview right)
- Preview modes:
  - **E-book** (EPUB-style typography)
  - **Blog/Article** (web layout)
  - **Print** (A5/6×9 page layout with margins)
- Font, size, line-height, margin controls (preview-only, don't affect raw content)
- Full-screen preview toggle

**Deliverables:**
- Live preview pane with 3 modes

---

## Phase 4: AI & Agent API (Months 7–9)
**Goal:** In-app AI assistant + public agent REST API

### 🟢 Stream 4A: In-app AI Assistant
**Owner:** Full-stack Engineer (AI)  
**Dependencies:** 1B (editor), integration with Claude/OpenAI API

- AI action menu on text selection:
  - Rephrase, Improve, Expand, Shorten, Change tone, Translate, Summarise
- `AIAssistPanel` component (sliding chat panel)
- Context-aware AI chat (knows current chapter)
- Model selection UI (Claude, GPT-4o)
- API route: `POST /api/v1/projects/:id/ai/generate`
- AI outline suggester (from premise → chapter outline)

**Deliverables:**
- Working AI assistant in editor
- Model switcher

---

### 🟡 Stream 4B: AI Image Generation
**Owner:** Backend Engineer  
**Dependencies:** 1D (asset library)

- API integration with DALL-E / Stability AI / Midjourney
- Prompt → generate cover art or mood image
- Save generated image to asset library
- UI: text prompt field + generation button in Cover Art Studio + asset library
- API route: `POST /api/v1/projects/:id/ai/image`

**Deliverables:**
- AI-generated images saved as assets

---

### 🔵 Stream 4C: Public Agent API (Core CRUD)
**Owner:** Backend Engineer (API)  
**Dependencies:** 1A (all schemas), 1E (export)

- API key generation + management UI (`/app/settings/api`)
- `api_keys` table + hash-based auth
- Scoped permissions (projects:read, chapters:write, etc.)
- Rate limiting middleware (100 req/min default)
- Implement endpoints:
  - `GET/POST /api/v1/projects`
  - `GET/PATCH/DELETE /api/v1/projects/:id`
  - `GET/POST /api/v1/projects/:id/chapters`
  - `PATCH /api/v1/projects/:id/chapters/:cid`
  - `POST /api/v1/projects/:id/chapters/:cid/append`
  - `GET/POST /api/v1/projects/:id/assets`
  - `POST /api/v1/projects/:id/export`

**Deliverables:**
- Full REST API v1
- API key UI + docs

---

### 🟣 Stream 4D: Webhooks & Advanced API
**Owner:** Backend Engineer  
**Dependencies:** 4C (core API working)

- Outbound webhook configuration (per project)
- Webhook events:
  - `chapter.created`, `chapter.updated`, `chapter.deleted`
  - `asset.uploaded`, `export.completed`, `comment.created`
- Webhook retry logic + delivery logs
- API endpoints:
  - `GET/POST /api/v1/projects/:id/storyboard`
  - `POST /api/v1/projects/:id/canvases/:vid/elements`

**Deliverables:**
- Webhook system live
- Extended API coverage

---

## Phase 5: Growth & Polish (Months 9–12)
**Goal:** Monetisation, mobile, integrations, advanced features

### 🔵 Stream 5A: Billing & Monetisation
**Owner:** Full-stack Engineer  
**Dependencies:** Core product stable

- Stripe integration
- Subscription plans: Free, Pro ($12/mo), Studio ($29/mo)
- Usage-based API quotas (enforce in API middleware)
- Billing UI (`/app/settings/billing`)
- Upgrade/downgrade flow
- Trial period handling

**Deliverables:**
- Working subscription billing

---

### 🟢 Stream 5B: Mobile Optimisation
**Owner:** Frontend Engineer  
**Dependencies:** Phase 1–3 UI complete

- Responsive design down to 390 px width
- Mobile-optimised editor view (simplified toolbar)
- Touch-friendly storyboard drag
- Mobile preview modes
- PWA manifest + service worker (optional offline mode)

**Deliverables:**
- Fully responsive UI
- Tablet editing experience validated

---

### 🟡 Stream 5C: Third-party Integrations
**Owner:** Backend Engineer  
**Dependencies:** None (can run in parallel)

- **Unsplash API** — search stock images → asset library
- **Amazon KDP** — direct upload (export EPUB → KDP)
- Transactional email templates (Resend/SendGrid)
- Vercel Analytics setup

**Deliverables:**
- Unsplash search in asset library
- Email notifications working

---

### 🟣 Stream 5D: Advanced Export & Sharing
**Owner:** Full-stack Engineer  
**Dependencies:** 1E (basic export working)

- Custom style templates (Literary, Modern, Minimal)
- User-created export templates
- Public share links (`/share/[token]`)
- Read-only preview embeds
- Chapter-level export (single chapter as any format)

**Deliverables:**
- Template system
- Public sharing functional

---

## Parallelization Summary

### Phase 1 (MVP)
**Can run in parallel:**
- 🔵 1A + 🟢 1B (once auth is live)
- 🟡 1C (depends on 1A)
- 🟣 1D (depends on 1A)
- 🔵 1E (depends on 1A + 1B)

**Critical path:** 1A → 1B → 1E (longest pole)

---

### Phase 2 (Visual Tools)
**Can run in parallel:**
- All streams (2A, 2B, 2C, 2D) are **fully independent** after Phase 1 completes

**Fastest:** Can ship 2A (storyboard) and 2B (canvas) simultaneously

---

### Phase 3 (Collaboration)
**Can run in parallel:**
- 🟣 3A (collab) starts first (foundational)
- 🟢 3B (comments) depends on 3A
- 🔵 3C (invites) is **independent**
- 🟡 3D (preview) is **independent**

**Critical path:** 3A → 3B

---

### Phase 4 (AI & API)
**Can run in parallel:**
- All streams (4A, 4B, 4C, 4D) are **mostly independent**
- 4D depends on 4C (webhooks need core API)

**Fastest:** Run 4A, 4B, 4C concurrently; 4D follows 4C

---

### Phase 5 (Growth)
**Can run in parallel:**
- All streams (5A, 5B, 5C, 5D) are **fully independent**

**Recommendation:** Prioritize 5A (billing) first for revenue

---

## Dependency Graph (High-Level)

```
Phase 1A (Infrastructure) ─────┬─────────────────┐
                               ↓                 ↓
Phase 1B (Editor) ──────→ Phase 1E (Export)    Phase 1C (Structure)
       ↓                        ↓                ↓
Phase 2 (All parallel) ────────┴────────────────┘
       ↓
Phase 3A (Realtime) ──→ Phase 3B (Comments)
       ↓                        ↓
Phase 4C (API Core) ──→ Phase 4D (Webhooks)
       ↓                        ↓
Phase 5 (All parallel)
```

---

## Recommended Team Allocation (3-person team)

| Engineer | Primary Streams | Phase 1 | Phase 2 | Phase 3 | Phase 4 |
|---|---|---|---|---|---|
| **Engineer A** (Backend) | Infrastructure, Export, API | 🔵 1A, 1E | 🔵 2C | 🔵 3C | 🔵 4C, 4D |
| **Engineer B** (Frontend) | Editor, Preview | 🟢 1B | 🟢 2A, 2D | 🟢 3B | 🟢 4A |
| **Engineer C** (Full-stack) | Assets, Canvas, AI | 🟣 1D, 🟡 1C | 🟡 2B | 🟣 3A, 🟡 3D | 🟡 4B |

---

## Open Questions for Phasing

1. **Should we ship Phase 1 publicly before Phase 2?**  
   Recommendation: Yes — get user feedback on core editor before building visual tools.

2. **Can we defer export formats?**  
   Markdown + DOCX are critical; EPUB/PDF can wait until Phase 1E end if time-boxed.

3. **Should API (Phase 4) ship before Collaboration (Phase 3)?**  
   No — human collaboration is higher user value; agent API can follow.

4. **Which canvas library (tldraw vs Excalidraw)?**  
   Prototype both in first week of 2B; choose based on React API quality + image-drag UX.

---

*This phasing document assumes a 3–4 person team. Adjust parallelization based on actual headcount.*
