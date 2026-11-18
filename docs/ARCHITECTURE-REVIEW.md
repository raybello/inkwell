# Architecture Review — November 2026

Review of the Inkwell Studio app (Next.js 15 + Supabase, ~42k LOC), with an
implementation plan and everything the plan committed to implemented in this
same branch (`chore/architecture-review`).

## What the codebase does well

- Consistent API layer: every v1 route goes through `withApi`
  (auth → plan gate → rate limit → envelope errors), so cross-cutting
  concerns live in one place.
- Server-side authorization is real: `app/app/layout.tsx` runs
  `requireUser()`, API routes verify API keys / Stripe signatures /
  session clients independently of middleware.
- The Tiptap ↔ Markdown mirror (`lib/markdown.ts`) is pure and
  dependency-light — easy to reason about and now covered by tests.
- No stray TODO/FIXME debt markers; naming and file layout are coherent.

## Findings and fixes (implemented here)

### 1. Dead ESLint config + zero lint gate — fixed
`next.config.ts` had `eslint: { ignoreDuringBuilds: true }` while ESLint was
not installed at all — the setting did nothing and hid the absence of a gate.
- Installed ESLint 9 (flat config, `eslint.config.mjs`) extending
  `next/core-web-vitals` + `next/typescript`.
- Removed `ignoreDuringBuilds`; `next build` now lints.
- Fixed all 25 errors the first full-codebase lint surfaced: unused imports
  / destructured vars, unescaped apostrophes in JSX, stale
  `eslint-disable-next-line` directives that no longer suppressed anything.
- Deliberate rules: `no-explicit-any` and `react-hooks/exhaustive-deps` are
  warnings (the codebase leans on documented `any` at Supabase/withApi
  boundaries); real type safety is enforced by strict `tsc`.

### 2. Zero tests — fixed (42 unit tests)
Vitest 3 added with `tests/unit/*.test.ts`, run in CI. Coverage targets the
pure, high-risk modules:
- `lib/api/keys.ts` — key generation/parsing, constant-time compare, scope
  normalization, rpm clamping
- `lib/api/rate-limit.ts` — token-bucket grant/block/refill/cap behaviour
  with fake timers
- `lib/plans.ts` — annual price math, limits, plan ladder ordering
- `lib/markdown.ts` — tiptap↔markdown round-trips, HTML→markdown
  sanitization (script/style stripping), word counting
- `lib/utils.ts` — id fallback for non-secure contexts, slugify, relative
  time buckets

**The tests immediately caught a real bug** (see #3).

### 3. API key generation could produce unparseable keys — fixed
`generateApiKey` built prefixes/secrets from `base64url`, whose alphabet
contains `_` — the same character used as the structural separator in
`ink_live_<prefix>_<secret>`. Whenever a `_` landed inside the prefix,
`parseApiKey` split the key at the wrong boundary, so the parsed prefix no
longer matched the stored one and the key could never authenticate.
Probability was non-trivial (~36% of generated keys over 14 prefix chars).
Fix: map `_` → `-` (allowed by the parser, never a separator) in generated
prefixes and secrets. A regression test now round-trips 2,000 generated
keys through the parser.

### 4. `comparePlans` violated its own contract — fixed
Doc comment promised `-1 / 0 / 1`; the implementation returned the raw
index delta (±2 possible). The single current call site only uses the
sign, but future callers switching on the value would break. Now returns
`Math.sign(...)` and is tested.

### 5. Middleware ran auth on every request — fixed
The matcher was a catch-all minus static assets, so Supabase
`auth.getUser()` executed for marketing pages, `/share/[token]`,
`/docs`, every `/api/*` route (including the Stripe webhook, which does
its own signature verification, and the keyed v1 API) — adding a network
round-trip and cookie work to requests that never use the session.
Matcher narrowed to `["/app/:path*", "/auth/:path*"]`. Auth safety is
unchanged: `/app/*` is guarded server-side by `requireUser()` in
`app/app/layout.tsx`, and API routes build their own clients.

### 6. No security headers — fixed (baseline)
`next.config.ts` now sends `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`,
`X-Frame-Options: SAMEORIGIN`, a restrictive `Permissions-Policy`, and
HSTS (2 years, includeSubDomains, preload). A strict CSP was
deliberately **not** added in this PR: Next injects inline bootstrap
scripts and tldraw ships inline styles — a working CSP needs per-route
policy work and staging validation, half-measures here would break the
canvas.

### 7. CI drift — fixed
`.nvmrc` pins Node 22; CI and deploy workflows installed Node 20. Both
now use 22, and CI gained `Lint` and `Unit tests` steps before
`Typecheck`/`Build`.

### 8. Unused dependencies — removed
`@tanstack/react-query`, `react-hook-form`, `@hookform/resolvers`,
`zustand` had zero imports anywhere (data fetching is server components +
server actions; forms are plain `<form action={serverAction}>`). Removed
from `package.json`.

## Deferred, with reasons (not implemented in this PR)

| Item | Why deferred |
| --- | --- |
| Next 16 migration | Major upgrade; needs its own branch with build + runtime soak. |
| Zod 4 migration | License/perf change is fine but touches every API input schema; do it with full request-contract tests first. |
| tldraw licence | Commercial licence decision for production use — a business call, not a code one. |
| Cross-instance rate-limit store | In-memory token bucket is per-instance; correct fix is Upstash/Redis. Needs a paid dependency decision. Fine at current traffic. |
| Strict CSP | See #6 — needs staged rollout with report-only mode first. |
| Hook-deps warnings (6) | Pre-existing `tick`-style re-render dependencies in canvas code; flagged as warnings, worth an editor-owner pass, not a drive-by fix. |

## Verification

- `npm run lint` — 0 errors (6 documented warnings)
- `npm run typecheck` — clean
- `npm test` — 42/42, run three times to rule out flakes
- `npm run build` — succeeds with headers + narrowed middleware
