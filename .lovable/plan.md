# Form Design studio refresh

Scope: presentation-only changes to `src/components/ThemePanel.tsx` and the survey composer preview pane (`src/routes/_authenticated/surveys.$id.tsx` and/or `src/components/PreviewPane.tsx`). No data model, server function, or theme engine changes.

## 1. ThemePanel rework (`src/components/ThemePanel.tsx`)

Restructure from a collapsible settings strip into an always-visible, studio-feeling panel.

- Header
  - Title: "Form Design" (replaces "Brand & theme")
  - Subtitle: "Customize how this survey looks and feels before you publish."
  - Drop the Hide/Customize toggle; keep the panel open by default. (If space is a concern in the parent layout, keep a single chevron but default open.)

- AI brand prompt (promoted to hero of the panel)
  - Section label: "Describe the look you want"
  - Textarea-style input (taller than current single line), Sparkles icon, placeholder:
    "Example: warm orange, soft corners, ivory background, premium SaaS feel"
  - Primary button copy: "Generate theme" (replaces "Apply"), full-width on small panel widths
  - Keep the vibe chips row underneath but rename to the new preset names below

- Accent color (replaces "Palette")
  - Helper line: "Controls buttons, selected states, and progress indicators."
  - Keep the 6 color circles. Rename preset display names (id values stay the same so saved themes keep working):
    - coral → "Warm SaaS"
    - ink → "Editorial Dark"
    - forest → "Fresh Gradient"
    - indigo → "Minimal Ivory" (or remap — see note)
    - rose → "Playful Pulse"
    - solar → keep as a 6th option labeled "Sunlit" (only 5 names were requested; we keep the 6th preset with a sensible name so nothing disappears)
  - Note on mapping: the 5 requested chip names are applied to the 5 closest existing presets by vibe. Preset IDs in `survey-theme.ts` are untouched so persisted themes still resolve.

- Custom accent color (renamed from "Custom Accent")
  - Same color picker + hex input, unchanged behavior.

- Background — segmented control labels: Solid · Gradient · Dots (unchanged)
- Typography (renamed from "Font") — segmented control with polished labels:
  - sans → "Clean"
  - serif → "Editorial"
  - soft → "Friendly"
  - mono → "Technical"
- Corners — Sharp · Soft · Pill (unchanged)

- Keep "Reset to default" link at the bottom.

## 2. Design check card

New compact card rendered just above the preview frame (inside the preview pane container, before the device frame).

- Single-line, three pill items separated by middots:
  - "Contrast looks good"
  - "Buttons are readable"
  - "Mobile spacing is balanced"
- Small green check icon prefix, subdued surface, signal/positive accent.
- Static for now (no live computation) — purely a confidence cue.

## 3. Preview tabs + larger preview

In the preview pane (`PreviewPane` used by `src/routes/_authenticated/surveys.$id.tsx`):

- Add a tab strip above the device frame with three tabs: Question · Welcome · Complete
- Tab state is local to the preview pane:
  - Question → current question preview (existing behavior, default)
  - Welcome → renders survey `welcome_screen` (title, description, button) using the same themed styles as the public respondent view
  - Complete → renders `thank_you_screen`
- Make the device frame visibly taller and a touch wider where layout allows (raise min-height, e.g. from current value to ~640–720px), and give it more vertical breathing room so it dominates the right column. Keep the existing browser-frame chrome and the copyable public URL pill.

## Technical notes

- No schema or server-function changes. All copy and structure changes are in the two component files above.
- Preset name remap is display-only; `THEME_PRESETS[].id` values in `src/lib/survey-theme.ts` stay the same so any survey already saved with `theme.preset = "coral"` continues to render.
- AI prompt behavior, theme generation server function, and applied CSS variables are unchanged.
- Accessibility: tabs use `role="tablist"`, the design-check card uses neutral text (not an alert).

## Out of scope

- Live contrast/readability analysis for the design-check card
- Editing welcome/thank-you copy from inside the preview (read-only display only)
- Any change to the chat/composer, sidebar, or published respondent route
