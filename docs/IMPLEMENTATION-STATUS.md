# Implementation status — Inkwell Studio

Snapshot of what is built, what is verified, and what is deliberately left open.
All five phases from `Phase.md` have working surfaces in this repo.

## Verified end-to-end (against the live Supabase project)

| Flow | Evidence |
|---|---|
| Email/password auth, protected `/app`, session refresh | sign-in → library renders; unauth `/app` → 307 to login |
| Project CRUD + wizard | seeded project opens; new-project wizard posts a real row |
| Editor autosave | typed text → `chapters.content` + `content_md` + trigger-computed `word_count` (verified by SQL) |
| Version snapshots | auto snapshot written by trigger on content change; named snapshots via UI |
| Storyboard / corkboard | 5 cards from seeded chapters; drag reorder server actions; asset tray with 5 uploaded images |
| Assets | 5 SVG assets uploaded to Supabase Storage, listed with tags/size |
| Export | EPUB 3 (valid zip: mimetype, container, OPF, nav, 5 XHTML chapters), PDF print (pdf-lib: 8 pages at 432×648 pt = 6×9 in), Markdown — all generated, stored and downloadable |
| Public share | `/share/<token>` renders the read-only reader for `is_public` projects |
| Agent API | key auth (401 invalid/missing), `GET/POST projects`, `GET/POST/PATCH/DELETE chapters`, `append`, `storyboard`, `export` + poll to `done`, `ai/generate` offline fallback, `X-RateLimit-*` + `X-Request-Id` headers |
| Notifications | list/mark-read works; probe rows cleaned |

## Access control

- `profiles.plan` drives quotas (`lib/plans.ts`): Free = 5 projects / 25k words, Pro = 10 projects,
  Studio = unlimited. Enforced server-side on create and duplicate, not just in the UI.
- `profiles.is_admin` grants unrestricted access: no quotas, and `project_role()` returns `owner`
  for every project, so all RLS policies open up. Grant with:
  `update public.profiles set is_admin = true where email = '...';`
- Project listing is membership-only. A `is_public` flag can no longer push a project into someone
  else's library — public reading happens exclusively through `/share/<token>` (which validates the
  share link before using the service role).

## Built but not exercised in the browser

- **Canvas (tldraw 3.15)** — mounts and renders (verified), autosave path code-reviewed; headless
  Chromium saturates the main thread on tldraw's render loop, so drag/draw interactions were not
  automated. Manual check recommended.
- **Stripe checkout / portal** — request shapes implemented with raw `fetch`; no keys configured, so
  the UI runs in clearly-labelled demo mode (no payment, no silent plan change).
- **Resend email** — no key configured; `sendEmail()` returns `{sent:false, reason:'email_not_configured'}`.
- **AI providers** — no Anthropic/OpenAI keys; the deterministic offline provider is used and every
  response is labelled `[offline draft — no AI provider configured]`.
- **Unsplash** — no key; curated hotlinked fallback set with an explicit banner.
- **Realtime collaboration** — Yjs over Supabase broadcast is implemented with a join handshake,
  awareness cursors and a 2.5 s local-mode fallback; two-browser manual test recommended.

## Known limitations (honest list)

1. **tldraw licence** — the canvas uses tldraw's free tier, which shows the "made with tldraw"
   watermark. Production needs a tldraw licence key (or the Excalidraw fallback noted in the PRD).
2. **Rate limiting is per-instance** (in-memory token bucket). Multi-instance deployments need a
   shared store (Upstash/Postgres) before quotas are trustworthy.
3. **PDF images** — pdf-lib embeds PNG/JPEG; SVG/WebP/GIF inline images degrade to alt text. EPUB and
   HTML embed all formats.
4. **`npm audit`** — 0 critical. Remaining highs need a Next 16 major (`postcss`) and a Zod 4 major;
   both were deliberately deferred rather than half-migrated. Next is on 15.5.29 (CVE-2025-66478 fixed).
5. **Custom export templates** (user-authored) are not implemented; the three presets are.
6. **Change tracking** is a version-diff review (accept/reject per hunk), not a live track-changes
   layer inside the editor.
7. **Daily writing goal** is browser-local per project/day; it is not synced across devices.
8. **Comment anchors** use ProseMirror document positions, so they can drift if the text above them is
   heavily rewritten. The quoted text is stored alongside for recovery.

## Layout of the codebase

```
app/                      routes: marketing, auth, /app, /share, /docs, /api
components/{ui,layout,editor,outline,projects,assets,cover,storyboard,canvas,preview,export,comments,collab,webhooks,api,settings,docs,integrations}
lib/{actions,api,export,editor,collab,supabase}/   server actions, REST layer, generators
supabase/migrations/      schema + RLS (0001), export job update policy (0002)
scripts/                  db-push, seed, seed-assets, verify-export
docs/                     CONVENTIONS.md, MOBILE-AUDIT.md, IMPLEMENTATION-STATUS.md
```

## Run

```bash
npm install
npm run db:push && npm run db:seed     # schema + demo project
npm run dev                            # http://localhost:3000
```

Demo: `demo@inkwell.studio` / `inkwell-demo-2026`.
