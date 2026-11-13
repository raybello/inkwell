# Inkwell Studio — build conventions

Read this before touching code. These conventions exist so nine parallel workstreams can land in one
repo without merge pain.

## Stack (already installed — do **not** run `npm install` or edit `package.json`)

Next.js 15 (App Router, React 19, TypeScript strict) · Tailwind CSS v4 · Supabase (`@supabase/ssr`) ·
TipTap 2 · tldraw 3.15 · @dnd-kit · yjs · pdf-lib · docx · jszip · turndown · sonner · lucide-react.

If a package you need is genuinely missing, **do not install it** — note it in your final summary and
use an existing dependency or a small hand-written implementation instead.

## Never do these

- Do not run `next build`, `next dev`, or `npm run dev` (the lead agent owns the build; concurrent
  builds corrupt `.next`). You may run `npx tsc --noEmit --pretty false` for type checks.
- Do not edit: `package.json`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`,
  `app/auth/**`, `lib/supabase/**`, `lib/auth.ts`, `lib/data.ts`, `lib/markdown.ts`, `lib/utils.ts`,
  `lib/types.ts`, `components/ui/**`, `components/layout/**`, `middleware.ts`,
  `supabase/migrations/**` — unless your task explicitly names the file.
- Do not commit `.env.local` or print secret values in output.
- Do not rewrite files owned by another stream. Additive changes to shared files are allowed only if
  unavoidable; keep them one-line and mention them in your summary.

## Design system

Dark, editorial, warm. Tokens (Tailwind classes generated from CSS vars in `app/globals.css`):

| token | use |
|---|---|
| `bg-background` / `text-foreground` | page surface / primary text |
| `bg-card`, `bg-card-hover` | panels, cards |
| `border-border`, `border-border-strong` | hairlines |
| `text-muted`, `text-muted-strong` | secondary / tertiary text |
| `text-accent` (`#c8814a`), `bg-accent`, `text-accent-soft` | primary action, highlights |
| `text-sage` (`#7d9a7e`), `text-plum` | success / secondary accents |
| `font-serif` (Fraunces) | headings, editor prose |
| `font-sans` (Inter) | UI |
| `font-mono` | counts, code, metadata |

Rules
- Radius: `rounded-md` for controls, `rounded-xl` for panels. Hairline borders everywhere; avoid heavy shadows.
- Type scale: page title `font-serif text-3xl/4xl`, section title `font-serif text-lg`, body `text-sm`,
  meta `text-[11px] uppercase tracking-[0.16em] text-muted`.
- No pure black/white. No gradient buttons. No emoji in UI copy.
- Every interactive element needs a hover state and an `aria-label` when icon-only.
- Use `cn()` from `@/lib/utils` for conditional classes.

## UI kit (use these, don't re-invent)

```
@/components/ui/button      Button (variant: primary|secondary|ghost|outline|danger|paper|link, size sm|md|lg|icon, loading)
@/components/ui/input       Input, Textarea, Select, Label, Field
@/components/ui/card        Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
@/components/ui/badge       Badge (tone), STATUS_TONE, STATUS_LABEL
@/components/ui/dialog      Dialog (open, onOpenChange, title, description, footer, width)
@/components/ui/dropdown    Dropdown, DropdownItem, DropdownSeparator, DropdownLabel
@/components/ui/misc        Avatar, Skeleton, EmptyState, Progress, Switch, Tabs, Tooltip
@/components/ui/theme-toggle ThemeToggle
```

Icons: `lucide-react` only. Toasts: `sonner` (`toast.success/error/promise`).

## Data & auth

```ts
// server components / server actions
import { createClient } from "@/lib/supabase/server";   // RLS-scoped, user session
import { createAdminClient } from "@/lib/supabase/admin"; // service role, trusted server only
import { getProjectContext, listChapters, listAssets } from "@/lib/data";
import { getSessionUser, getProfile, requireUser } from "@/lib/auth";
```

`getProjectContext(id)` returns `{ project, role, canEdit, canComment, isOwner, members, profile }`
and 404s if the caller has no access. Use it in every project route.

Browser-side writes go through Supabase directly with `createClient()` from `@/lib/supabase/client`
(RLS enforces permissions) **or** through a server action. Prefer server actions for anything that
must also log activity / dispatch webhooks.

Server actions live in `lib/actions/*.ts` with `"use server"` at the top. Shape:

```ts
export type ActionState = { error?: string; success?: string } | null;
export async function doThingAction(_prev: ActionState, fd: FormData): Promise<ActionState>
// or simple (input: T) => Promise<{ ok: boolean; error?: string; data?: X }>
```

Always `revalidatePath()` after mutations. Never trust client-supplied `project_id`/`user_id`.

## Chapter content

- `chapters.content` = TipTap JSON (`{ type: "doc", content: [...] }`)
- `chapters.content_md` = markdown mirror, **must be updated on every save** (triggers compute
  `word_count` from it)
- Helpers in `@/lib/markdown`: `tiptapToHtml`, `tiptapToMarkdown`, `htmlToMarkdown`,
  `markdownToTiptap`, `plainText`, `countWords`, `EMPTY_DOC`
- Editor extensions: `buildExtensions({ placeholder })` from `@/lib/editor/extensions` (client).
  Server HTML rendering uses `baseExtensions`.

## Storage

`lib/storage.ts`: `uploadProjectAsset({ projectId, file, filename, contentType })`,
`deleteProjectAsset(id)`, `publicAssetUrl(path)`, `uploadExport(name, bytes, contentType)`.
Bucket `assets` is public-read, path prefix = project id (storage policies enforce write access).
Bucket `exports` is public-read for download links.

## Activity, notifications, webhooks

```ts
import { logActivity, notify } from "@/lib/activity";
import { emitWebhookEvent } from "@/lib/webhooks"; // "chapter.created" | "chapter.updated" | ...
```

Call `logActivity` on meaningful mutations, `emitWebhookEvent` for chapter/asset/export/comment events.

## Routes (owner in brackets — do not create files outside your own)

```
/app                                            library              [lead]
/app/projects/new                               wizard               [lead]
/app/projects/[id]                              project overview     [outline]
/app/projects/[id]/editor/[chapterId]           writing editor       [editor]
/app/projects/[id]/storyboard                   storyboard           [storyboard]
/app/projects/[id]/corkboard                    corkboard            [storyboard]
/app/projects/[id]/canvas                       canvas list          [canvas]
/app/projects/[id]/canvas/[canvasId]            canvas board         [canvas]
/app/projects/[id]/assets                       asset library        [assets]
/app/projects/[id]/preview                      preview              [export]
/app/projects/[id]/export                       export               [export]
/app/projects/[id]/settings                     collab + project     [collab]
/app/settings, /app/settings/api, /app/settings/billing             [growth / api]
/share/[token]                                  public share         [export]
/docs/api                                       API reference        [api]
/api/v1/**                                      public REST API      [api]
```

## Verification you must do before finishing

1. `npx tsc --noEmit --pretty false 2>&1 | grep -E "your files|error TS" | head -40` — no errors in
   files you own.
2. Re-read your route entry points and confirm every import exists (paths + named exports).
3. Confirm mutations are RLS-safe: the client is the user-scoped one unless you are in a trusted
   route handler doing API-key auth.
4. In your final summary list: files created, files modified, anything not finished, and any
   shared-file edits.

## Seed data for manual checks

Supabase project is live. Demo login: `demo@inkwell.studio` / `inkwell-demo-2026`.
Seeded project id: `0deff67b-c27a-4147-868d-0310d66eaa8d` ("The Salt Road", 5 chapters, notes,
storyboard cards, 2 canvases, one comment thread).
