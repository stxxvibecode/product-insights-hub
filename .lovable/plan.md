# Form Design becomes the canvas — Canva-style text + sizing editor

## Vision
Form Design is where you edit the form. Just like Canva's editor: the preview on the right IS the canvas, every piece of text is clickable, and the Form Design panel on the left shows the controls for what you selected — copy, size, and style. No more inline text editing scattered across the app.

## Scope (this iteration)
Applies to the compose page (`/surveys/$id`) AND the editor's Build tab (`/surveys/$id/edit`). The Inspector on the edit page keeps its non-text controls (type, required, tags, branching); it just stops handling copy.

## Model changes
Extend `SurveyTheme` in `src/lib/survey-theme.ts`:
- `text_scale?: "s" | "m" | "l"` — one master multiplier applied to every text size (S = 0.9x, M = 1x, L = 1.15x).
- `heading_size?: "sm" | "md" | "lg" | "xl"` — question titles / welcome / thank-you headings.
- `body_size?: "sm" | "md" | "lg"` — descriptions and helper copy.
- `button_size?: "sm" | "md" | "lg"` — start / next / submit buttons.
- `density?: "compact" | "comfortable" | "spacious"` — vertical spacing between elements.

`themeStyle()` writes these as CSS variables `--t-heading`, `--t-body`, `--t-button`, `--t-gap` (numeric rem values combined with `text_scale`). `QuestionPreview` and the compose `PreviewPane` read those vars via inline `style={{ fontSize: "var(--t-heading)" }}` etc.

Defaults added to `DEFAULT_THEME` so existing surveys render unchanged. No migration needed — `theme` is a JSONB column and new keys default in code.

## Form Design panel redesign — `src/components/ThemePanel.tsx`
The panel becomes a segmented tri-tab layout with the existing AI prompt sitting above the tabs so it always steers whatever's open:

```
[ Sparkles: describe the look ]
──────────────────────────────
[ Content ] [ Size ] [ Style ]

Content tab:
  Form
    • Title            [inline input]
    • Description      [inline textarea]
  Welcome screen
    • Headline         [input]
    • Subtitle         [textarea]
    • Start button     [input]
  Questions            (accordion, one per question)
    • Q1 · Title       [input]
      Description      [textarea]
      Options          [list of inputs + add/remove]
    • Q2 · …
  Thank-you screen
    • Headline         [input]
    • Message          [textarea]

Size tab:
  Text scale       [S · M · L segmented]
  Heading size     [SM · MD · LG · XL segmented]
  Body size        [SM · MD · LG]
  Button size      [SM · MD · LG]
  Density          [Compact · Comfortable · Spacious]

Style tab: current content unchanged
  (Accent, custom accent, background, typography, corners, reset)
```

New props on `ThemePanel` (all optional so existing callers work):
- `survey?: { id, title, description, welcome_screen, thank_you_screen }`
- `questions?: Array<{ id, title, description, config, type }>`
- `onUpdateSurvey?: (patch) => void`
- `onUpdateQuestion?: (id, patch) => void`
- `focus?: { kind: "form-title" | "welcome-*" | "thanks-*" | "question", id?: string }` — deep-link to a field
- `defaultTab?: "content" | "size" | "style"`

When Content props aren't supplied, hide the Content tab (backward compatible during rollout).

## Canvas click-to-edit — compose page (`src/routes/_authenticated/surveys.$id.tsx`)
In `PreviewPane`, wrap every editable text node in a small `<CanvasClick />` helper that:
- On hover shows a 1px dashed accent outline + subtle background tint.
- On click sets `designOpen = true` in the parent and passes a `focus={…}` payload naming the field/question.
- Uses `tabIndex={0}` + keyboard activation for a11y.

Fields wired:
- Form title (welcome + question tabs header)
- Welcome headline / subtitle / start button
- Thank-you headline / message
- Current question title / description / choice options (when tab === "question")

Panel opens with the correct tab (`content` for text clicks, `style` for the pill button) and scrolls the focused field into view + focuses its input.

## Editor Build tab (`src/routes/_authenticated/surveys.$id.edit.tsx`)
- Add the same **Form Design** pill in the Build tab header (top-right of the middle preview column).
- Reuse the slide-over animation from the compose page, sourced from the same `<FormDesignPanel />` wrapper component (extracted for reuse; lives in `src/components/FormDesignPanel.tsx`).
- Pass the same click-to-edit into the Build tab's `<QuestionPreview>` by removing its own `editable` mode and adding `onSelectText={(focus) => openDesign(focus)}` instead. Options edit now happens inside Form Design's Content tab.
- Remove: `editable`, `onEditTitle`, `onEditDescription`, `onEditConfig` from `QuestionPreview` (component + call sites). Inspector keeps its non-text controls (type, required, tags, branching, delete); its "Title" and "Description" fields are removed.
- The main title input in the edit page header stays (it's chrome, not the form).

## Files touched
1. `src/lib/survey-theme.ts` — new sizing keys, defaults, CSS var output.
2. `src/components/ThemePanel.tsx` — tri-tab redesign, new props.
3. `src/components/FormDesignPanel.tsx` — **new**. Extracts the slide-over shell (motion transitions, close, escape) so both pages share it. Renders `<ThemePanel />` with the shared props.
4. `src/components/QuestionPreview.tsx` — drop `editable` mode; add `onSelectText?: (focus) => void` and wrap texts with a click-to-select overlay. Consume new size CSS vars.
5. `src/routes/_authenticated/surveys.$id.tsx` — replace inline `<motion.div>` slide-over with `<FormDesignPanel />`; wrap preview texts in `<CanvasClick />`; wire `focus` state.
6. `src/routes/_authenticated/surveys.$id.edit.tsx` — add Form Design pill + `<FormDesignPanel />`; drop the `editable` props on `<QuestionPreview>`; slim Inspector.
7. Public respondent page (`src/routes/s.$slug.tsx`) — unaffected (never passed `editable`).

No server function, DB, or RLS changes.

## UX rules
- Only ONE element is selected at a time. Selecting a new one changes the focused field in the open panel; the panel doesn't re-open if already open.
- Clicking outside any text in the preview does nothing; use the × / Escape / pill to close.
- On the compose page the pill still opens the Style tab by default (matches the existing "Customize design" suggestion).
- Density and scale changes animate smoothly (200ms) so the canvas feels alive.

## Verification
- Compose page: click the welcome headline → panel slides in, Content tab open, headline input focused, typing updates the preview live.
- Change Text scale to L → every text in the preview grows in unison.
- Change Density to Spacious → question card gains vertical breathing room.
- Editor Build tab: Form Design pill opens the same panel; renaming a choice option in the Content tab updates the middle preview and the Inspector metadata (options count) in sync.
- Inspector no longer has Title/Description inputs; Type, Required, Tags, Branching, Delete still work.
- Existing surveys load with unchanged appearance (defaults preserved).
- `tsgo --noEmit` clean.
