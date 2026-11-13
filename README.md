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

### Running from VS Code

`.vscode/launch.json` ships three runnable configurations:

| Configuration | What it does |
|---|---|
| **inkwell: dev server** | `npm run dev`, opens the browser when Next reports its Local URL |
| **inkwell: build + serve (production)** | `npm run build && npm run start` in one terminal |
| **inkwell: debug dev server (breakpoints)** | `npm run dev:debug` with `--inspect`, so breakpoints in server components, route handlers and server actions hit |

The production entry must use `"type": "node-terminal"`. A plain `node` launch passes
`runtimeArgs` as separate arguments — putting `" && "` and a second `npm` there appends them to
`next build`, which then reports *"Invalid project directory provided"*. Builds are also available as
tasks (`Terminal → Run Task → inkwell: build`), with a `$tsc` problem matcher.

### Database

```bash
npm run db:push        # applies supabase/migrations/*.sql to the linked project
npm run db:seed        # demo user + "The Salt Road" sample project
```

Demo credentials: `demo@inkwell.studio` / `inkwell-demo-2026`.

### Plans and access levels

Free accounts own up to **5 projects** (defined once, in `lib/plans.ts`); Pro and Studio raise that
limit. Quotas are enforced in `createProjectAction` / `duplicateProjectAction`.

To give an account unrestricted access — unlimited projects, every feature, and owner rights on
every project — flip one column:

```sql
update public.profiles set is_admin = true where email = 'you@example.com';
-- revoke:
update public.profiles set is_admin = false where email = 'you@example.com';
```

`is_admin` is read by `public.is_admin()`, which `project_role()` and `is_project_member()` consult,
so every existing RLS policy grants that account full access. The sidebar shows "Unlimited access"
and plan quotas are skipped in server actions and the billing screen.

## What is implemented

| Area | Routes |
|---|---|
| Library, project CRUD, wizard | `/app`, `/app/projects/new` |
| Project overview, outline tree, notes | `/app/projects/[id]` |
| Writing editor, versions, find & replace, realtime | `/app/projects/[id]/editor/[chapterId]` |
| Storyboard, corkboard | `/app/projects/[id]/storyboard`, `.../corkboard` |
| Cover art (front + back, layer editor) | `/app/projects/[id]/cover` |
| Whiteboard canvas | `/app/projects/[id]/canvas`, `.../canvas/[canvasId]` |
| Asset library | `/app/projects/[id]/assets` |
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
- **Exports** are generated server-side (`pdf-lib`, `docx`, `jszip`), stored in the Supabase
  `exports` bucket, tracked in `export_jobs`.
- **Cover art** is a layer document (`projects.cover_front` / `cover_back`, see `lib/cover-art.ts`)
  rendered in the browser at 2× to PNG (`cover_front_url` / `cover_back_url`). EPUB, print/screen
  PDF, DOCX, HTML and JSON all embed the rendered front (and back, where the format has one).
- **Theme**: `html.light` inverts the `ink-*` ramp instead of remapping components, so every
  surface/text pair written against the tokens keeps its contrast. Paper surfaces (editor, storyboard
  captions, preview) pin the ramp back so they stay dark-on-cream in both themes.
- **Realtime** uses Supabase channels: Yjs updates for the editor, presence for collaborator avatars.
- **Webhooks** are signed (`X-Inkwell-Signature: sha256=<hmac>`) with retries and delivery logs.

See `docs/IMPLEMENTATION-STATUS.md` for what is verified, what is not, and the known gaps (tldraw
licence watermark, per-instance rate limiting, pdf-lib image formats, deferred Next 16 / Zod 4 majors).
`docs/CONVENTIONS.md` holds the working conventions; `PLAN.md` and `Phase.md` are the product spec.
`docs/MOBILE-AUDIT.md` records the responsive audit.
