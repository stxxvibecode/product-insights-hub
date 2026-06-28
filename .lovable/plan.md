# Fix "Unauthorized" when creating a form

## What's happening

The AI survey builder posts to `/api/chat/surveys/$id`, which requires a Supabase bearer token. The chat transport currently reads the token from React state (`authToken`) that's hydrated by `supabase.auth.getSession()` in a `useEffect`. When the user sends the first message before that effect resolves, the request goes out with **no `Authorization` header** and the route correctly returns `401 Unauthorized` (confirmed in the network log — the failing POST has only `content-type`, no `authorization`).

The seeded-prompt path is gated on `authToken`, but a manually typed first message is not, which is the case that's failing.

## Fix

In `src/routes/_authenticated/surveys.$id.tsx`:

1. Make the `DefaultChatTransport` `headers` callback **async** and fetch the token at call time:
   ```ts
   headers: async () => {
     const { data } = await supabase.auth.getSession();
     const token = data.session?.access_token;
     return token ? { Authorization: `Bearer ${token}` } : {};
   }
   ```
2. Drop the `authToken` React state, the `useEffect` that hydrates it, and the `authToken` dependency in the transport `useMemo` (it caused the transport to be recreated on every token change and is no longer needed).
3. Keep the seeded-prompt auto-send, but gate it only on `chatQ.isFetched` instead of `authToken` (the token is now fetched per request).

No backend / server-route changes — the route's auth check is already correct.

## Verification

- Reload the survey, type a prompt, send. The POST to `/api/chat/surveys/:id` should include `Authorization: Bearer …` and stream a response instead of returning 401.
- Refresh again and use a seeded prompt from the surveys index — it should also send successfully.
