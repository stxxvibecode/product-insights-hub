## Add Form Design to the Advanced editor

Mount the existing `ThemePanel` inside `/surveys/$id/edit` and wire it to the live Build preview, so themeing works from either view without any new backend or UI primitives.

### Scope
Presentation-only edit to `src/routes/_authenticated/surveys.$id.edit.tsx`. No changes to `ThemePanel`, `survey-theme`, server functions, schema, or the Compose route.

### Changes

1. Local theme state (mirrors Compose pattern in `surveys.$id.tsx`)
   - Track `theme` in local state, seeded from `data.survey.theme` merged with `DEFAULT_THEME`.
   - Debounced save (400ms) via existing `updateSurvey` server fn: `{ id, theme }`.
   - `useEffect` to resync when `data.survey.theme` changes from server invalidations (e.g. AI `set_theme` tool ran in Compose).

2. New "Design" tab
   - Extend the `Tab` union: `"build" | "design" | "preview" | "insights" | "share"`.
   - Add `{ id: "design", label: "Design" }` to `TabsBar`.
   - Render a two-column layout when active:
     - Left (col-span-4 lg): `<ThemePanel theme={theme} onChange={handleThemeChange} />` inside a scrollable card. Same component, same AI prompt, same presets — no duplication.
     - Right (col-span-8 lg): themed device-frame preview using `themeStyle(theme)` + `backgroundClass(theme)`, showing the first question via `QuestionPreview` (or a "no questions yet" empty state).

3. Apply theme to existing surfaces
   - Wrap the Build tab's "Live preview" column and the Preview tab's respondent card with `style={themeStyle(theme)}` and the `backgroundClass(theme)` class so the buttons/accents already reflect the current theme without switching tabs. This is what makes it feel like it "works" from the editor.

### Technical notes
- Reuse `ThemePanel`, `themeStyle`, `backgroundClass`, `DEFAULT_THEME`, `SurveyTheme` from existing modules — no new files.
- Cast `data.survey.theme` as `SurveyTheme | null` (same cast Compose uses).
- Keep the existing `mUpdateSurvey` mutation for the title/status flow; add a small dedicated debounced save for theme to avoid noisy invalidations while dragging color pickers.
- Do not add Form Design controls to `AppShell` or duplicate the ThemePanel component.

### Out of scope
- Contrast/readability analysis, welcome/thank-you tab in this editor's preview (that already exists in Compose).
- Any change to the chat/AI Compose route, sidebar, or server functions.

### Verification
- Load `/surveys/$id/edit`, open the new **Design** tab: preset chips update the right-side preview instantly; the AI prompt runs `generateTheme` and applies. Switch back to **Build** — question preview reflects the same accent/radius/background.
- Reload the page → theme persists (round-trips through `updateSurvey`).
- Open Compose in another tab, change theme there → returning to the editor and refetching shows the new theme.
