# Brand customization for surveys

Surveys already have a `theme JSONB` column — we'll put it to work so respondents see a branded experience, and the AI can change it via chat.

## What the user gets

1. **Theme panel in the composer** (right rail above the live preview):
   - Color: 6 curated brand palettes (Ink, Ivory, Coral, Forest, Indigo, Rose) + a custom HEX picker for the accent color.
   - Background style: Solid / Soft gradient / Dotted grid.
   - Font: Inter Tight (default), Instrument Serif, JetBrains Mono, DM Sans.
   - Corner radius: Sharp / Soft / Pill (slider).
   - "Reset to default" button. Changes save with a debounced `updateSurvey({ theme })`.
2. **Live preview reflects the theme instantly** — the existing browser-framed `QuestionPreview` reads from `survey.theme` instead of global tokens.
3. **Public respondent page (`/s/$slug`)** applies the same theme: background, accent, font, radius.
4. **Prompt-driven theming via chat** — add a `set_theme` tool to the AI route so the user can say *"make it warm and minimal"* or *"use our brand orange #FF6A3D"* and the agent updates the theme live (same flow as `set_survey_meta` / `add_question`).

## Theme shape

```ts
type SurveyTheme = {
  preset?: "ink" | "ivory" | "coral" | "forest" | "indigo" | "rose";
  accent?: string;        // hex
  background?: "solid" | "gradient" | "dots";
  font?: "sans" | "serif" | "mono" | "soft";
  radius?: "sharp" | "soft" | "pill";
};
```

Stored on `surveys.theme`. A `resolveTheme(theme)` helper in `src/lib/survey-theme.ts` returns concrete CSS variables (`--accent`, `--accent-foreground`, `--surface`, `--radius`, `font-family`) so both the preview and respondent page share one source of truth.

## Files

- **New** `src/lib/survey-theme.ts` — presets, palette list, `resolveTheme()`, `themeStyle()` returning a React `CSSProperties` object of CSS vars.
- **New** `src/components/ThemePanel.tsx` — UI for palette / background / font / radius, calls a `onChange(theme)` prop with debounce.
- **Edit** `src/routes/_authenticated/surveys.$id.tsx` — render `ThemePanel` above the live preview; wrap preview in a `<div style={themeStyle(theme)}>` so accent + radius + font cascade; wire `updateSurvey({ id, theme })`.
- **Edit** `src/routes/s.$slug.tsx` — wrap the respondent page in the same themed shell, replace hard-coded `bg-background` with the resolved background.
- **Edit** `src/components/QuestionPreview.tsx` — switch hard-coded accent classes (`bg-primary`, etc.) to `var(--accent)` / `var(--accent-foreground)` / `var(--radius)` so it inherits the theme. Buttons keep their existing layout.
- **Edit** `src/lib/surveys.functions.ts` — extend the `updateSurvey` validator to accept an optional `theme` object and persist it.
- **Edit** `src/routes/api/chat.surveys.$id.ts` — add a `set_theme` AI tool that validates with the same Zod schema and updates `surveys.theme`. Update the system prompt with a one-liner so the model knows it can re-theme on request.

No migration needed — `theme JSONB` already exists with `{}` default.

## Out of scope (call out, don't build now)

- Custom logo upload / favicon — would need a storage bucket; can follow if requested.
- Saved "brand kits" reusable across surveys.
- Dark/light per-survey toggle (current app is dark-first; respondent page inherits).
