
## Goal

One AI assistant, two permission modes:
- **Compose Mode** — creates and freely edits a *draft* survey directly.
- **Editor AI Assist** — proposes suggested changes that the user reviews and applies to a draft. Live surveys are never edited directly; edits go through an "edit draft" that publishes as a new version.

Compose = speed. Editor = control. Versioning = trust.

---

## 1. Data model changes (migration)

Add safe versioning + edit drafts without breaking existing responses.

`surveys` table:
- `version int not null default 1`
- `parent_survey_id uuid null references surveys(id) on delete set null` — set on edit-draft copies pointing to the live parent.
- `is_edit_draft boolean not null default false`
- `published_at timestamptz null`

`questions` table:
- `origin_question_id uuid null references questions(id) on delete set null` — tracks which question a draft question was cloned from (for diffing).

New `survey_versions` table (snapshot per publish):
```
id uuid pk
survey_id uuid  -- always points to the "canonical" live survey id
version int
title text, description text, theme jsonb, welcome_screen jsonb, thank_you_screen jsonb
questions jsonb  -- ordered snapshot of questions + config + tags
published_at timestamptz
```

`responses` table:
- `survey_version int not null default 1` — stamped at submit time so reporting can filter by version.

RLS + GRANTs follow the existing pattern (owner-scoped writes, anon reads/writes to `live` surveys only). The public respondent route always reads the *current live* survey and stamps `survey_version` from it.

## 2. Server functions (`src/lib/`)

New / changed server fns:

- `createEditDraft({ survey_id })` — clones the live survey + questions + tags into a new `surveys` row with `is_edit_draft=true`, `parent_survey_id=<live id>`, `status='draft'`, `origin_question_id` set on each question. Returns the draft id.
- `publishEditDraft({ draft_id })` — in a transaction:
  1. Snapshot the current live survey into `survey_versions` (version = live.version).
  2. Compute the *diff* between draft and live (see §4).
  3. Copy draft fields/questions/theme back onto the live survey row, bump `live.version += 1`, set `published_at=now()`.
  4. Delete the draft (or archive it).
  5. Existing `responses` keep their old `survey_version`.
- `discardEditDraft({ draft_id })`.
- `diffSurvey({ draft_id })` — returns the structured diff used by the review UI and by AI Assist suggestions (added / removed / changed questions, logic, tags, theme, risk per change).
- `listSurveyVersions({ survey_id })` and update `getSurveyInsights` / `responses` queries to accept `version?: number | "all"`.
- `proposeChanges({ survey_id, prompt })` — Editor Assist entry point. Runs an AI turn with *read-only* tools that return a JSON `SuggestedChange[]` instead of writing. Stored transiently in client state (no DB writes yet).
- `applySuggestion({ draft_id, change })` — server-side apply of a single reviewed suggestion to the draft. Used by "Apply to draft" and "Apply all safe changes".

## 3. AI boundary (`src/routes/api/chat.surveys.$id.ts`)

Keep the file, but branch by mode. The route accepts `?mode=compose|edit-assist`.

- **Compose mode** (default when survey is `draft` and `parent_survey_id` is null): current tools stay (`add_question`, `replace_all_questions`, `update_question`, `remove_question`, `tag_question`, `set_theme`, `set_survey_meta`). System prompt: "You are composing a new draft. You can directly edit."
- **Edit-assist mode** (survey is `draft` with `is_edit_draft=true`, or user opened Assist inside an editor): tools become **proposal tools**. Instead of mutating, each tool returns a `SuggestedChange` object:
  ```
  { kind: "add_question" | "update_question" | "remove_question" | "reorder" | "tag" | "theme" | "logic" | "meta",
    target: { position?, question_id? },
    before, after, reason, risk: "low" | "medium" | "high",
    reporting_impact?: string, tags_affected?: string[] }
  ```
  The stream emits these as tool-parts the client renders as a suggestion card. Assistant text summarizes but never claims a change was applied.

Guardrail: if the survey status is `live` and there is no active edit draft, the route rejects with 409 and the client offers "Create edit draft".

Placeholders:
- Compose composer: `Describe the survey you want to create...`
- Editor Assist input: `Ask AI to edit, rewrite, reorder, or check this survey...`

## 4. Risk classification

Central helper `src/lib/edit-risk.ts` used by both `diffSurvey` and Editor Assist:
- **Low**: typo fix, helper text, thank-you copy, theme/design, adding/removing tags.
- **Medium**: question rewrite (same type), reorder, new answer option, required toggle, added follow-up question.
- **High**: delete question with responses, change question type, remove answer options with responses, change branching, change NPS/rating scale bounds.

