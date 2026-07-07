import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type Mode = "light" | "dark";

const STORAGE_KEY = "insightform-theme";

type Ctx = {
  theme: Theme;
  mode: Mode;
  setTheme: (t: Theme) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

function resolveMode(theme: Theme): Mode {
  if (theme === "system") {
    if (typeof window === "undefined") return "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const [mode, setMode] = useState<Mode>(() => resolveMode(readStoredTheme()));

  useEffect(() => {
    const next = resolveMode(theme);
    setMode(next);
    const root = document.documentElement;
    if (next === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const next: Mode = mq.matches ? "dark" : "light";
      setMode(next);
      const root = document.documentElement;
      if (next === "dark") root.classList.add("dark");
      else root.classList.remove("dark");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  function setTheme(t: Theme) {
    setThemeState(t);
    try {
      window.localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* ignore */
    }
  }

  return <ThemeCtx.Provider value={{ theme, mode, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}

/** Inline script to set the theme class before hydration to avoid FOUC. */
export const themeInitScript = `(() => { try { var t = localStorage.getItem('${STORAGE_KEY}') || 'system'; var d = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches); var r = document.documentElement; if (d) r.classList.add('dark'); else r.classList.remove('dark'); } catch(e){} })();`;