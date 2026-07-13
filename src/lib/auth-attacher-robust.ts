import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

// Robust variant of the generated attachSupabaseAuth: if getSession() returns
// no token (stale storage read, mid-refresh race), fall back to refreshSession
// before dispatching the RPC. Prevents intermittent
// "Unauthorized: No authorization header provided" errors from
// requireSupabaseAuth-protected server fns.
export const attachSupabaseAuthRobust = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    let token: string | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
      if (!token) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token;
      }
    } catch {
      // ignore — fall through to no-header path
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);