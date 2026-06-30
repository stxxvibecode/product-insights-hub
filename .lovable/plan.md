## Problem

On the published survey page, clicking an answer for auto-advance question types (Yes/No, single choice, NPS, scale) sets the value and immediately calls `onSubmit()`. But React state hasn't flushed yet, so `handleSubmit` reads the *previous* `answers[q.id]` (still `undefined`). For required questions, the guard `value === undefined → return` silently blocks navigation, so the survey appears frozen on that question.

This also affects "OK" button clicks where the user just answered then immediately pressed Enter/OK — the answer for the current click is stale on the first tap.

## Fix

Let the question component pass the freshly chosen value into the advance handler, so it never depends on un-flushed state.

1. **`src/components/QuestionPreview.tsx`**
   - Change the prop type to `onSubmit?: (overrideValue?: unknown) => void`.
   - For the auto-advance branches (`yes_no`, `single_choice`, `nps`, `scale`), call `onChange(v); onSubmit?.(v);` — passing the picked value through.
   - Other branches (text/number Enter, OK button) keep calling `onSubmit?.()` with no arg.

2. **`src/routes/s.$slug.tsx`**
   - Change `handleSubmit` to `handleSubmit(overrideValue?: unknown)`.
   - Resolve `const value = overrideValue !== undefined ? overrideValue : answers[q.id];`.
   - When `overrideValue` is provided, also persist it into `answers` state so the back/forward navigation and final submit stay consistent.
   - Keep the rest of the flow (required check, `submitAnswer`, `complete`, advance index) unchanged.
   - Wrap the submit in `try/catch` so any future server error surfaces a small inline message instead of silently leaving the user stuck.

3. **No backend or RLS changes.** The earlier `responses` RLS fix already covers the insert path; `submitAnswer` upserts with default `Prefer: return=minimal` (no post-insert select), so anon policies on `answers` are already sufficient.

## Verification

- Publish a survey containing an NPS or single-choice question, open the public `/s/<slug>` URL, click a choice → it should animate to the next question without needing a second click.
- Required text question with empty input still blocks (intended).
- Last question still routes to the "Thank you" stage.