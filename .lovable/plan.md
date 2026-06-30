# Redesign: Surveys workspace

Rework `src/routes/_authenticated/surveys.index.tsx` only. Pure frontend/presentation — no schema, server function, or routing changes. Keep the dark theme, sidebar, orange `signal` accent, soft radial gradient, and rounded card language already in the design system.

## 1. Hero block (tightened, workspace feel)

- Reduce top padding from `pt-24 pb-16` to roughly `pt-12 pb-10` so the composer sits higher and the page reads as a tool, not a landing page.
- Keep `agentMark` but slightly smaller (`h-8 w-8`) and align left-aligned-in-a-centered-column to feel less "hero".
- Heading → `What do you want to learn today?`
- Subheading → `Describe the feedback you need. Insightform will draft the survey, apply tags, and organize responses into your source of truth.`
- Drop the soft glow's intensity slightly so the composer pops more than the background.

## 2. AI prompt composer (primary object)

- Keep the `PromptInput` + `PromptInputTextarea` + `PromptInputFooter` structure (per AI Elements rules).
- Placeholder → `Example: Create a post-purchase NPS survey with follow-up questions about pricing, onboarding, and product value.`
- Slightly larger composer: stronger ring on focus, a touch more shadow, `min-h-[160px]` textarea.
- Replace the icon-only `PromptInputSubmit` with a labeled button: **Compose** + `ArrowUpRight` icon, using the `signal` accent. Implement as a custom `<button type="submit">` inside `PromptInputFooter` (still inside the form, still submits) so the AI Elements form behavior is preserved; `PromptInputSubmit` is removed only for this composer.
- Footer left side keeps the `⏎ to compose` hint; right side holds the new Compose CTA.

### Template chips

- Directly under the composer, add a small label: `Start with a template` (uppercase tracked micro-label matching existing style).
- Chips (same `STARTERS` array, retitled):
  - `Post-purchase NPS`
  - `New user onboarding pulse`
  - `Win/loss interview`
  - `Feature prioritization`
  - `Dashboard redesign feedback`
- Clicking a chip still calls `create.mutate(label)` exactly like today.

## 3. Library section (becomes a real list, not a marketing grid)

- Reduce top gap from `mt-20` to `mt-10` so composer + library feel like one workspace.
- Section header:
  - Title → `Your surveys`
  - Subcopy → `Drafts, launched surveys, and feedback flows live here.`
  - Right side keeps the `View insights →` link when data exists.

### Filter tabs

- Add a tab row above the cards: `All` · `Drafts` · `Live` · `Completed`.
- Local `useState<'all' | 'draft' | 'live' | 'closed'>`. Map `Completed` → `closed` (matches `survey_status` enum already in the codebase).
- Styling: pill row, active pill uses `border-signal/50 text-foreground bg-card`, inactive uses muted border/text. Show count badge next to each tab name (e.g. `Drafts · 4`).
- Empty filtered state: short muted message (`No surveys in this view yet.`) instead of hiding the section.

### Survey cards (more "app card", less marketing tile)

Same grid (`md:grid-cols-2 lg:grid-cols-3`) but card internals reworked:

```text
┌───────────────────────────────────────┐
│ ● Live              Updated 2h ago    │
│                                       │
│ Survey title (one line, font-display) │
│ Optional one-line description         │
│                                       │
│ 128 responses              Open  ↗    │
└───────────────────────────────────────┘
```

- Top row: `StatusPill` (kept) on the left, relative "Updated …" timestamp on the right (small helper `formatRelative(updated_at)` — pure function, no deps).
- Title stays `font-display`, single line with `truncate`.
- Description kept but limited to 1 line (`line-clamp-1`) to reduce vertical bulk.
- Footer row: response count text (`128 responses` or `No responses yet` when `response_count === 0`) on the left; on the right, an action label that swaps by state:
  - `draft` → `Open` + arrow
  - `live` → `View insights` + arrow (links the whole card to `/surveys/$id` as today; the action is a visual affordance, not a separate link, so we don't change routing).
  - `closed` → `View insights` + arrow.
- Hover: keep `group-hover:border-signal/40`, add a subtle `bg-card/80 → bg-card` transition.

## 4. Spacing & polish

- Constrain main column to `max-w-5xl` (slightly wider than today's `max-w-3xl`) so cards breathe at 3-up without feeling sparse.
- Tighten vertical rhythm overall: composer block and library separated by a single `mt-10` and a thin `border-t border-border/60` divider to visually connect them as one workspace.
- No new dependencies. No changes to server functions, routes, or DB.

## Technical notes

- File touched: `src/routes/_authenticated/surveys.index.tsx`.
- New local helpers in that file: `formatRelative(date)`, filter state, filtered list memo.
- `Link` continues to wrap each card; the "Open / View insights" affordance is a styled `<span>` inside the card, not a nested anchor (avoids invalid nested `<a>`).
- Keep `PromptInput` / `PromptInputTextarea` / `PromptInputFooter` from `@/components/ai-elements/prompt-input` per the chat-UI composition rules; only `PromptInputSubmit` is swapped for a labeled button still inside the form.
