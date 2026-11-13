# Mobile audit — 390 px

Scope: Stream 5B. I audited **my own surfaces** (settings, billing, Unsplash picker) and every
cross-cutting screen owned by other streams. I did not edit other streams' files — each finding below
names the file, the line and a suggested fix for its owner.

Method: static review of layout, overflow and pointer/touch behaviour at a 390 × 844 CSS-pixel viewport
(iPhone 12/13/14 class, Safari chrome ≈ 90 px). The dev server belongs to the lead, so this is a
code-level audit, not a device screenshot sweep. Findings marked **[blocker]** break a task at 390 px;
**[tap]** means the control exists but is invisible or unreachable on touch; **[minor]** is polish.

> Re-verified against disk at the end of the audit. Several streams landed mobile fixes while this
> audit was being written (storyboard hover guards, editor drawers, collaborator labels); those are
> listed under "Already correct" rather than as findings.

## My own surfaces

| Surface | State at 390 px |
|---|---|
| `/app/settings` | Section nav becomes a horizontal scroller (`app/app/settings/page.tsx:34`); label/control rows stack below `md` (`components/settings/settings-view.tsx:590`). Top padding is `pt-14` to clear the shell's floating menu button (`app/app/settings/page.tsx:21`). |
| `/app/settings/billing` | Comparison table is `hidden md:block` (`components/settings/billing-client.tsx:283`); mobile gets stacked plan cards (`:363`). Plan CTAs are full-width; usage rows and the price/renewal grid stay inside their cards with no clipping. Top padding is `pt-14` (`app/app/settings/billing/page.tsx:61`). |
| `UnsplashPicker` | Two-column masonry (`components/integrations/unsplash-picker.tsx:160`); credit is printed under every tile rather than hover-only (`:188`); the search field is `min-w-0 flex-1` (`:79`) so it shrinks instead of pushing the button off-screen. |
| Settings & billing dialogs | Small (`max-w-md` / `max-w-lg`) and fit 390 × 664 with the keyboard open; they inherit the shared dialog caveat in §E. |

## Cross-cutting findings

### A. App shell & navigation

1. **[blocker] `components/layout/app-shell.tsx:33`** — `h-screen` maps to `100vh`. On iOS Safari the
   URL bar is part of that height, so the bottom ~60–90 px of the scroll container (the sidebar's
   account row, the last settings section) sit under browser chrome. Fix: `h-dvh` (keep `h-screen` as a
   fallback). The editor already does the right thing with `h-[calc(100dvh-5.5rem)]`
   (`components/editor/editor-shell.tsx:478`).
2. **[blocker] `components/layout/app-shell.tsx:44`** — the mobile menu button is `absolute left-3
   top-3` and reserves no space, so it overlays page content. Only
   `app/app/projects/[id]/layout.tsx:24` compensates (`pl-12`); `/app`, `/app/settings` and
   `/app/settings/billing` all start text underneath it. I worked around it with `pt-14` on my pages;
   the shell should own the fix (sticky 44 px mobile bar, or `max-md:pt-11` on `main`).
3. **[blocker] `components/layout/sidebar.tsx:50-58`** — the drawer has no Escape handler, no focus
   trap and no scroll lock. Focus stays in the page behind the scrim and background scroll continues
   under the open menu. Fix: `role="dialog" aria-modal`, focus the close button on open and restore on
   close, lock `body` overflow, and close on `pathname` change.
4. **[minor] `components/layout/command-palette.tsx:52`** — `pt-[14vh]` costs ~92 px above the input
   before the 320 px-capped list (`:82`). With the soft keyboard open that is a two-row window. Fix
   `pt-[6vh] sm:pt-[14vh]`.

### B. Storyboard & corkboard

