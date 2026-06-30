# Sidebar redesign — Product Insights workspace

Transform `src/components/AppShell.tsx` into a Lovable-style light sidebar while keeping the main canvas dark and premium.

## Visual direction

- Sidebar surface: light ivory/off-white panel (own token set) against the dark app canvas — clear contrast, premium feel.
- Width: ~272px (comfortable reading, room for labels + counts).
- Rounded active state: soft pill background (`rounded-lg`, subtle warm tint), signal-coral accent dot or icon tint on hover/active.
- Section labels: small uppercase tracking labels (`text-[11px] tracking-[0.14em] text-muted`) above each group.
- Icons: Lucide line icons, 16px, `stroke-[1.75]`.
- Vertical rhythm: 4px gap between items, 20px between groups.

## Structure (top → bottom)

1. **Workspace selector** (top, ~56px tall)
   - Rounded square avatar with Insightform mark + "Product Insights Hub" label + chevron-down.
   - Button-styled; dropdown is non-functional placeholder (single workspace for now), but renders an open-state menu via a simple `<details>`/popover stub.

2. **Main**
   - Dashboard → `Home`, route `/dashboard`
   - Compose → `Sparkles`, route `/surveys` (the AI composer hub)
   - Source of truth → `Activity`, route `/dashboard` (anchor `#source-of-truth`) — if no separate route exists, point to `/dashboard`
   - Reports → `FileText`, route `/reports` (new placeholder route)
   - Integrations → `Plug`, route `/integrations` (new placeholder route)

3. **Research**
   - Surveys → `List`, `/surveys`
   - Templates → `LayoutGrid`, `/templates` (placeholder)
   - Audience → `Users`, `/audience` (placeholder)
   - Tags → `Tag`, `/tags` (placeholder)

4. **Recents**
   - Pulled from `listSurveys` (top 5 by `updated_at`), each linking to `/surveys/$id`.
   - If fewer than 5 exist, show what we have; if zero, hide the section.
   - The static list in the brief (New user onboarding pulse, Post-purchase NPS, etc.) is treated as the *intent* — real data fills it. (Confirming below.)

5. **Action cards** (bottom, stacked, rounded `rounded-xl`, soft surfaces)
   - **Invite team** — `UserPlus` icon, title + subcopy "Bring PMs, design, and CX into the loop".
   - **Upgrade plan** — `Sparkles`/`Zap` icon, title + subcopy "Unlock more responses, reports, and integrations".
   - Both are visual-only buttons (toast "Coming soon" on click).

6. **Footer row**: small user email + sign-out icon button.

## Technical notes

- Edit `src/components/AppShell.tsx`; keep the same export signature so all routes wrapping in `<AppShell>` continue working.
- Add light-sidebar tokens scoped via a `data-theme="light"` wrapper on the `<aside>` (override `--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, `--border`, `--muted-foreground`) so we don't disturb the global dark theme. No new tokens in `styles.css` required beyond what's already defined — we override locally.
- Create thin placeholder routes for any new nav target so `<Link to="/reports">` etc. typecheck:
  - `src/routes/_authenticated/reports.tsx`
  - `src/routes/_authenticated/integrations.tsx`
  - `src/routes/_authenticated/templates.tsx`
  - `src/routes/_authenticated/audience.tsx`
  - `src/routes/_authenticated/tags.tsx`
  Each renders inside `<AppShell>` with a simple "Coming soon" empty state to keep the workspace coherent.
- Recents fetched with the existing `listSurveys` server fn via React Query (`['surveys']` key — already cached by the surveys index).
- Mobile: keep the existing top bar; the sidebar stays hidden < lg, no changes to mobile behavior.

## Out of scope

- Functional workspace switching, real Templates/Audience/Tags/Reports/Integrations pages (placeholders only).
- Invite team / Upgrade plan flows.

## One quick confirmation

The Recents list in the brief looks like example content. I'll wire Recents to the user's real recent surveys (top 5 by `updated_at`) rather than hard-coding those titles. If you'd rather see the literal example titles for now, say the word and I'll hard-code them instead.
