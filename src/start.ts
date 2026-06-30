import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Logs every server request (SSR, server routes, server fns) with duration.
// Look for "[perf:server]" in server-function-logs to spot slow handlers.
const serverTimingMiddleware = createMiddleware().server(async ({ next, request }) => {
  const start = Date.now();
  const url = new URL(request.url);
  const label = `${request.method} ${url.pathname}${url.search}`;
  try {
    const result = await next();
    const ms = Date.now() - start;
    const tag = ms > 1000 ? "SLOW" : ms > 400 ? "warn" : "ok";
    console.log(`[perf:server] ${tag} ${ms}ms ${label}`);
    return result;
  } catch (err) {
    const ms = Date.now() - start;
    console.log(`[perf:server] ERR ${ms}ms ${label}`);
    throw err;
  }
});

// Logs every server-function call with duration + handler name.
const fnTimingMiddleware = createMiddleware({ type: "function" }).server(
  async ({ next, functionId }) => {
    const start = Date.now();
    try {
      const result = await next();
      const ms = Date.now() - start;
      const tag = ms > 800 ? "SLOW" : ms > 300 ? "warn" : "ok";
      console.log(`[perf:fn] ${tag} ${ms}ms ${functionId ?? "fn"}`);
      return result;
    } catch (err) {
      const ms = Date.now() - start;
      console.log(`[perf:fn] ERR ${ms}ms ${functionId ?? "fn"}`);
      throw err;
    }
  },
);

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, fnTimingMiddleware],
  requestMiddleware: [errorMiddleware, serverTimingMiddleware],
}));
