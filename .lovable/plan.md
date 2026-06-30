## Why it feels slow

Network log on `/surveys` shows three sequential `GET /auth/v1/user` calls (~1s each) before any data renders, then the server-fn for surveys. Causes:

1. `src/routes/_authenticated/route.tsx` `beforeLoad` calls `supabase.auth.getUser()` on every route match (default `staleTime: 0`). Every navigation = a network round trip to Supabase Auth before the page mounts.
2. `src/components/AppShell.tsx` runs another `supabase.auth.getUser()` in `useEffect` just to display the email.
3. `RootComponent` calls `router.invalidate()` on `SIGNED_IN` / `USER_UPDATED`, which re-triggers `beforeLoad` → another `getUser` round trip.
4. `listSurveys` query has no `staleTime`, so the sidebar Recents refetches on every page (already shared cache key — just needs freshness).

## Fix (frontend-only, no schema changes)

1. **Auth gate — use local session, not network**
   - In `src/routes/_authenticated/route.tsx`: replace `supabase.auth.getUser()` with `supabase.auth.getSession()` (reads localStorage, no network). Redirect to `/auth` only if no session.
   - Return `{ user: session.user }` into context.
   - Add `staleTime: 5 * 60_000` on the route so `beforeLoad` is not re-run on every match.

2. **AppShell — read user from route context**
   - Remove the `useEffect` + `getUser` call. Pull the email from `Route.useRouteContext()` (or a `getRouteApi("/_authenticated").useRouteContext()`).

3. **Root auth listener — narrower invalidation**
   - In `src/routes/__root.tsx`, on `SIGNED_IN` / `SIGNED_OUT` only call `queryClient.invalidateQueries()`; skip `router.invalidate()` on `USER_UPDATED` (token refresh-ish events shouldn't re-run loaders). On `SIGNED_OUT`, navigate to `/auth` directly instead of relying on a re-run of `beforeLoad`.

4. **Stabilize survey list cache**
   - In `AppShell` and `src/routes/_authenticated/surveys.index.tsx`, give the `["surveys"]` query a `staleTime: 30_000` so the sidebar and surveys page share fresh cached data instead of refetching on navigation.

5. **Font loading (small win)**
   - Add `media="print" onLoad="this.media='all'"` style async load is not worth the complexity here; keep `display=swap` (already set) and just add a `rel="preload"` for the stylesheet `as="style"` link in `__root.tsx` to remove the render-blocking on first paint.

## Out of scope

No backend changes, no schema changes, no new dependencies. Public respondent view (`/s/...`) is already light and not touched.

## Expected impact

First paint after sign-in: drops from ~3s (3× auth/user) to <300ms (one local session read). Navigating between Dashboard / Surveys / Reports becomes instant since `beforeLoad` is cached and the surveys query is fresh for 30s.