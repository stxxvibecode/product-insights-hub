The user wants to remove the chat box from the survey builder and use a manual builder instead. The existing `/surveys/$id/edit` route already has a full manual builder (drag-and-drop question list, live preview, inspector panel). The plan is to redirect the survey composer (`/surveys/$id`) to the manual editor (`/surveys/$id/edit`) and keep the AI prompt composer on the surveys index (`/surveys`) for creating new surveys.

### What to change

1. **Redirect `/surveys/$id` to `/surveys/$id/edit`**
   - Update `src/routes/_authenticated/surveys.$id.tsx` to redirect to the edit route so the chat builder is no longer accessible.

2. **Update the survey card links**
   - In `src/routes/_authenticated/surveys.index.tsx`, change the survey card links from `/surveys/$id` to `/surveys/$id/edit` so users land in the manual builder.

3. **Clean up unused chat builder code**
   - Remove the chat UI imports, `useChat`, `Conversation`, `PromptInput`, message rendering, and tool-call handling from the old survey composer file (or replace the whole file with a redirect).
   - Keep the server route `src/routes/api/chat.surveys.$id.ts` since the `/surveys` index still uses AI to seed new surveys.

4. **Preserve AI creation on `/surveys`**
   - The prompt input on the surveys index page stays as-is — users describe what they want, the AI drafts the survey, and they land in the manual builder to refine it.

### What stays the same
- The surveys index (`/surveys`) with its AI prompt composer and template chips.
- The manual editor (`/surveys/$id/edit`) with its drag-and-drop, inspector, preview, insights, and share tabs.
- Theme customization in the manual builder.
- The AI chat server route (used by the index page to generate surveys).