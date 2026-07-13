import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Palette, X } from "lucide-react";
import { ThemePanel, type ThemePanelContent, type ThemePanelTab } from "@/components/ThemePanel";
import type { SurveyTheme } from "@/lib/survey-theme";
import type { TextFocus } from "@/components/QuestionPreview";

export function FormDesignPanel({
  open,
  onClose,
  theme,
  onThemeChange,
  defaultTab,
  focus,
  content,
}: {
  open: boolean;
  onClose: () => void;
  theme: SurveyTheme;
  onThemeChange: (next: SurveyTheme) => void;
  defaultTab?: ThemePanelTab;
  focus?: TextFocus | null;
  content?: ThemePanelContent;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="design-panel"
          initial={{ x: "-100%", opacity: 1, scale: 1, filter: "blur(0px)" }}
          animate={{ x: 0, opacity: 1, scale: 1, filter: "blur(0px)" }}
          exit={{ x: 0, opacity: 0, scale: 0.98, filter: "blur(6px)" }}
          transition={{
            x: { type: "spring", stiffness: 520, damping: 44, mass: 0.7 },
            opacity: { duration: 0.18, ease: "easeOut" },
            scale: { duration: 0.18, ease: "easeOut" },
            filter: { duration: 0.18, ease: "easeOut" },
          }}
          style={{ willChange: "transform, opacity, filter" }}
          className="absolute inset-0 z-40 flex flex-col bg-background"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-signal" />
              <span className="font-display text-sm font-medium">Form Design</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close form design"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <ThemePanel
              theme={theme}
              onChange={onThemeChange}
              defaultTab={defaultTab}
              focus={focus ?? null}
              content={content}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function FormDesignPill({
  onClick,
  className,
}: {
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-foreground shadow-sm backdrop-blur transition-colors hover:border-signal/40 ${className ?? ""}`}
    >
      <Palette className="h-3.5 w-3.5 text-signal" /> Form Design
    </button>
  );
}