5. **[blocker] `components/storyboard/asset-tray.tsx:116-117` → `components/storyboard/storyboard-card.tsx:94-137`**
   — setting a **cover** image is HTML5 drag-and-drop only (`draggable`, `dataTransfer`,
   `onDragOver`/`onDrop`). Touch browsers never fire these events, and the card offers only "remove"
   (`storyboard-card.tsx:230`), so cover pinning is impossible on a phone. Mood images do have a tap
   path via `onPickMood` → `ImagePicker` (`:282,340`); covers need the same. Fix: tap an asset to
   enter "assign" mode, then tap a card (or pick a chapter in a sheet).
6. **[minor] `components/storyboard/storyboard-view.tsx:289`** — the horizontal snap lane needs
   `overscroll-x-contain`; otherwise a left-swipe on the first card triggers iOS back-navigation and
   drops the user out of the project. The helper copy at `:270` only describes "Shift-drop", which has
   no touch meaning.
7. **[minor] `components/storyboard/storyboard-view.tsx:80`** — `PointerSensor` with a 6 px activation
   distance and no `TouchSensor`. A finger drifting 6 px during a vertical scroll starts a horizontal
   card drag. Add `useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })`.
8. **[minor] `components/storyboard/asset-tray.tsx:52`** — the open tray takes ~150 px of a 664 px
   viewport; with the 56 px project header and 44 px toolbar only ~380 px of lane remains. Collapse it
   to one 88 px thumb row below `md` and close after assignment.

### C. Editor

9. **[minor] `components/editor/editor-shell.tsx:478`** — `min-h-[560px]` combined with
   `100dvh-5.5rem` exceeds the usable height on a 375 × 667 phone (≈ 560 px after chrome) and forces
   a page scroll around an editor that already scrolls internally. Use `min-h-0 md:min-h-[560px]`.
10. **[minor] `components/editor/side-panel.tsx:64`** — the wrapper is `overflow-y-auto` around
    `CommentsPanel`, whose list is also `overflow-y-auto`
    (`components/comments/comments-panel.tsx:299`). Nested touch scrollers trap momentum and make the
    composer hard to reach; drop the outer scroller and let the panel own it.
11. **[tap] `components/editor/versions-panel.tsx:156`** and **`components/editor/chapter-rail.tsx:105`**
    — restore/compare and chapter-menu actions are `opacity-0 … group-hover:opacity-100`. Add a
    `max-md:opacity-100` override or use the `md:opacity-0` pattern from
    `components/outline/outline-panel.tsx:391`.
12. **[minor] `components/editor/editor-toolbar.tsx:150,359`** — a fixed 44 px, non-wrapping toolbar.
    Base controls fit 390 px, but Find plus the `lg:hidden` "More" dropdown sit after an `ml-auto`
    spacer with no shrink allowance. Verify on device; if it overflows, add `overflow-x-auto` with
    `shrink-0` children or move Find into the More sheet below `md`.
13. **[minor] `components/ai/ai-panel.tsx:22`** — `w-80 shrink-0` aside with no mobile variant. It is an
    unused placeholder today (no imports), but if wired into the editor as-is it would take 82 % of a
    390 px screen. Make it a right-hand sheet below `lg`.

### D. Outline & comments

14. **[tap] `components/outline/outline-panel.tsx:303,370`** — the drag handle and synopsis-edit
    affordance are `opacity-0 group-hover:opacity-100` with no `md:` guard, so they never appear on
    touch. The row action cluster at `:391` already does it correctly
    (`opacity-100 md:opacity-0 md:group-hover:opacity-100`); copy that.
15. **[tap] `components/comments/comment-thread.tsx:60,168`** — resolve/delete reply actions appear on
    hover or focus-within only, i.e. never on a phone. Add `max-md:opacity-100`.

### E. Shared UI kit (lead-owned)

