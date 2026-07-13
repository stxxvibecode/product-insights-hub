import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";

// Robust variant of the generated attachSupabaseAuth: if getSession() returns
// no token (stale storage read, mid-refresh race), fall back to refreshSession
// before dispatching the RPC. Prevents intermittent
// "Unauthorized: No authorization header provided" errors from
// requireSupabaseAuth-protected server fns.
//
// Debug logging is gated on localStorage.debug_auth === "1" so it can be
// toggled at runtime without a rebuild:
//   localStorage.debug_auth = "1"  // enable
//   delete localStorage.debug_auth // disable
function debugEnabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage?.getItem("debug_auth") === "1";
  } catch {
    return false;
  }
}

function tokenTag(token: string | undefined): string {
  if (!token) return "<none>";
  return `${token.slice(0, 8)}…(len=${token.length})`;
}

export const attachSupabaseAuthRobust = createMiddleware({ type: "function" }).client(
  async ({ next }) => {
    const debug = debugEnabled();
    const start = debug ? performance.now() : 0;
    let token: string | undefined;
    let source: "session" | "refresh" | "none" = "none";
    let expiresAt: number | undefined;
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
      expiresAt = data.session?.expires_at;
      if (token) source = "session";
      if (!token) {
        if (debug) console.warn("[auth-attacher] getSession returned no token, refreshing");
        const { data: refreshed } = await supabase.auth.refreshSession();
        token = refreshed.session?.access_token;
        expiresAt = refreshed.session?.expires_at;
        if (token) source = "refresh";
      }
    } catch (err) {
      if (debug) console.error("[auth-attacher] session lookup threw:", err);
      // ignore — fall through to no-header path
    }
    if (debug) {
      const nowSec = Math.floor(Date.now() / 1000);
      const ttl = expiresAt ? expiresAt - nowSec : undefined;
      const ms = Math.round(performance.now() - start);
      console.log(
        `[auth-attacher] source=${source} token=${tokenTag(token)} ttl=${ttl ?? "?"}s took=${ms}ms`,
      );
      if (!token) {
        console.warn("[auth-attacher] dispatching server fn WITHOUT Authorization header");
      }
    }
    return next({
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  },
);