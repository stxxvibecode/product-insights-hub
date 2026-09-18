import { motion } from "motion/react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import agentMark from "@/assets/agent-mark.png";
import type { BuildPhase } from "@/lib/build-phases";

export function BuildStatusBanner({
  phase,
  stepLabel,
  completed,
}: {
  phase: BuildPhase;
  stepLabel: string;
  completed: number;
}) {
  if (phase === "ready") return null;

  const isStreaming = phase === "streaming";
  // Asymptotic progress — never claims to be finished.
  const pct = Math.min(92, 8 + completed * 18);

  return (
    <div className="pl-0.5">
      <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
        <span className="relative inline-flex">
          {isStreaming && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-md bg-signal/25 motion-reduce:hidden"
              animate={{ opacity: [0.5, 0, 0.5], scale: [1, 1.5, 1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <img
            src={agentMark}
            alt=""
            className={`relative h-6 w-6 rounded-md ${isStreaming ? "" : "opacity-70"}`}
          />
        </span>
        <Shimmer>{isStreaming ? stepLabel : "Composing"}</Shimmer>
        <span className="flex items-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1 w-1 rounded-full bg-muted-foreground/70"
              animate={{ opacity: [0.25, 1, 0.25] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                delay: i * 0.18,
                ease: "easeInOut",
              }}
            />
          ))}
        </span>
      </div>
      {isStreaming && (
        <div className="mt-2.5 ml-8 h-0.5 w-40 overflow-hidden rounded-full bg-border">
          <motion.div
            className="h-full rounded-full bg-signal"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          />
        </div>
      )}
    </div>
  );
}
