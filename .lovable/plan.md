## Add global light/dark mode

Add a whole-app theme toggle (light / dark / system) that swaps every surface — sidebar, main panels, cards, and inputs — consistently.

### What the user sees

- A small sun/moon toggle in the sidebar footer (next to the sign-out button), with a right-click / long-press menu for Light · Dark · System.
- Clicking it instantly switches the entire app between:
  - **Dark** (current look): deep ink canvas, ivory text, coral signal accent.
  - **Light**: warm ivory canvas, deep ink text, same coral signal accent.
- Choice persists across reloads (localStorage) and defaults to the OS setting on first visit.
- No flash of wrong theme on load.
- Sidebar stops being hardcoded light — it follows the active theme (ivory surface in light mode, ink surface in dark mode).

### Technical approach

1. **Tokens** — `src/styles.css`
   - Move current `:root` values into a shared block, then define real light-mode values under `:root` (default) and dark-mode values under `.dark`. Every semantic token (`--background`, `--foreground`, `--card`, `--border`, `--muted`, `--sidebar*`, `--signal`, etc.) gets a value in both modes. `--signal` / `--signal-foreground` stay the same coral in both.
   - Keep the existing `@custom-variant dark` and `@theme inline` mapping — no changes to Tailwind wiring.

2. **Theme provider** — new `src/components/theme-provider.tsx`
   - Small React context storing `theme: "light" | "dark" | "system"` and resolved `mode: "light" | "dark"`.
   - Applies/removes `.dark` on `document.documentElement`, persists to `localStorage("insightform-theme")`, listens to `matchMedia("(prefers-color-scheme: dark)")` when in system mode.
   - Mounted once in `src/routes/__root.tsx` inside `RootComponent`.

3. **No-flash script** — `src/routes/__root.tsx`
   - Inject a tiny inline script in `RootShell` `<head>` that reads localStorage + `prefers-color-scheme` and sets `.dark` on `<html>` before React hydrates.
   - Update `<Toaster theme=...>` to follow resolved mode.

4. **Toggle UI** — new `src/components/ThemeToggle.tsx`
   - Sun/moon icon button used in the sidebar footer; dropdown for Light / Dark / System.

5. **Sidebar** — `src/components/AppShell.tsx`
   - Remove the hardcoded `oklch(...)` inline styles in `Sidebar`, `WorkspaceSelector`, `ActionCard`.
   - Replace `--sb-*` locals with the existing semantic `--sidebar*` tokens (or plain `--card` / `--muted-foreground` / `--border`), so the sidebar automatically adapts.
   - Add `<ThemeToggle />` to the footer row and the mobile top bar.

6. **Survey theme preview isolation**
   - `BrandProfileCard`'s live preview and any survey render (`s.$slug.tsx`) already apply their own inline theme via `themeStyle` / `backgroundClass` — those keep using the survey's own colors regardless of app theme (a survey is always rendered in its own brand).

### Out of scope

- Per-user server-side persistence (localStorage only).
- Changing any survey/brand colors — the workspace brand profile stays independent.
- New color palette design; light mode uses inverted versions of the existing ink/ivory tokens with the same coral signal.
