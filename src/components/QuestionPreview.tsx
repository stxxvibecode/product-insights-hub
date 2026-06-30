import { useState } from "react";
import type { QuestionType } from "@/lib/question-types";

type Cfg = {
  options?: string[];
  max?: number;
  min?: number;
  minLabel?: string;
  maxLabel?: string;
};

export function QuestionPreview({
  type, title, description, required, config, value, onChange, onSubmit,
}: {
  type: QuestionType;
  title: string;
  description?: string | null;
  required?: boolean;
  config: Cfg;
  value: unknown;
  onChange: (v: unknown) => void;
  onSubmit?: (overrideValue?: unknown) => void;
}) {
  const text = typeof value === "string" ? value : "";
  const num = typeof value === "number" ? value : null;
  const arr = Array.isArray(value) ? (value as string[]) : [];

  return (
    <div>
      <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-balance md:text-4xl">
        {title || "Untitled question"}
        {required && <span className="ml-1 text-signal">*</span>}
      </h2>
      {description && <p className="mt-3 text-base text-muted-foreground text-pretty">{description}</p>}

      <div className="mt-8">
        {(type === "short_text" || type === "email") && (
          <input
            autoFocus
            type={type === "email" ? "email" : "text"}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && onSubmit) { e.preventDefault(); onSubmit(); } }}
            placeholder="Type your answer…"
            className="w-full border-0 border-b border-border bg-transparent pb-3 text-2xl outline-none placeholder:text-muted-foreground/60 focus:border-signal"
          />
        )}
        {type === "long_text" && (
          <textarea
            autoFocus
            value={text}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type your answer…"
            rows={4}
            className="w-full resize-none border-0 border-b border-border bg-transparent pb-3 text-xl outline-none placeholder:text-muted-foreground/60 focus:border-signal"
          />
        )}
        {type === "number" && (
          <input
            autoFocus
            type="number"
            value={num ?? ""}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
            onKeyDown={(e) => { if (e.key === "Enter" && onSubmit) { e.preventDefault(); onSubmit(); } }}
            placeholder="0"
            className="w-full border-0 border-b border-border bg-transparent pb-3 text-3xl font-mono tabular-nums outline-none focus:border-signal"
          />
        )}
        {type === "yes_no" && (
          <div className="flex flex-wrap gap-3">
            {["Yes", "No"].map((opt) => (
              <button
                key={opt}
                onClick={() => { onChange(opt); onSubmit?.(opt); }}
                className={`rounded-xl border px-5 py-3 text-base transition-colors ${text === opt ? "border-signal bg-signal text-signal-foreground" : "border-border hover:border-foreground"}`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {type === "single_choice" && (
          <ChoiceList
            options={config.options ?? []}
            selected={[text]}
            onSelect={(opt) => { onChange(opt); onSubmit?.(opt); }}
          />
        )}
        {type === "multi_choice" && (
          <ChoiceList
            multi
            options={config.options ?? []}
            selected={arr}
            onSelect={(opt) => {
              const next = arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt];
              onChange(next);
            }}
          />
        )}
        {type === "rating" && (
          <StarRow max={config.max ?? 5} value={num ?? 0} onChange={(n) => { onChange(n); }} />
        )}
        {type === "nps" && (
          <NumberRow min={0} max={10} value={num} onChange={(n) => { onChange(n); onSubmit?.(n); }} />
        )}
        {type === "scale" && (
          <div>
            <NumberRow min={config.min ?? 1} max={config.max ?? 7} value={num} onChange={(n) => { onChange(n); onSubmit?.(n); }} />
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span>{config.minLabel ?? "Low"}</span>
              <span>{config.maxLabel ?? "High"}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChoiceList({ options, selected, onSelect, multi }: { options: string[]; selected: string[]; onSelect: (opt: string) => void; multi?: boolean }) {
  return (
    <div className="space-y-2">
      {options.map((opt, i) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt + i}
            onClick={() => onSelect(opt)}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${active ? "border-signal bg-signal/10 text-foreground" : "border-border hover:border-foreground"}`}
          >
            <span className="flex items-center gap-3">
              <span className={`grid h-6 w-6 place-items-center rounded ${multi ? "rounded-md" : "rounded-full"} border ${active ? "border-signal bg-signal text-signal-foreground" : "border-border"} text-xs font-mono`}>
                {active ? "✓" : String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StarRow({ max, value, onChange }: { max: number; value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: max }).map((_, i) => {
        const n = i + 1;
        const active = (hover || value) >= n;
        return (
          <button key={n} onMouseEnter={() => setHover(n)} onClick={() => onChange(n)}
            className={`text-3xl transition-transform ${active ? "text-signal" : "text-muted-foreground"} hover:scale-110`}>
            ★
          </button>
        );
      })}
    </div>
  );
}

function NumberRow({ min, max, value, onChange }: { min: number; max: number; value: number | null; onChange: (n: number) => void }) {
  const items = [];
  for (let i = min; i <= max; i++) items.push(i);
  return (
    <div className={`grid gap-1.5`} style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className={`aspect-square rounded-md border text-sm font-medium tabular-nums transition-colors ${value === n ? "border-signal bg-signal text-signal-foreground" : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"}`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}