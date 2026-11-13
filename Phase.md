# Inkwell Studio — Implementation Phases & Parallel Workstreams

**Version:** 0.1  
**Date:** 2026-11-13  

---

## Overview

This document breaks the implementation plan into independent phases and workstreams so different teams can work in parallel on unrelated components. Each phase has clear dependencies, deliverables, and integration points.

---

## Phase Dependencies Map

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Phase 1   │────▶│   Phase 2    │────▶│   Phase 3   │
│   MVP       │     │ Storyboard   │     │ Collab &    │
│             │     │ & Canvas     │     │ Preview     │
└─────────────┘     └──────────────┘     └─────────────┘
                              │                    │
                              ▼                    ▼
                       ┌──────────────┐     ┌─────────────┐
                       │   Phase 4    │◀────│   Phase 5   │
                       │ AI & API     │     │ Growth &    │
                       └──────────────┘     │ Monetisation│
                                            └─────────────┘
```

**Key Dependencies:**
- **Phase 2** requires Phase 1 (editor + schema) to build storyboard on top of
- **Phase 3** requires Phase 2 (canvas/storyboard) for preview integration
- **Phase 4** requires Phases 1–3 (full app structure before adding AI/API layer)
- **Phase 5** can run in parallel with Phase 4 but depends on core features being stable

---

## Phase 1 — MVP Foundation (Months 1–3)

### Goal
Build the core writing platform: auth, project management, editor, and basic export.

### Workstreams (Parallel Teams)

#### Team A: Backend & Database
**Focus:** Supabase schema, RLS policies, API foundation

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Set up Supabase project + schema | All tables created with RLS | None |
| Implement row-level security policies | Secure access control | Schema complete |
| Build core API routes (projects CRUD) | `/api/v1/projects/*` endpoints | Auth working |
| Create auth integration (email + Google OAuth) | Login/signup flows | Supabase config |

**Estimated:** 4 weeks  
**Can run in parallel with Team B & C?** ✅ Yes — backend is independent of frontend implementation

#### Team B: Frontend Core
**Focus:** Next.js app structure, routing, UI shell

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Set up Next.js 15 + Tailwind v4 + shadcn/ui | Base project with styling system | None |
| Implement route structure (all routes from PRD) | Working navigation skeleton | Frontend setup complete |
| Build Library dashboard (project cards, filters) | `/app` page with CRUD operations | Backend projects API ready |
| Create "New Project" wizard UI | Multi-step form for project creation | None |

**Estimated:** 5 weeks  
**Can run in parallel with Team A & C?** ✅ Yes — depends on backend API readiness

#### Team C: Writing Editor
**Focus:** TipTap editor, content management, auto-save

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Integrate TipTap 2 + Yjs provider | Collaborative-ready editor core | None (can be tested locally) |
| Implement block types (paragraph, heading, etc.) | All blocks from PRD spec | Editor core ready |
| Build auto-save with version history | Auto-save every 30s + named snapshots | Editor working |
| Add focus mode & typewriter scroll | Distraction-free writing experience | Editor UI complete |

**Estimated:** 6 weeks  
**Can run in parallel with Team A & B?** ✅ Yes — editor can be built and tested independently, integrated later

#### Team D: Export Engine (Backend)
**Focus:** Document generation for multiple formats

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Research export libraries (epub-gen, jsPDF, docx) | Technical comparison + recommendation | None |
| Build EPUB 3 exporter | Full EPUB with TOC, metadata, images | Chapter JSON schema ready |
| Build PDF exporters (print + screen modes) | Two PDF variants per PRD spec | EPUB working |
| Implement DOCX & Markdown export | Industry-standard manuscript format | All formats tested |

**Estimated:** 5 weeks  
**Can run in parallel with Team A?** ✅ Yes — can start after schema is defined, doesn't need full app

### Phase 1 Integration Milestone (Week 8–9)
All teams converge to:
- Connect editor to backend chapter storage
- Wire export buttons to generate downloadable files
- End-to-end test: create project → write chapter → export EPUB/PDF/DOCX

---

## Phase 2 — Visual Storytelling (Months 3–5)

### Goal
Add visual ideation tools: storyboard, whiteboard canvas, and cover art studio.

### Workstreams (Parallel Teams)

#### Team E: Storyboard View
**Focus:** Horizontal lane of chapter cards with image pinning

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Build horizontal scroll lane UI | Draggable chapter cards in lanes | Phase 1 editor + chapters API ready |
| Implement drag-to-reorder logic | Reorder chapters via drag-and-drop | Storyboard UI complete |
| Add image pinning to cards | Drag assets onto storyboard positions | Asset library from Phase 1 working |
| Create mood board strip per card | Multiple reference images on one card | Image upload working |

**Estimated:** 5 weeks  
**Dependencies:** Phase 1 (editor, chapters API, assets) ✅ Required

#### Team F: Whiteboard Canvas
**Focus:** Infinite canvas with tldraw/Excalidraw integration

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Integrate tldraw v2 or Excalidraw | Full-screen infinite canvas | None (can be tested standalone) |
| Build sticky notes, text boxes, shapes | All canvas elements from PRD | Canvas core working |
| Implement image import onto canvas | Drag assets from library onto canvas | Asset library API ready |
| Create "Clip to project" functionality | Save canvas items to storyboard/chapters | Storyboard API defined (can be stubbed) |

**Estimated:** 6 weeks  
**Dependencies:** Phase 1 (assets API for image upload) ✅ Required; Storyboard API can be mocked

#### Team G: Cover Art Studio
**Focus:** Upload, generate, and overlay text on cover images

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Build cover upload UI + Supabase storage integration | Upload covers for projects | Phase 1 assets infrastructure ready |
| Implement text overlay controls | Font/colour/sizing for title/subtitle/author | Cover image stored |
| Create export pipeline (300 dpi print + screen) | Two export variants per PRD spec | Image processing library chosen |

**Estimated:** 4 weeks  
**Dependencies:** Phase 1 (storage, project metadata) ✅ Required

### Phase 2 Integration Milestone (Week 15–16)
- Connect storyboard to chapter list from editor
- Wire canvas save buttons to create/update chapters
- Test cover art upload → export → preview flow

---

## Phase 3 — Collaboration & Preview (Months 5–7)

### Goal
Enable real-time collaboration and live content preview.

### Workstreams (Parallel Teams)

#### Team H: Real-Time Collaboration
**Focus:** Yjs CRDT + Supabase Realtime for multi-user editing

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Integrate Yjs provider with TipTap editor | Collaborative cursors + conflict resolution | Phase 1 editor working |
| Build presence indicators (collab avatars) | Show who's editing in real-time | Auth system from Phase 1 ready |
| Implement change tracking UI | Accept/reject individual edits | Editor supports block-level ops |

**Estimated:** 6 weeks  
**Dependencies:** Phase 1 (editor, auth) ✅ Required; Phase 2 (can work independently on collab features)

#### Team I: Comments & Notifications
**Focus:** Threaded comments and in-app alerts

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Build inline comment UI (highlight → comment) | Anchored comments per chapter | Editor supports anchor selection |
| Implement threaded replies | Nested comment structure | Comments table from Phase 1 schema ready |
| Create notification centre | In-app alerts for mentions, status changes | Real-time subscription working |

**Estimated:** 4 weeks  
**Dependencies:** Phase 1 (comments table, auth) ✅ Required

#### Team J: Live Preview Pane
**Focus:** Split-screen preview with multiple modes

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Build split-screen UI (editor left, preview right) | Toggleable side-by-side view | Editor working |
| Implement E-book preview mode | EPUB-style typography rendering | Chapter content accessible |
| Create Blog/Article preview mode | Web typography with responsive layout | Preview engine ready |
| Add Print preview mode | Book page layout simulation | CSS print styles defined |

**Estimated:** 5 weeks  
**Dependencies:** Phase 1 (editor, chapter data) ✅ Required; Phase 2 (can integrate cover art into preview)

### Phase 3 Integration Milestone (Week 20–22)
- Test multi-user editing with conflict scenarios
- Verify comments appear in real-time for all collaborators
- Preview modes render correctly across devices

---

## Phase 4 — AI & Agent API (Months 7–9)

### Goal
Add AI-powered features and public REST API for automation.

### Workstreams (Parallel Teams)

#### Team K: In-App AI Assistant
**Focus:** Claude/GPT integration for writing assistance

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Integrate Anthropic/Claude API | Model selection + rate limiting | None (can be tested with mock responses) |
| Build inline AI actions menu | Rephrase, expand, tone change, etc. | Editor supports text selection |
| Create AI Chat panel | Context-aware assistant per chapter | Chapter content accessible |
| Implement AI image generation | DALL-E/Stability AI for covers/mood images | Image upload/storage from Phase 1 ready |

**Estimated:** 6 weeks  
**Dependencies:** Phase 1 (storage, editor) ✅ Required; can start API integration early

#### Team L: Public REST API v1
**Focus:** Full CRUD + export + webhook endpoints

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Implement all core endpoints from PRD spec | `/api/v1/*` routes for projects, chapters, assets, etc. | Phase 1 backend foundation ready |
| Add API key authentication | Bearer token validation + scopes | Auth system working |
| Build rate limiting middleware | Configurable per-key limits (default 100 req/min) | API routes defined |
| Create webhook registration endpoint | `/api/v1/webhooks/[projectId]` for outbound notifications | None |

**Estimated:** 6 weeks  
**Dependencies:** Phase 1 (core schema, auth) ✅ Required; can run in parallel with Team K

#### Team M: Webhook System
**Focus:** Outbound webhook delivery to external agents

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Build webhook dispatcher service | Queue + retry logic for outbound calls | API key system ready |
| Implement event triggers (chapter.created, etc.) | Fire webhooks on specified events | All core mutations tracked |
| Create webhook configuration UI | Per-project URL + secret management | None |

**Estimated:** 3 weeks  
**Dependencies:** Team L (API key auth) ✅ Required; can start after API v1 is stable

### Phase 4 Integration Milestone (Week 28–30)
- Test AI features end-to-end (generate content → save to chapter)
- Verify API endpoints return correct data with proper authentication
- Webhooks fire on expected events and are received by test receivers

---

## Phase 5 — Growth & Monetisation (Months 9–12)

### Goal
Add billing, sharing features, and mobile optimization.

### Workstreams (Parallel Teams)

#### Team N: Subscription Billing
**Focus:** Stripe integration + usage-based quotas

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Integrate Stripe for subscriptions | Free/Pro/Studio plans from PRD | None (can be tested with test mode) |
| Build usage tracking (API calls, exports, etc.) | Metered billing per plan tier | API endpoints defined |
| Create billing UI in settings | Plan display + upgrade/downgrade flows | Stripe integration ready |

**Estimated:** 5 weeks  
**Dependencies:** Phase 4 (API for metering) ✅ Required; can start early with mock data

#### Team O: Public Sharing & Embeds
**Focus:** Read-only share links and embedded previews

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Generate public share URLs | `/share/[token]` read-only preview | Chapter content accessible |
| Build embedded preview component | `<iframe>` or JS embed for websites | Preview engine from Phase 3 ready |
| Create sharing settings UI | Toggle on/off per project + custom domains | None |

**Estimated:** 4 weeks  
**Dependencies:** Phase 3 (preview modes) ✅ Required; can run in parallel with Team N

#### Team P: Mobile Optimization
**Focus:** Responsive design and tablet functionality

| Task | Deliverable | Dependencies |
|------|-------------|--------------|
| Audit all screens for mobile responsiveness | Test down to 390 px width | All core features complete |
| Optimize editor for touch devices | Touch-friendly UI elements | Editor working |
| Create mobile-optimized writing view | Simplified interface for tablets | None (can be built incrementally) |

**Estimated:** 6 weeks  
**Dependencies:** Core app stable ✅ Recommended to start after Phase 3; can run in parallel with Teams N & O

### Phase 5 Integration Milestone (Week 40–42)
- Verify billing flows work end-to-end (subscribe → usage tracked → invoice generated)
- Test share links on mobile devices
- Mobile writing experience is functional and usable

---

## Parallel Workstream Matrix

| Team | Primary Focus | Can Run in Parallel With | Blocked By |
|------|---------------|--------------------------|------------|
| A: Backend & DB | Schema, RLS, core API | B, C, D | None |
| B: Frontend Core | Next.js setup, routing, UI shell | A, C, D | None |
| C: Writing Editor | TipTap editor, blocks, auto-save | A, B, D | None (integration later) |
| D: Export Engine | EPUB/PDF/DOCX generation | A | Schema defined |
| E: Storyboard View | Horizontal lanes, image pinning | F | Phase 1 complete |
| F: Whiteboard Canvas | tldraw/Excalidraw integration | E | Assets API ready |
| G: Cover Art Studio | Upload + text overlay | H, I, J | Phase 1 storage ready |
| H: Real-Time Collab | Yjs CRDT, presence | I, J | Phase 1 editor/auth |
| I: Comments & Notifications | Threaded comments, alerts | H, J | Phase 1 schema |
| J: Live Preview Pane | Split-screen preview modes | G, H, I | Phase 1 editor/data |
| K: In-App AI Assistant | Claude/GPT integration | L, M | Storage/editor ready |
| L: Public REST API v1 | Full CRUD + auth endpoints | K, M | Phase 1 backend |
| M: Webhook System | Outbound webhook delivery | L | API key system |
| N: Subscription Billing | Stripe, usage tracking | O, P | API metering defined |
| O: Public Sharing & Embeds | Share URLs, embed component | N, P | Phase 3 preview modes |
| P: Mobile Optimization | Responsive design, touch UI | N, O | Core app stable |

---

## Resource Allocation Recommendations

### Minimum Viable Team (4–5 people)
- **1 Backend Lead** (Teams A, D, L, M)
- **2 Frontend Developers** (Teams B, C, E, F, J)
- **1 Full-Stack Developer** (Teams G, H, I, K, N, O)

### Recommended Team (8–10 people for 9-month timeline)
- **2 Backend Engineers** (A, D, L, M)
- **3 Frontend Engineers** (B, C, E, F, J)
- **2 Full-Stack Engineers** (G, H, I, K, N, O)
- **1 DevOps/Platform Engineer** (infrastructure, CI/CD, monitoring)

---

## Risk Mitigation

| Risk | Impact | Mitigation Strategy |
|------|--------|---------------------|
| Editor integration delays | High | Build editor as standalone component; mock backend during dev |
| AI API rate limits | Medium | Implement caching + request batching early in Phase 4 |
| Export performance issues | High | Profile export jobs from Week 1 of Phase 1; consider server-side rendering |
| Real-time conflict UX complexity | Medium | Validate with beta users before full implementation (Phase 3) |
| Mobile responsiveness debt | Medium | Add mobile testing to CI/CD from Phase 2 onwards |

---

## Success Metrics by Phase

### Phase 1 MVP
- [ ] User can create project, write chapter, export EPUB/PDF/DOCX in < 5 min total time
- [ ] Editor auto-save latency ≤ 500 ms (PRD target)
- [ ] Export turnaround ≤ 30 s for 100k-word document

### Phase 2 Storyboard & Canvas
- [ ] Storyboard drag-to-reorder works smoothly on desktop + tablet
- [ ] Cover art export produces print-ready quality images
- [ ] Canvas supports ≥ 50 elements without performance degradation

### Phase 3 Collaboration & Preview
- [ ] Real-time editing with ≤ 2 s latency between collaborators
- [ ] Preview modes render correctly across all target devices
- [ ] Comment threads load and update in real-time

### Phase 4 AI & API
- [ ] AI features generate usable content (user satisfaction > 70%)
- [ ] Public API supports ≥ 100 req/min with < 200 ms p95 latency
- [ ] Webhooks deliver events within ≤ 5 s of triggering event

### Phase 5 Growth & Monetisation
- [ ] Billing flows complete successfully (no payment failures in test)
- [ ] Share links work on mobile + desktop browsers
- [ ] Mobile writing experience rated ≥ 4/5 by beta users

---

## Next Steps

1. **Week 0–1:** Finalize team assignments, set up development environments
2. **Week 1:** Kick off Phase 1 with Teams A (Backend), B (Frontend Core), C (Editor) running in parallel
3. **Weekly syncs:** Review progress against milestones; adjust scope if needed
4. **Bi-weekly demos:** Show working features to stakeholders for feedback

---

*This document will be updated as implementation progresses and dependencies shift.*
