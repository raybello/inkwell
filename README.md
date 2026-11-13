# Inkwell Studio

A Next.js 15 + Supabase workspace for the whole writing arc: draft, illustrate, storyboard,
organise, review, preview, publish — and an agent API for everything the UI can do.

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
```

Environment lives in `.env.local` (Supabase URL, publishable key, service-role key, DB password for
migrations). Integration keys (Anthropic/OpenAI/Unsplash/Resend/Stripe) are optional — every feature
that needs one degrades gracefully and says so.

### Database

```bash
npm run db:push        # applies supabase/migrations/*.sql to the linked project
npm run db:seed        # demo user + "The Salt Road" sample project
```

Demo credentials: `demo@inkwell.studio` / `inkwell-demo-2026`.

## What is implemented

| Area | Routes |
|---|---|
| Library, project CRUD, wizard | `/app`, `/app/projects/new` |
| Project overview, outline tree, notes | `/app/projects/[id]` |
| Writing editor, versions, find & replace, realtime | `/app/projects/[id]/editor/[chapterId]` |
| Storyboard, corkboard | `/app/projects/[id]/storyboard`, `.../corkboard` |
| Whiteboard canvas | `/app/projects/[id]/canvas`, `.../canvas/[canvasId]` |
| Asset library, cover studio | `/app/projects/[id]/assets` |
| Live preview (e-book / blog / print) | `/app/projects/[id]/preview` |
| Export (MD, DOCX, EPUB, PDF print/screen, HTML, JSON) | `/app/projects/[id]/export` |
| Collaborators, history, webhooks | `/app/projects/[id]/settings` |
| Comments, notifications | editor rail, `/app/notifications` |
| API keys, billing, account settings | `/app/settings/*` |
| Public share links | `/share/[token]` |
| Agent REST API + docs | `/api/v1/*`, `/docs/api` |

## Architecture

- **App Router** with server components for reads and server actions for writes; RLS is the
  authorisation boundary for anything user-scoped.
- **Service role** is only used for API-key authenticated routes, export storage, and webhook delivery.
- **Content model**: `chapters.content` (TipTap JSON) with `chapters.content_md` mirror; Postgres
  triggers keep `word_count` and an auto version snapshot (< every 10 minutes).
- **Exports** are generated server-side (`pdf-lib`, `docx`, `jszip`, `turndown`), stored in the
  Supabase `exports` bucket, tracked in `export_jobs`.
- **Realtime** uses Supabase channels: Yjs updates for the editor, presence for collaborator avatars.
- **Webhooks** are signed (`X-Inkwell-Signature: sha256=<hmac>`) with retries and delivery logs.

See `docs/CONVENTIONS.md` for the working conventions and `PLAN.md` / `Phase.md` for the product spec.
