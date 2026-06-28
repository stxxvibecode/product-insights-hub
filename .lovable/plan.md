
# Insightform — Plan

A Typeform-style survey tool for product teams. Surveys feel like a Lovable.dev-grade conversational experience. Every response feeds a single cross-survey dashboard that acts as the product team's source of truth.

## Scope (v1 MVP)
1. Marketing landing page (`/`) — hero, value props, sample preview, CTA.
2. Auth (`/auth`) — email/password + Google, single-user.
3. App (auth-gated under `_authenticated/`):
   - Survey list + create
   - Survey builder (add/edit/reorder/delete questions, edit theme + welcome/thank-you screens)
   - Share — public link
   - Insights per survey
   - **"Source of Truth" dashboard** — cross-survey bird's-eye view
4. Public respondent flow (`/s/$slug`) — one-question-at-a-time, animated, mobile-first.

## Core data model (Lovable Cloud / Supabase)
- `profiles` — id, email, full_name, avatar_url
- `surveys` — id, owner_id, slug (unique), title, description, status (draft|live|closed), theme jsonb, created_at
- `questions` — id, survey_id, position, type, title, description, required, config jsonb
  - Types: `short_text`, `long_text`, `email`, `number`, `single_choice`, `multi_choice`, `rating` (1-5), `nps` (0-10), `scale` (1-7), `yes_no`
- `responses` — id, survey_id, respondent_token, started_at, completed_at, user_agent, referrer
- `answers` — id, response_id, question_id, value jsonb, value_text generated, value_number generated
- `tags` — id, owner_id, name, color — applied to questions for cross-survey aggregation (e.g. "pricing", "onboarding", "nps")
- `question_tags` — question_id, tag_id

All public-write tables use RLS: respondents insert via narrow `anon` policies on `responses`/`answers` keyed by `survey.status='live'`; everything else is owner-scoped.

## Survey builder
- Left rail: question list, drag-to-reorder, add-question menu
- Center: live preview of the currently selected question in the Typeform shell
- Right rail: question settings (label, description, required, type-specific options)
- Top bar: title, status toggle (Draft/Live), Share, Preview, Insights links

## Respondent flow (`/s/$slug`)
- Full-screen, one question per "card"
- Smooth slide+fade transitions (Motion)
- Enter to submit, Shift+Enter for newline on long text, arrow keys to navigate, number keys for choices
- Progress bar at top, "Powered by Insightform" footer (subtle)
- Anonymous respondent token in localStorage so partial completions can resume

## Per-survey Insights
- Completion rate, avg time, response count, drop-off by question
- Per-question chart appropriate to type (bar for choice, histogram for rating/NPS, word list for text)
- Response browser with filters, single-response drill-down

## Source-of-Truth Dashboard (the differentiator)
This is the "bird's eye view" — aggregates signals across **all** of the team's surveys:
- **Pulse strip**: total responses (7d/30d), active surveys, avg NPS across all NPS questions, avg satisfaction across all rating questions, completion rate trend
- **Themes by tag**: every question can be tagged (`pricing`, `onboarding`, `feature-x`, `nps`). The dashboard rolls up all answers sharing a tag into one card showing distribution, trend, and top text snippets — so "what do users think about pricing?" answers itself across every survey that touched pricing.
- **Decision feed**: chronological stream of notable shifts (NPS dropped, rating spiked, new text theme emerging) with a "Create decision note" action that saves a short markdown note linked to the evidence — these notes become the audit trail of product decisions.
- **Filters**: date range, survey subset, tag — applied globally.

## Routes
```
src/routes/
  __root.tsx
  index.tsx                        # landing
  auth.tsx                         # email + Google
  s.$slug.tsx                      # public respondent flow
  _authenticated/
    route.tsx                      # managed gate (ssr:false)
    dashboard.tsx                  # Source of Truth
    surveys.index.tsx              # list
    surveys.new.tsx                # create
    surveys.$id.tsx                # builder
    surveys.$id.share.tsx
    surveys.$id.insights.tsx
    surveys.$id.responses.tsx
    settings.tsx
```

## Server functions (`src/lib/*.functions.ts`)
- `surveys`: list/get/create/update/delete/publish, with `requireSupabaseAuth`
- `questions`: bulk upsert + reorder
- `responses`: `startResponse` and `submitAnswer` are PUBLIC (use server publishable client + narrow anon policies, validated by survey status)
- `insights.getSurveyInsights(surveyId)` — owner-scoped aggregates
- `insights.getSourceOfTruth({ range, tagIds?, surveyIds? })` — cross-survey rollups
- `tags`: CRUD + assign to questions

## Design direction
Typeform-grade craft + Lovable.dev marketing polish. I'll generate 3 prototype directions for the landing + respondent shell and let you pick, then build the app off the chosen tokens.

## Out of scope for v1 (callouts)
- Teams/workspaces, roles, invites
- AI-generated surveys / AI synthesis (Decision feed uses deterministic thresholds, not LLMs)
- Logic jumps / conditional branching
- Integrations (Slack, webhooks), exports beyond CSV
- Custom domains for share links

## Technical notes
- Lovable Cloud (Supabase) for DB + auth (email + Google via the managed broker)
- Generated columns on `answers` (`value_text`, `value_number`) make cross-survey aggregation cheap
- Charts: Recharts
- Animation: Motion for React
- Builder reorder: dnd-kit
- Schema validation: Zod on every server fn
- All public write endpoints rate-limited in-handler by IP+survey
