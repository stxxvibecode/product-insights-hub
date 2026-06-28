## What changes

Replace the current "Surveys" library page (title + small inline title input + empty card) with a **lovable.dev-style entry surface**: one large, centered prompt as the hero, with the survey library demoted below as recent work.

```text
┌──────────────────────────────────────────────────────────┐
│                                                          │
│        What do you want to learn from your users?        │
│                                                          │
│  ╭────────────────────────────────────────────────────╮  │
│  │ Describe the survey you want to build…             │  │
│  │                                                    │  │
│  │                                                    │  │
│  │                                                    │  │
│  │  [📎 attach]                       [ Compose ↑ ]   │  │
│  ╰────────────────────────────────────────────────────╯  │
│                                                          │
│   Try:  ◦ Post-purchase NPS    ◦ Onboarding pulse        │
│         ◦ Win/loss interview   ◦ Feature prioritization  │
│                                                          │
│  ─── Your surveys ─────────────────────────────────────  │
│  [card] [card] [card] [card]                             │
└──────────────────────────────────────────────────────────┘
```

## Behavior

- Submitting the prompt (Enter or the send button) creates a new survey with a placeholder title, navigates to `/surveys/$id`, and **seeds the chat with the typed prompt as the first user message** so the agent immediately starts composing — no second step.
- Clicking a suggestion chip does the same thing with that text.
- Empty state: only the hero prompt — no "No surveys yet" card.
- With surveys present: same hero, plus a "Your surveys" grid below using the existing card style.
- Sidebar nav, dashboard, and `/surveys/$id` composer stay unchanged. This is only the entry/library page.

## Visual direction (lovable.dev feel)

- Full-bleed dark canvas, vertically centered hero.
- Large display headline (`font-display`, ~5xl) sitting directly on the background — no card around it.
- Prompt box: rounded-2xl, 1px hairline border, subtle inner shadow, large multi-line textarea (~140px min), generous padding, send button as a filled signal-colored icon button anchored bottom-right inside the box. Built on AI Elements `PromptInput` / `PromptInputTextarea` / `PromptInputFooter` / `PromptInputSubmit` so it matches the composer inside the survey.
- Soft radial signal-coral glow behind the prompt box for warmth.
- Suggestion chips: small, pill-shaped, muted text, hover lifts to foreground.
- Recent surveys section uses a quiet `LIBRARY · Your surveys` eyebrow and the existing card grid, but smaller and below the fold so the prompt owns the page.

## Technical notes

- Edit only `src/routes/_authenticated/surveys.index.tsx`.
- Reuse `createSurvey` server fn. Derive the working title from the first ~60 chars of the prompt (fallback "Untitled survey"). On success, `navigate({ to: "/surveys/$id", params: { id }, search: { prompt } })`.
- Add `validateSearch` on `src/routes/_authenticated/surveys.$id.tsx` for an optional `prompt` string. In the composer, if `prompt` is present **and** there are no existing chat messages for that survey, auto-`sendMessage({ text: prompt })` once, then strip the param via `navigate({ search: {} , replace: true })` so refresh doesn't re-send.
- Use AI Elements primitives already installed (`prompt-input`); no new packages.
- Keep dark theme, semantic tokens (`bg-background`, `text-foreground`, `border-border`, `signal`). No hardcoded colors.
