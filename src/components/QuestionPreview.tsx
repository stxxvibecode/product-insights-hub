import { useState } from "react";
import type { QuestionType } from "@/lib/question-types";

type Cfg = {
  options?: string[];
  max?: number;
  min?: number;
  minLabel?: string;
  maxLabel?: string;
};

export type TextFocus =
  | { kind: "question-title"; questionId: string }
  | { kind: "question-description"; questionId: string }
  | { kind: "question-option"; questionId: string; index: number }
  | { kind: "scale-min"; questionId: string }
  | { kind: "scale-max"; questionId: string };

export function QuestionPreview({
  type,
  title,
  description,
  required,
  config,
  value,
  onChange,
  onSubmit,
  onSelectText,
  questionId,
}: {
  type: QuestionType;
  title: string;
  description?: string | null;
  required?: boolean;
  config: Cfg;
  value: unknown;
  onChange: (v: unknown) => void;
  onSubmit?: (overrideValue?: unknown) => void;
  onSelectText?: (focus: TextFocus) => void;
  questionId?: string;
}) {
  const text = typeof value === "string" ? value : "";
  const num = typeof value === "number" ? value : null;
  const arr = Array.isArray(value) ? (value as string[]) : [];
  const options = config.options ?? [];

  const editable = Boolean(onSelectText && questionId);
  const canvasClass =
    "cursor-text rounded-md transition-colors hover:bg-foreground/[0.04] hover:ring-1 hover:ring-signal/40 hover:ring-inset";

  function select(focus: TextFocus, e: React.MouseEvent) {
    if (!editable) return;
    e.stopPropagation();
    onSelectText?.(focus);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--t-gap, 2rem)" }}>
      <h2
        className={`font-display font-semibold leading-tight tracking-tight text-balance ${editable ? `${canvasClass} -mx-1 px-1` : ""}`}
        style={{ fontSize: "var(--t-heading, 2.25rem)" }}
        onClick={
          editable && questionId
            ? (e) => select({ kind: "question-title", questionId }, e)
            : undefined
        }
      >
        {title ||
          (editable ? (
            <span className="text-muted-foreground/60">Untitled question</span>
          ) : (
            "Untitled question"
          ))}
        {required && <span className="ml-1 text-signal">*</span>}
      </h2>

      {description ? (
        <p
          className={`text-muted-foreground text-pretty ${editable ? `${canvasClass} -mx-1 px-1` : ""}`}
          style={{ fontSize: "var(--t-body, 1rem)" }}
          onClick={
            editable && questionId
              ? (e) => select({ kind: "question-description", questionId }, e)
              : undefined
          }
        >
          {description}
        </p>
      ) : editable && questionId ? (
        <p
          className={`italic text-muted-foreground/50 ${canvasClass} -mx-1 px-1`}
          style={{ fontSize: "var(--t-body, 1rem)" }}
          onClick={(e) => select({ kind: "question-description", questionId }, e)}
        >
          Add description…
        </p>
      ) : null}

      <div>
        {(type === "short_text" || type === "email") && (
          <input
            autoFocus
            type={type === "email" ? "email" : "text"}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onSubmit) {
                e.preventDefault();
                onSubmit();
              }
            }}
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && onSubmit) {
                e.preventDefault();
                onSubmit();
              }
            }}
            placeholder="0"
            className="w-full border-0 border-b border-border bg-transparent pb-3 text-3xl font-mono tabular-nums outline-none focus:border-signal"
          />
        )}
        {type === "yes_no" && (
          <div className="flex flex-wrap gap-3">
            {["Yes", "No"].map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  onChange(opt);
                  onSubmit?.(opt);
                }}
                className={`rounded-xl border px-5 py-3 transition-colors ${text === opt ? "border-signal bg-signal text-signal-foreground" : "border-border hover:border-foreground"}`}
                style={{ fontSize: "var(--t-button, 1rem)" }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
        {type === "single_choice" && (
          <ChoiceList
            options={options}
            selected={[text]}
            onSelect={(opt) => {
              onChange(opt);
              onSubmit?.(opt);
            }}
            editable={editable}
            questionId={questionId}
            onSelectText={onSelectText}
          />
        )}
        {type === "multi_choice" && (
          <ChoiceList
            multi
            options={options}
            selected={arr}
            onSelect={(opt) => {
              const next = arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt];
              onChange(next);
            }}
            editable={editable}
            questionId={questionId}
            onSelectText={onSelectText}
          />
        )}
        {type === "rating" && (
          <StarRow max={config.max ?? 5} value={num ?? 0} onChange={(n) => onChange(n)} />
        )}
        {type === "nps" && (
          <NumberRow
            min={0}
            max={10}
            value={num}
            onChange={(n) => {
              onChange(n);
              onSubmit?.(n);
            }}
          />
        )}
        {type === "scale" && (
          <div>
            <NumberRow
              min={config.min ?? 1}
              max={config.max ?? 7}
              value={num}
              onChange={(n) => {
                onChange(n);
                onSubmit?.(n);
              }}
            />
            <div className="mt-3 flex justify-between text-xs text-muted-foreground">
              <span
                className={editable && questionId ? `${canvasClass} -mx-1 px-1` : ""}
                onClick={
                  editable && questionId
                    ? (e) => select({ kind: "scale-min", questionId }, e)
                    : undefined
                }
              >
                {config.minLabel ?? "Low"}
              </span>
              <span
                className={editable && questionId ? `${canvasClass} -mx-1 px-1` : ""}
                onClick={
                  editable && questionId
                    ? (e) => select({ kind: "scale-max", questionId }, e)
                    : undefined
                }
              >
                {config.maxLabel ?? "High"}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ChoiceList({
  options,
  selected,
  onSelect,
  multi,
  editable,
  questionId,
  onSelectText,
}: {
  options: string[];
  selected: string[];
  onSelect: (opt: string) => void;
  multi?: boolean;
  editable?: boolean;
  questionId?: string;
  onSelectText?: (focus: TextFocus) => void;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt, i) => {
        const active = selected.includes(opt);
        const handle =
          editable && questionId
            ? (e: React.MouseEvent) => {
                e.stopPropagation();
                onSelectText?.({ kind: "question-option", questionId, index: i });
              }
            : () => onSelect(opt);
        return (
          <button
            key={opt + i}
            onClick={handle}
            className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${active && !editable ? "border-signal bg-signal/10 text-foreground" : "border-border hover:border-foreground"}`}
            style={{ fontSize: "var(--t-body, 1rem)" }}
          >
            <span className="flex items-center gap-3">
              <span
                className={`grid h-6 w-6 place-items-center ${multi ? "rounded-md" : "rounded-full"} border ${active && !editable ? "border-signal bg-signal text-signal-foreground" : "border-border"} text-xs font-mono`}
              >
                {active && !editable ? "✓" : String.fromCharCode(65 + i)}
              </span>
              <span>{opt}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StarRow({
  max,
  value,
  onChange,
}: {
  max: number;
  value: number;
  onChange: (n: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1.5" onMouseLeave={() => setHover(0)}>
      {Array.from({ length: max }).map((_, i) => {
        const n = i + 1;
        const active = (hover || value) >= n;
        return (
          <button
            key={n}
            onMouseEnter={() => setHover(n)}
            onClick={() => onChange(n)}
            className={`text-3xl transition-transform ${active ? "text-signal" : "text-muted-foreground"} hover:scale-110`}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}

function NumberRow({
  min,
  max,
  value,
  onChange,
}: {
  min: number;
  max: number;
  value: number | null;
  onChange: (n: number) => void;
}) {
  const items: number[] = [];
  for (let i = min; i <= max; i++) items.push(i);
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
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
