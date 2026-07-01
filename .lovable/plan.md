## Smart chip flow for Compose

Turn the starter chips on `/surveys` from one-click generators into a guided template picker, then hand off to the composer with a visible generation state and post-generation quick actions.

### 1. Chip → smart template (surveys index)

File: `src/routes/_authenticated/surveys.index.tsx`

- Replace the flat `STARTERS: string[]` with a typed catalog:
  ```ts
  type Starter = {
    id: string;               // "onboarding-pulse"
    label: string;            // chip text
    prompt: string;           // auto-fill for main prompt
    context: {
      id: string;             // "audience" | "timing" | "focus"
      question: string;
      options: string[];
      multi?: boolean;        // "focus" allows multi-select
    }[];
  };
  ```
- Seed with 5 starters (Post-purchase NPS, New user onboarding pulse, Win/loss interview, Feature prioritization, Dashboard redesign feedback). Fully spec `onboarding-pulse` with the prompt and 3 context groups from the brief; give the others reasonable defaults following the same shape so behavior is consistent.
- Chip click behavior (no mutation yet):
  1. Set `activeStarterId`; style active chip with `border-signal/60 bg-signal/10 text-foreground` (soft orange outline/fill).
  2. Set the `PromptInput` value to `starter.prompt` (lift textarea into controlled state via `PromptInput` `value` / `onValueChange`).
  3. Reveal a "Customize this survey" panel directly under the composer.
  4. Swap the submit button label from "Compose" to "Compose survey".
- Customize panel:
  - Card under the prompt, `rounded-2xl border-border bg-card/60 p-4`, small header "Customize this survey · optional".
  - One row per context question. Options render as selectable pill buttons (single-select except `focus` which is multi). Selecting toggles local state `answers: Record<string, string[]>`.
  - "Clear template" ghost button resets `activeStarterId`, empties the prompt, hides the panel, restores "Compose" label.
- Submit path:
  - When a starter is active, append a compact `Context:` suffix to the prompt using selected answers before calling `create.mutate(finalPrompt)`. Non-selected groups are omitted.
  - When no starter is active, current free-text flow is unchanged.

### 2. Generation state (surveys index → composer)

- On submit with a starter active, show a full-width overlay card in place of the composer while `create.isPending` is true:
  - Header: `Building your ${starter.label.toLowerCase()}...` (for onboarding-pulse this reads "Building your onboarding pulse...").
  - Steps list with animated states: Drafting questions → Applying tags → Checking question quality → Preparing preview.
  - Advance steps on a short timer (~700ms each) so the animation completes naturally while `createSurvey` runs and navigation resolves. Purely presentational; no backend change.
- Existing navigation to `/surveys/$id?prompt=…` remains the actual handoff. The composer already auto-sends the seed prompt, so generation kicks off on arrival.

### 3. Post-generation next actions (composer)

File: `src/routes/_authenticated/surveys.$id.tsx`

- After the assistant finishes streaming the initial seed response (detect via `status === "ready"` AND `messages.length >= 2` AND last message is assistant AND we haven't shown the panel yet), render a "Suggested next actions" strip above the composer.
- Actions (each is a chip that sends a prepared prompt via `sendMessage` — no new tools required, the existing chat route already handles them):
  - Add follow-up questions → "Add 2–3 follow-up questions to the most important question."
  - Check for bias → "Review the survey for biased or leading wording and rewrite as needed."
  - Make it shorter → "Trim this survey to the fewest questions that still answer the goal."
  - Add branching logic → "Add branching so respondents only see relevant follow-ups."
  - Customize design → scroll/switch to the Form Design panel (no chat send).
  - Publish → opens the existing Publish action.
- Chips dismiss after one is used but can be re-summoned via a small "Suggestions" toggle so they don't clutter the transcript permanently.

### Notes

- No schema, server function, or AI tool changes. All new logic is client-side composition on top of the existing `createSurvey` + `/api/chat/surveys/$id` streaming flow.
- Reuses existing tokens (`signal`, `card`, `border`) so styling stays on-brand.
