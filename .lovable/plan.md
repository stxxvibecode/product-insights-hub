# Inline editing inside the survey preview

Goal: on the Build tab, let users click directly on the question in the center "Live preview" panel to fix wording or add/remove choices — like typing in a Word doc — instead of only editing via the right-hand Inspector.

## Scope
Frontend only. No schema, server function, or business-logic changes. Reuses the existing `updateQuestion` mutation (`mUpdateQ`) already wired in `surveys.$id.edit.tsx`.

## What becomes editable in the preview
For the currently selected question in `QuestionPreview`:
1. **Title** — click to edit inline (contentEditable-style single-line input styled to match the h2).
2. **Description** — click to edit; empty state shows a muted "Add description…" affordance that turns into a real field on focus.
3. **Choice options** (single_choice, multi_choice) — click any option label to rename; a trailing "＋ Add option" row appends a new option; a small × on hover removes one.
4. **Scale min/max labels** — click the "Low"/"High" captions under the scale to rename.
5. **Yes / No**, **rating**, **NPS**, **number**, **short/long text**, **email** — title + description editing only (no per-answer content to edit).

Non-goals: changing question `type`, `required`, or numeric `min/max` bounds — those stay in the Inspector. Options for rating/NPS/scale scale numbers stay in Inspector.

## UX behavior
- Hovering an editable area shows a subtle background tint so users discover clickability.
- Click → field becomes an input/textarea seeded with current value, autofocused, text selected.
- Commit on **Enter** (title, option, label) or **blur**. **Shift+Enter** adds a newline in description. **Escape** cancels.
- Empty title on commit reverts to previous value (titles can't be blank).
- Deleting an option requires ≥1 remaining option.
- Save path: same `mUpdateQ.mutate({ id, title | description | config })` used by the Inspector, so autosave, toasts, and query invalidation all work unchanged.
- Optimistic UI: local state updates immediately; on server error, revert and toast.

## Files touched
1. **`src/components/QuestionPreview.tsx`** — add an optional `editable` mode plus `onEditTitle`, `onEditDescription`, `onEditConfig` callbacks. When `editable`, render the title/description/options/labels through small internal `<InlineText>` and `<EditableOption>` helpers instead of static text. When not `editable`, behavior is unchanged (keeps the public respondent view in `s.$slug.tsx` untouched).
2. **`src/routes/_authenticated/surveys.$id.edit.tsx`** — in the Build tab's `<QuestionPreview>`, pass `editable`, and wire the three callbacks to `mUpdateQ.mutate({ id: selected.id, ... })`. Do not pass `editable` on the Design/Preview tabs or the public `s.$slug.tsx` page.
3. No new files.

## Technical notes
- Use plain `<input>` / `<textarea>` (not `contentEditable`) — simpler, avoids sanitization, matches the app's existing input patterns.
- `<InlineText>` internally toggles between a styled display span and an input; height/width are matched via the same Tailwind classes to prevent layout shift.
- Options editor keeps array immutability: on rename, replace by index; on add, append `"Option N+1"`; on delete, filter by index; then call `onEditConfig({ options: next })`.
- Debounce is not needed — commits happen on blur/Enter, not per keystroke, so no spam to the server.
- Keep the existing right-hand Inspector fully functional; both edit paths write through `updateQuestion` and invalidate `["survey", id]`, so they stay in sync.

## Verification
- Type into the title in the preview → blur → title updates in the left question list and persists on reload.
- Rename an option in a single_choice question in the preview → the Inspector's options list shows the same value.
- Add and delete options from the preview; confirm min-1-option guard.
- Public respondent page (`/s/:slug`) still renders read-only (no edit affordances).
- `tsgo --noEmit` clean.
