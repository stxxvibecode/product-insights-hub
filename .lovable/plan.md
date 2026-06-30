# Simplify nav + live-surveys view

## Sidebar nav changes (`src/components/AppShell.tsx`)

Merge "Dashboard" and "Source of truth" into a single item — the dashboard route already *is* the source of truth.

**New Main group (in this order):**
1. Compose → `Sparkles`, `/surveys`
2. Dashboard → `Activity`, `/dashboard` (label kept as "Dashboard"; the page itself is the source of truth)
3. Reports → `FileText`, `/reports`
4. Integrations → `Plug`, `/integrations`

**Research group:** unchanged (Surveys, Templates, Audience, Tags).

Active-state logic simplifies — no more dual `/dashboard` entries.

## Surveys page: surface live surveys (`src/routes/_authenticated/surveys.index.tsx`)

The library already lists all surveys with filter tabs. Promote *Live* surveys so they're the first thing a respondent-facing operator sees:

- Add a **"Live now"** strip above the library, only when at least one survey has `status === "live"`.
- Renders as horizontally-scrolling cards (or a 1–3 column grid on wider screens) showing: title, response count, public URL pill (copy to clipboard), relative "Live since" timestamp, and a primary "Open survey" link plus a secondary "View insights" link.
- The existing filter tabs + card grid stay below as the full library.
- Default filter tab stays "All".

No data-model or backend changes — the `listSurveys` server fn already returns `status` and `response_count`. The public URL is `${origin}/s/${slug}` (slug already on the survey row used by `s.$slug.tsx`).

## Out of scope

- No DB migration.
- No changes to `/dashboard`, `/reports`, `/integrations`, or other placeholder pages.
- No changes to mobile layout.
