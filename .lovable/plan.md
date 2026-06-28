Make the survey detail page feel like lovable.dev — chat-led on the left, a polished live "preview frame" on the right, with a calmer header and a softer agent presence.

### What changes

**1. Lovable-style header (slim, single row)**
- Replace the current 2-line header with a slim bar: agent mark · editable title · status dot · spacer · `Advanced`, `Open`, `Publish`.
- Move `← Back to surveys` into the sidebar/agent-mark click; remove the dedicated back button to declutter.
- Add a subtle bottom border + backdrop blur so it floats over the split.

**2. Chat pane — lovable.dev feel**
- Center column max-width ~640px, generous vertical rhythm.
- Assistant messages: no bubble, plain text on background (per `chat-ui-composition`). Agent mark only on the first assistant message of a run, not every turn.
- User messages: compact rounded bubble using `bg-card` + `text-foreground` (high contrast, not signal-tinted).
- Tool calls render as compact inline cards ("Added question 3 · NPS"), collapsed by default, with a domain icon (ListChecks, Star, Hash, Tag…) instead of generic chevrons.
- Thinking state: agent mark + `Shimmer` "Composing…" inline, not in a separate row.
- Empty state: large agent mark, headline "What should we learn?", description, and 4 starter chips laid out as a 2×2 grid of soft cards (matches lovable.dev's prompt suggestions).

**3. Composer (sticky bottom, lovable.dev style)**
- Sticky to the bottom of the chat pane with a fade gradient above it.
- Single rounded card: textarea + footer row with a faint hint on the left and a circular signal-colored submit on the right.
- Auto-focus on mount, after send, after stream completion, after thread/route change (per `chat-agent-ui-contract`).
- ⌘/Ctrl+Enter to send; Shift+Enter newline; disable submit while `submitted`/`streaming`.

**4. Preview pane — "device frame"**
- Wrap the live respondent preview in a rounded "browser frame" card (top chrome with 3 dots + the public `/s/<slug>` URL pill, copy button).
- Inside: the Typeform-style one-question-at-a-time preview that already exists, on a soft radial background.
- Footer of the frame: prev/next, "Question X of Y", and a small "Open public link" button.
- Empty preview (no questions yet): centered agent mark + "Your survey will appear here as the agent builds it."

**5. Agent identity & micro-polish**
- Reuse existing `src/assets/agent-mark.png` as the consistent identity across header, empty state, thinking, and preview empty state.
- Friendly tool-name map (Adding question, Renaming survey, Tagging theme, Rebuilding survey, etc.) shown in tool headers.
- Keep all colors on semantic tokens (`signal`, `card`, `border`, `muted-foreground`); no hardcoded hex.

### Files touched (frontend only)

- `src/routes/_authenticated/surveys.$id.tsx` — header restructure, chat layout, empty state, sticky composer, focus management, tool-name map, preview frame wrapper.
- `src/components/ai-elements/*` — leave as installed; only compose around them.

### Out of scope

- No changes to server routes, tools, persistence, or the AI model.
- No changes to `surveys.index.tsx` (already lovable-style entry).
- No changes to the manual `/edit` builder.
