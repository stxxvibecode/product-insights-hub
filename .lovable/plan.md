# Restructure the Compose page: Form Design as a slide-over

## Problem with today's flow
On `/surveys/:id` (Compose), the right pane stacks two things:
1. The `ThemePanel` (Form Design controls) at the top
2. The browser-frame form preview below it

That means Form Design is always visible, competes with the preview, and pushes the preview down. It has no clear entry point tied to the prompting flow.

## New flow
1. User prompts the form in the chat (left pane) — unchanged.
2. Once the survey has at least one question (i.e. the agent has replied and built something), a small **"Form Design"** pill button appears anchored to the chat pane (top-right of the chat column, just under the header).
3. Clicking the pill slides a **Form Design panel** over the chat/prompt box from the left side (covers only the left column, not the preview). The right pane keeps showing the live form preview so the user sees their design changes reflected instantly.
4. The slide-over has a close ("×") button and closes on Escape, returning to the chat.
5. The right pane no longer contains `ThemePanel` — only the browser-frame preview, tabs, and design-check strip.

## Scope
Frontend only. Reuses the existing `ThemePanel`, `handleThemeChange`, and theme state in `surveys.$id.tsx`. No schema, server function, or edit-page (`surveys.$id.edit.tsx`) changes. The Build-tab restructure the user asked about last turn stays untouched.

## Files touched
1. **`src/routes/_authenticated/surveys.$id.tsx`**
   - Add `const [designOpen, setDesignOpen] = useState(false)`.
   - In the chat pane (`<div className="relative flex min-h-0 flex-col border-r border-border">`):
     - Render a **pill button** absolutely positioned top-right (`Palette` icon + "Form Design") when `questions.length > 0`. Clicking sets `designOpen = true`.
     - Render a sibling slide-over panel inside the same relative container: full-height, left-anchored, `translate-x` transition (motion/react `motion.div` with `initial={{ x: "-100%" }} animate={{ x: 0 }}`). Contains a header row with title + close button, then `<ThemePanel theme={theme} onChange={handleThemeChange} />` in a scrollable body.
     - Escape key + backdrop click close it.
     - Keep the existing "Customize design" suggestion pill; update `scrollToDesign()` → `openDesign()` so it opens the slide-over instead of scrolling.
   - Remove the `<div id="form-design-panel"><ThemePanel …/></div>` block from `PreviewPane` so Form Design lives only in the slide-over.
   - Drop `theme`/`onThemeChange` from `PreviewPane` props (dead after removal) and delete unused imports in that component (`ThemePanel` import stays in the parent).

2. No new files, no route changes.

## Technical notes
- Slide-over is scoped to the left column only (`absolute inset-0 z-30` inside the already-`relative` chat pane container), so the right preview stays fully interactive and visible.
- Use `motion.div` with `AnimatePresence` for the slide + fade backdrop — matches the app's existing motion usage.
- Backdrop is a subtle `bg-background/60 backdrop-blur-sm` inside the left column only.
- Escape handler mounted via a `useEffect` guarded by `designOpen`.
- Pill button styling matches existing header pills: `rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs` with a `Palette` icon.

## Verification
- Fresh compose page: no Form Design pill and no ThemePanel visible; only chat + preview.
- After the agent replies with at least one question: pill appears in the chat pane.
- Click pill → panel slides in over the chat, preview stays visible and updates as sliders change.
- Escape / × / backdrop → panel slides out, chat is restored with focus back on the textarea.
- Suggested-action "Customize design" chip now opens the slide-over instead of scrolling.
- Editor page (`/surveys/:id/edit`) Design tab is untouched.
- `tsgo --noEmit` clean.
