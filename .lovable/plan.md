# Choreographed Compose → Build handoff

Today's flow has three visible seams: (1) the index page shows a "BuildingCard" step ticker while the survey row is created, (2) the browser then hard-cuts to `/surveys/$id`, which briefly renders `EmptyChat` and a blank preview column, (3) the seed prompt effect fires and the user's message + shimmer finally appear. The route jump feels like a hard cut because those three states don't share any visual continuity.

The fix is to make the prompt input the anchor of one continuous motion, and to make the destination page render the "AI is composing" state on first paint — no empty chat, no blank preview.

## User-visible behavior

- Type a prompt on `/surveys`, hit Compose.
- The prompt card lifts and slides toward its final position (sticky composer at the bottom of the chat column). Behind it, the split layout of the compose page fades in.
- The typed text appears as the first user message bubble at the top of the chat column, with the "Composing…" shimmer immediately underneath. No `EmptyChat` flash.
- The right-hand preview column shows a soft skeleton (welcome card outline + 2 question outlines) that crossfades into the real preview as tool calls complete.
- The `BuildingCard` step ticker on the index page is removed — its role (telling the user something is happening) moves to the destination page where the actual work is happening.

## Technical plan

### 1. Remove the index-side interstitial
File: `src/routes/_authenticated/surveys.index.tsx`
- Delete the `showingBuild` branch and `BuildingCard` render. Keep `BUILD_STEPS` only if reused; otherwise drop.
- Keep the prompt input mounted during `create.isPending` (disable submit + show inline spinner in `PromptInputSubmit`).
- On `create.mutate`, also call `router.preloadRoute({ to: "/surveys/$id", params: { id: s.id } })` inside `onSuccess` right before `navigate(...)` so the destination JS/data is warm.

### 2. Shared-element morph for the prompt card
Use Motion `layoutId` to visually tie the two composers together.
- Wrap the index `<PromptInput>` in a `motion.div layoutId="compose-prompt"` inside a `LayoutGroup`.
- Wrap the destination sticky composer (`surveys.$id.tsx` lines ~556–579) in the same `motion.div layoutId="compose-prompt"`.
- Because `LayoutGroup` doesn't cross routes, use Motion's route-level shared layout by wrapping both routes' composers with the same `layoutId` and enabling the browser's View Transitions API via TanStack Router (`router.navigate({ viewTransition: true })`). Fallback: if View Transitions unsupported, do a 180ms crossfade using `AnimatePresence` on the outgoing index content.

### 3. Optimistic first-paint on the destination
File: `src/routes/_authenticated/surveys.$id.tsx`
- When `seedPrompt` is present AND `messages.length === 0`, render an optimistic user bubble containing `seedPrompt` and the "Composing…" shimmer immediately — before `chatQ` resolves and before `sendMessage` fires. This eliminates the `EmptyChat` flash and the blank interval between mount and first stream chunk.
- Gate `EmptyChat` on `chatQ.isFetched && !seedPrompt && messages.length === 0` so it only appears for truly empty visits without a seed.
- Keep the existing seed-send effect; it will simply replace the optimistic bubble with the real streamed message once `sendMessage` runs.
- Hide the "Form Design" pill until `questions.length > 0` (already the case) — no change.

### 4. Preview column skeleton
File: `src/routes/_authenticated/surveys.$id.tsx` (right pane render, around the `PreviewPane` usage)
- When `questions.length === 0`, render a `PreviewSkeleton` component: a muted welcome card, two shimmering question card outlines, using the current `theme` background so it feels like the same surface.
- Crossfade (`AnimatePresence`, 220ms) from skeleton → real `PreviewPane` when the first question arrives.

### 5. Motion + timing polish
- Route transition: spring `{ stiffness: 480, damping: 42, mass: 0.7 }` on the shared prompt element, matching the Form Design panel spring so the app has one motion language.
- Fade durations 180–220ms with `ease: [0.32, 0.72, 0, 1]` (already used in Form Design panel).
- Respect `prefers-reduced-motion`: skip the shared-element morph and just crossfade at 120ms.

### 6. Files touched
1. `src/routes/_authenticated/surveys.index.tsx` — remove `BuildingCard` render, keep input mounted while pending, add `preloadRoute`, wrap composer in shared `layoutId`.
2. `src/routes/_authenticated/surveys.$id.tsx` — optimistic first-paint bubble + shimmer, gate `EmptyChat`, wrap sticky composer in shared `layoutId`, mount `PreviewSkeleton` while `questions.length === 0`.
3. `src/components/PreviewSkeleton.tsx` — **new**. Themed placeholder cards for the preview column.
4. `src/router.tsx` — enable `defaultViewTransition: true` (TanStack Router supports view transitions on navigation).

No server function, DB, or auth changes.

## Verification

- From `/surveys`, type a prompt and hit Compose: the prompt card visibly moves to the destination composer position; no BuildingCard step ticker; no blank chat area at any point.
- The typed prompt appears immediately as a user bubble on the destination page with "Composing…" underneath, before the first stream chunk.
- The right column shows a themed skeleton immediately, then crossfades to real question cards as tools complete.
- With `prefers-reduced-motion: reduce`, the same flow works as a quick crossfade with no morph.
- Refreshing `/surveys/$id` with no `?prompt=` param and existing chat still renders the saved history exactly as today.
- `tsgo --noEmit` clean.
