import { motion } from "motion/react";
import { themeStyle, backgroundClass, type SurveyTheme } from "@/lib/survey-theme";

export function PreviewSkeleton({
  theme,
  phase = "idle",
  stepLabel,
}: {
  theme: SurveyTheme;
  phase?: "idle" | "active";
  stepLabel?: string;
}) {
  const active = phase === "active";

  return (
    <div className="flex min-h-0 flex-col overflow-y-auto">
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-6">
        <div className="h-9 w-56 animate-pulse rounded-xl border border-border/70 bg-card/50" />
        <div className="h-8 w-64 animate-pulse rounded-lg border border-border bg-card/50" />

        <div
          className={`relative flex min-h-[640px] flex-1 flex-col overflow-hidden rounded-2xl border shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)] backdrop-blur transition-colors duration-300 ${
            active ? "border-signal/40 bg-card/80" : "border-border bg-card/70"
          }`}
        >
          {/* Frame chrome */}
          <div className="flex items-center gap-1.5 border-b border-border bg-background/40 px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            <div className="ml-3 h-4 w-56 animate-pulse rounded bg-muted-foreground/15" />
            {active && stepLabel && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-signal/40 bg-signal/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.14em] text-foreground/80"
              >
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-signal" />
                {stepLabel}
              </motion.span>
            )}
          </div>

          {/* Scan-line sweep while the assistant is actively building */}
          {active && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-0 z-10 motion-reduce:hidden"
              style={{
                background:
                  "linear-gradient(100deg, transparent 35%, rgba(255,122,69,0.10) 50%, transparent 65%)",
                backgroundSize: "220% 100%",
              }}
              animate={{ backgroundPositionX: ["-60%", "160%"] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
            />
          )}

          <div
            style={themeStyle(theme)}
            className={`flex-1 ${backgroundClass(theme)} flex flex-col items-center justify-center gap-6 px-10 py-16`}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="h-6 w-16 animate-pulse rounded-md bg-foreground/10" />
              <div className="h-9 w-80 animate-pulse rounded-lg bg-foreground/15" />
              <div className="h-4 w-64 animate-pulse rounded bg-foreground/10" />
            </div>
            <div className="mt-4 flex w-full max-w-lg flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, delay: active ? i * 0.12 : 0 }}
                  className={`h-14 w-full animate-pulse rounded-xl border bg-card/40 ${
                    active ? "border-signal/30" : "border-border/60"
                  }`}
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
            <div className="mt-3 h-10 w-32 animate-pulse rounded-full bg-foreground/20" />
          </div>
        </div>
      </div>
    </div>
  );
}