Risk drives warning copy in the review UI and in AI suggestion cards.

## 5. UI changes

### 5a. Surveys index (`surveys.index.tsx`)
- Hero composer label unchanged, but placeholder updated to `Describe the survey you want to create...`.
- Live survey cards: primary CTA becomes **Edit survey** (opens a modal: "This survey is live. Create an edit draft to make changes safely." → primary "Create edit draft", secondary "Cancel"). Also show "View responses", "Customize", "Share", "Pause".
- Draft cards keep Preview / Customize / Publish.

### 5b. Compose route (`surveys.$id.tsx`)
- Continues to be the chat-first composer for **new drafts only**. If user opens a live survey here, redirect to the editor.
- Top bar: title + Preview + Customize + **Publish**.
- Suggestions strip stays but is Compose-flavored (broad rewrites, add follow-ups, change tone).

### 5c. Survey editor (`surveys.$id.edit.tsx`) — refit into three-pane
Layout:
- **Left** — Survey outline: ordered questions with type badge, tag chips, status dot.
- **Middle** — Question editor: text, options, required, tags, helper text, logic (existing fields).
- **Right** — Live preview (themed).
- **Bottom-right drawer** — Editor AI Assist panel (collapsible). Contains the chat input with the edit-assist placeholder, and a stack of `SuggestionCard`s streamed back from the model.

Top-bar variants:
- Draft: `Preview`, `Customize`, `Publish`.
- Live (viewing, no draft yet): `View responses`, `Edit survey` (triggers create-edit-draft modal), `Customize`, `Share`, `Pause survey`.
- Editing draft of a live survey: pill "Live survey · Editing draft version" + `Preview update`, `Review changes`, `Publish update`, `Save draft`.

### 5d. `SuggestionCard` component (new)
Renders each `SuggestedChange` with:
- What changed (before → after diff).
- Why (model reason).
- Risk badge + reporting impact copy for high-risk.
- Affected question + tag chips.
- Actions: **Apply to draft**, **Edit manually** (jumps focus into middle pane), **Ignore**.
- Bulk actions above the stack: **Apply all safe changes**, **Review one by one**.

### 5e. Review changes screen (new route or modal)
`surveys.$id.edit.review.tsx` (or a full-screen dialog):
- Sections: Questions changed / added / removed, Logic changed, Tags changed, Design changed.
- Reporting-impact callout: *"Existing responses will remain tied to the previous version. New responses will use the updated version."*
- CTAs: **Publish update** (primary), **Save draft** (secondary).

### 5f. Reports / insights
- Add a version filter (All / v1 / v2 / Latest). Server fns accept `version` and either filter `responses.survey_version` or read snapshots from `survey_versions` when rendering historical question text.
- If a question's text or type changed, historical responses render under the *snapshotted* v1 question so old data isn't corrupted.

## 6. Copy inventory

Centralize the exact strings from the brief in `src/lib/copy.ts` so buttons and dialogs stay consistent:
- Live-edit modal, Publish-update reporting-impact line, Assist placeholder, Compose placeholder, top-bar labels per state, risk warning strings for medium/high.

## 7. Delivery phases

Kept incremental so each phase ships something usable.

1. **Phase 1 – Versioning foundation**: migration, `survey_versions` table, `survey_version` on responses, `createEditDraft` / `publishEditDraft` / `discardEditDraft`, live-edit modal on index + editor, top-bar states.
2. **Phase 2 – Diff + Review screen**: `diffSurvey`, review UI, risk classification, reports version filter.
3. **Phase 3 – Editor AI Assist**: mode branch in chat route, proposal tools, `SuggestionCard`, bottom-right drawer, apply/ignore actions.
4. **Phase 4 – Polish**: Compose placeholder + copy pass, redirect Compose→Editor for live surveys, "Customize design" wiring across both modes, reports impact per suggestion.

## Technical notes

- Publishing the edit draft is the only place we mutate the live row + bump `version`. All AI writes during editing go to the draft's `surveys` row.
- The public respondent route (`s.$slug.tsx`) always resolves the slug to the live (non-draft) survey; draft slugs are not resolvable publicly.
- `SuggestedChange` lives only in memory during a chat session; there is no `suggestions` table yet — keeps scope tight and matches "review before apply".
- Existing Compose tool calls remain the fast path; edit-assist proposal tools reuse the same schemas but wrap results instead of executing writes.
- No changes to auth, RLS shape, or the Lovable AI Gateway wiring.