16. **[blocker] `components/ui/dialog.tsx:74`** — the panel has no max height and the body is
    `max-h-[70vh]` with the footer outside it. At 390 × 664 with the soft keyboard open (~340 px
    usable) header + 70vh + footer overflow and the submit button lands off-screen. Fix:
    `max-h-[calc(100dvh-2rem)]` on the panel, `max-h-[70dvh]` on the body, `shrink-0` footer, plus
    `pb-[env(safe-area-inset-bottom)]`.
17. **[minor] `components/ui/dropdown.tsx:41`** — `min-w-[190px]` menus anchored right can exceed
    390 px when the trigger sits at the edge, and there is no viewport clamp. Add
    `max-w-[calc(100vw-1rem)]`.
18. **[minor] `components/ui/misc.tsx:164`** — `Tooltip` is hover-only, so labels never show on touch.
    All icon buttons carry `aria-label`, so this is acceptable — just never put unique information
    (quotas, shortcuts) only in a tooltip.
19. **[minor] `components/ui/button.tsx:9`** — `whitespace-nowrap` plus long labels ("Upgrade to
    Studio") overflows narrow cards. Billing uses full-width buttons so it is fine there; check any
    inline `size="sm"` long-label button at 390.

### F. Library, project & cover screens

20. **[minor] `components/projects/library-view.tsx:45`** — `min-w-[200px]` search plus two
    auto-width selects in a `flex-wrap` row: at 390 the selects wrap to a second line and the
    grid/list toggle to a third. Fix search `w-full sm:min-w-[200px] sm:flex-1`, selects
    `flex-1 sm:flex-none`.
21. **[tap] `components/projects/project-card.tsx:53`** — the card's overflow menu is
    `opacity-0 group-hover:opacity-100` with no `@media (hover: none)` override, so duplicate/delete
    are invisible on touch. Storyboard cards now solve this with `[@media(hover:none)]:opacity-100`
    (`components/storyboard/storyboard-card.tsx:221,233`); apply the same here.
22. **[minor] `app/app/projects/[id]/page.tsx:351`** — six stats collapse to `grid-cols-2`, i.e. three
    rows of tiles before the "Continue where you left off" card. Hide "Pages" and "Collaborators"
    below `sm` so the resume action stays above the fold.
23. **[minor] `components/cover/cover-studio.tsx:300`** — preview uses `max-h-[calc(100vh-250px)]`;
    with mobile browser chrome the canvas overflows. Use `100dvh` (also `:281`).
24. **[minor] `components/projects/project-settings-tabs.tsx:17`** and
    **`components/projects/project-nav.tsx:43`** — scrollable strips are correct; add
    `overscroll-x-contain` for the same iOS back-gesture reason as §B6.

## Already correct (verified during this audit)

- `components/storyboard/storyboard-card.tsx:221,233` and `components/storyboard/corkboard-card.tsx:75`
  — hover-only controls now carry `[@media(hover:none)]:opacity-100`.
- `components/editor/editor-shell.tsx:742-812` — chapter rail and comments/versions panel become
  full-height drawers with scrims below `lg`, including close buttons.
- `components/projects/project-settings-collaborators.tsx:157,367` — table header hidden below `md`,
  rows stack, and the role select has an `aria-label` per member.
- `components/outline/notes-panel.tsx:303` — `opacity-100 md:opacity-0 md:group-hover:opacity-100`.
- `components/storyboard/image-picker.tsx:62` — 3-up grid becoming 4-up at `sm`.
- `app/app/page.tsx:38` — stats grid `grid-cols-2 sm:grid-cols-4`.
- `app/app/projects/[id]/layout.tsx:24` — `pl-12` on mobile to clear the floating menu; the pattern the
  shell should provide globally.

## Suggested ownership

| Owner | Items |
|---|---|
| Lead / shell + UI kit | 1, 2, 3, 4, 16, 17, 18, 19 |
| Storyboard stream | 5, 6, 7, 8 |
| Editor stream | 9, 10, 11, 12 |
| Comments / outline | 13, 14, 15 |
| Library / project / cover | 20, 21, 22, 23, 24 |
