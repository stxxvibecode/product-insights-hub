# Make the Form Design panel exit dissolve instead of slide

## Problem
Right now the panel slides in from the left and, on close, slides back out to the left. The slide-out feels heavy — the whole surface travels across the chat pane before disappearing.

## Change
Keep the snappy slide-in entrance (it signals where the panel came from), but on exit have the panel **dissolve in place**: fade opacity to 0 with a tiny scale-down and a subtle blur, over ~180ms. No horizontal movement on exit.

## Files touched
1. **`src/routes/_authenticated/surveys.$id.tsx`** — the single `motion.div` for the design panel:
   - Split `initial` / `animate` / `exit` so entrance and exit use different transitions:
     - `initial={{ x: "-100%", opacity: 1, scale: 1, filter: "blur(0px)" }}`
     - `animate={{ x: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}`
     - `exit={{ x: 0, opacity: 0, scale: 0.98, filter: "blur(6px)" }}`
   - Use a per-property `transition` so the spring only governs the slide-in and the exit is a fast easeOut tween:
     ```
     transition={{
       x: { type: "spring", stiffness: 520, damping: 44, mass: 0.7 },
       opacity: { duration: 0.18, ease: "easeOut" },
       scale:   { duration: 0.18, ease: "easeOut" },
       filter:  { duration: 0.18, ease: "easeOut" },
     }}
     ```
   - Keep `will-change-transform`; add `will-change: opacity, filter, transform` via inline style so the blur/fade stay smooth. (Tailwind `will-change-transform` is fine; extend inline if noticeable jank.)

No other files, no logic changes.

## Verification
- Open Form Design → still slides in snappy from the left.
- Close via ×, Escape, or the Form Design pill toggle → panel stays put, fades + slightly shrinks + blurs, chat re-appears underneath. No leftward slide.
- No layout shift in the chat pane while the exit animates (panel is `absolute inset-0`, so this holds).
- `tsgo --noEmit` clean.
