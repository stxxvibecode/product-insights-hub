# ChatGPT-style survey composer

Today `/surveys/$id` already has a chat-on-left / preview-on-right layout, but the chat is a non-streaming `createServerFn` that returns one structured JSON blob and rewrites the whole survey on each turn. We'll replace it with a proper streaming chat agent: AI Elements UI, AI SDK `useChat`, server-side streaming through a TanStack server route, and granular tool calls the agent uses to edit the survey live.

## What the user will see

- A full-height chat surface that looks and behaves like ChatGPT/Lovable: streaming markdown, a sticky composer, a "Thinking…" shimmer while the model works, copy/retry message actions, and an empty-state with example prompts.
- Live preview pane on the right keeps the Typeform-style one-question-at-a-time render. Each tool call from the agent updates the preview the moment it finishes (optimistic invalidation), so users watch their survey assemble itself.
- Per-survey conversation: each survey is its own thread, persisted in the existing `survey_chat_messages` table. Opening a survey reloads its full chat history. (No global thread list — the survey list IS the thread list.)
- Tool calls render inline in assistant messages as collapsed accordions (e.g. "Added 4 questions", "Renamed survey", "Tagged question 2 with onboarding") using AI Elements `Tool` components — closed by default, expandable for details.
- New brand mark for the AI agent (small generated logo) instead of the `Sparkles` lucide icon, per chat-ui-composition guidance.

## How it works

```text
useChat (client)
  └── DefaultChatTransport → POST /api/chat/surveys/$id
        └── streamText (Lovable AI Gateway, gemini-3-flash-preview)
              ├── system prompt (survey-composer persona)
              ├── tools: set_survey_meta, add_question, update_question,
              │          remove_question, reorder_questions, replace_all_questions,
              │          tag_question
              └── onFinish → persist assistant UIMessage to survey_chat_messages
```

- The server route loads the current survey + questions + tags on every request and injects a compact snapshot into the system prompt so the model always edits against the live state.
- Each tool's `execute` runs a single Supabase mutation scoped to the survey owner (auth verified once at request start). Tools return small JSON results that get streamed back as `tool-result` parts.
- React Query invalidates `["survey", id]` whenever a tool result arrives, so the preview re-renders mid-stream.
- `stopWhen: stepCountIs(50)` so the agent can chain multiple edits in one turn (e.g. "rewrite question 3 and add an NPS at the end").

## Files

New / rewritten:
- `src/routes/api/chat.surveys.$id.ts` — streaming chat route with the tool set and `onFinish` persistence.
- `src/lib/ai-gateway.server.ts` — shared Lovable AI Gateway provider helper (replaces the inline fetch in `ai-survey.functions.ts`).
- `src/routes/_authenticated/surveys.$id.tsx` — rewritten to use `useChat` + AI Elements (`Conversation`, `Message`, `MessageResponse`, `PromptInput`, `Tool`, `Shimmer`). Keeps the right-side live preview.
- `src/components/AgentMark.tsx` — small generated logo (PNG via image gen) used as the assistant avatar and empty-state mark.
- `src/lib/survey-chat.functions.ts` — `listSurveyChat` (load history for `useChat` initial messages) and a thin `loadSurveySnapshot` helper.

Edited:
- `src/start.ts` — already has `attachSupabaseAuth`; no change unless missing.
- `src/lib/ai-survey.functions.ts` — deleted (superseded). `listSurveyChat` moves to `survey-chat.functions.ts`.
- `src/routes/index.tsx` — minor copy refresh so the hero matches the new chat experience.

Database: existing `survey_chat_messages` table is reused. We'll store AI SDK `UIMessage`-shaped rows (role + parts JSON) so tool calls round-trip cleanly. One small migration adds a `parts jsonb` column (keeping the legacy `content`/`tool_payload` for backward compat) and lets the DB generate UUIDs for new rows.

## Dependencies

- `bun add ai @ai-sdk/react @ai-sdk/openai-compatible zod`
- AI Elements install: `bun x ai-elements@latest add conversation message prompt-input tool shimmer`

## Out of scope (existing, untouched)

- The drag-and-drop "Builder" at `/surveys/$id/edit` stays as the manual fallback.
- Public respondent flow `/s/$slug`, dashboard, settings, auth — no changes.
- No global thread list / no thread sidebar (per-survey threads only).
