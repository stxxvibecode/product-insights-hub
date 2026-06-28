
# Make the builder feel like Lovable.dev

Right now `/surveys/new` drops you into a manual drag-and-drop editor. You want the Lovable.dev experience: you describe the survey in plain English, AI generates it, you see the Typeform-style preview live, and you keep iterating by chatting.

## What changes

### 1. New "Create" surface (`/surveys/new`) — Lovable-style split view
- **Left (40%)**: chat composer.
  - Big centered prompt on first load ("Describe the survey you want to run…") with example chips: "Post-onboarding NPS", "Pricing page feedback", "Churn exit interview", "Feature request triage".
  - After first send, collapses into a normal chat transcript built from AI Elements (`Conversation`, `Message`, `MessageResponse`, `PromptInput`, `Shimmer`) — assistant messages render plain on surface, user messages in a high-contrast bubble.
  - Each assistant turn shows a collapsed tool card ("Generated 6 questions", "Edited question 3", "Added theme tag: pricing").
- **Right (60%)**: live Typeform-style preview of the survey the AI is building, using the existing `QuestionPreview` component inside the respondent shell. A thin top bar shows survey title, status pill (Draft), and "Open builder" / "Share" once questions exist.
- Streaming: as the AI returns questions, they appear one-by-one in the preview (fade+slide using Motion, same transition as `/s/$slug`).

### 2. AI generation (Lovable AI Gateway, no key needed)
- New server fn `generateSurvey` in `src/lib/ai-survey.functions.ts`:
  - Input: `{ surveyId, prompt, history }` (history = prior chat turns for this survey).
  - Calls Lovable AI Gateway (`google/gemini-2.5-flash` default) with a structured-output schema that returns `{ title, description, questions: [{ type, title, description?, required, config, tags[] }] }` using our 10 existing `QuestionType`s and `defaultConfigFor` shapes.
  - Persists the result: updates `surveys.title/description`, replaces or patches `questions` (and `question_tags`, auto-creating tags by name), depending on intent.
  - Returns the diff (added/edited/removed question ids + a short assistant message) so the chat can render a tool card.
- Intent routing happens inside the same fn via the model: "create", "edit question N", "add question about X", "make it shorter", "translate to Spanish", "change tone", etc.
- All chat turns saved to a new `survey_chat_messages` table (`id, survey_id, role, content, tool_payload jsonb, created_at`) with owner-scoped RLS, so reopening a survey resumes the conversation.

### 3. Existing manual builder becomes "Advanced"
- `/surveys/$id` keeps the current drag-and-drop builder but is reached via an "Open builder" link from the AI view. Default entry point for a survey is the AI chat at `/surveys/$id` (chat + preview); the dnd editor moves to `/surveys/$id/edit`.
- Inspector edits made manually flow back into the chat as system notes ("You edited Q3 manually") so the AI stays in sync.

### 4. Landing page CTA
- Update `/` hero CTA + interactive preview to show the prompt-to-survey moment ("Describe your survey → see it live") instead of the static demo, to match the new product story.

## Technical notes

- **AI Elements**: install `conversation message prompt-input shimmer tool` via `bun x ai-elements@latest add …` before composing the chat UI. Assistant messages render with `MessageResponse`; tool cards use `Tool` with `defaultOpen={false}`.
- **Streaming**: Lovable AI Gateway supports SSE. Use a TanStack server route `src/routes/api/ai/generate-survey.ts` (POST, auth-checked via bearer) that streams structured deltas; the chat client reads the stream and applies question inserts/edits to a local store mirrored to the DB on stream end. Falls back to non-streaming if the model returns full JSON.
- **Schema**: new migration adds `survey_chat_messages` with grants + RLS (owner-only via `surveys.owner_id`). No changes to existing tables.
- **Tags**: AI-suggested tag names are upserted into `tags` (case-insensitive) for the owner before linking via `question_tags`, so cross-survey themes still aggregate on the dashboard.
- **Routes**:
  - `src/routes/_authenticated/surveys.new.tsx` → creates a draft survey + redirects to `/surveys/$id`.
  - `src/routes/_authenticated/surveys.$id.tsx` → rewritten as the AI chat + live preview (default).
  - `src/routes/_authenticated/surveys.$id.edit.tsx` → the existing dnd builder, moved.
- **No new secrets**: uses the managed Lovable AI Gateway. Default model `google/gemini-2.5-flash` (fast, free during promo, strong at structured output).

## Out of scope for this pass
- Multi-step AI tool calling beyond generate/edit (e.g. analyzing prior responses to suggest follow-ups) — easy to add later on the same chat surface.
- Image/logo generation for survey theming.
- Voice input on the prompt.

Want me to build it?
