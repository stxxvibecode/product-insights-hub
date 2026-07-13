import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
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
  editable, onEditTitle, onEditDescription, onEditConfig,
}: {
  type: QuestionType;
  title: string;
  description?: string | null;
  required?: boolean;
  config: Cfg;
  value: unknown;
  onChange: (v: unknown) => void;
  onSubmit?: (overrideValue?: unknown) => void;
  editable?: boolean;
  onEditTitle?: (v: string) => void;
  onEditDescription?: (v: string | null) => void;
  onEditConfig?: (patch: Partial<Cfg>) => void;
}) {
  const text = typeof value === "string" ? value : "";
  const num = typeof value === "number" ? value : null;
  const arr = Array.isArray(value) ? (value as string[]) : [];

  const options = config.options ?? [];
  function commitOptions(next: string[]) {
    onEditConfig?.({ options: next });
  }

  return (
    <div>
      <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight text-balance md:text-4xl">
        {editable ? (
          <InlineEditable
            value={title}
            placeholder="Untitled question"
            onCommit={(v) => {
              const trimmed = v.trim();
              if (trimmed && trimmed !== title) onEditTitle?.(trimmed);
            }}
            fullWidth
          />
        ) : (
          title || "Untitled question"
        )}
        {required && <span className="ml-1 text-signal">*</span>}
      </h2>
      {editable ? (
        <div className="mt-3 text-base text-muted-foreground text-pretty">
          <InlineEditable
            value={description ?? ""}
            placeholder="Add description…"
            multiline
            onCommit={(v) => {
              const next = v.trim() ? v : null;
              if ((next ?? "") !== (description ?? "")) onEditDescription?.(next);
            }}
            fullWidth
          />
        </div>
      ) : description ? (
        <p className="mt-3 text-base text-muted-foreground text-pretty">{description}</p>
      ) : null}

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
          editable ? (
            <EditableChoiceList
              options={options}
              onRename={(i, v) => { const next = [...options]; next[i] = v; commitOptions(next); }}
              onDelete={(i) => { if (options.length > 1) commitOptions(options.filter((_, idx) => idx !== i)); }}
              onAdd={() => commitOptions([...options, `Option ${options.length + 1}`])}
            />
          ) : (
            <ChoiceList
              options={config.options ?? []}
              selected={[text]}
              onSelect={(opt) => { onChange(opt); onSubmit?.(opt); }}
            />
          )
        )}
        {type === "multi_choice" && (
          editable ? (
            <EditableChoiceList
              multi
              options={options}
              onRename={(i, v) => { const next = [...options]; next[i] = v; commitOptions(next); }}
              onDelete={(i) => { if (options.length > 1) commitOptions(options.filter((_, idx) => idx !== i)); }}
              onAdd={() => commitOptions([...options, `Option ${options.length + 1}`])}
            />
          ) : (
            <ChoiceList
              multi
              options={config.options ?? []}
              selected={arr}
              onSelect={(opt) => {
                const next = arr.includes(opt) ? arr.filter((o) => o !== opt) : [...arr, opt];
                onChange(next);
              }}
            />
          )
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
              {editable ? (
                <InlineEditable
                  value={config.minLabel ?? "Low"}
                  placeholder="Low"
                  onCommit={(v) => onEditConfig?.({ minLabel: v.trim() || "Low" })}
                />
              ) : (
                <span>{config.minLabel ?? "Low"}</span>
              )}
              {editable ? (
                <InlineEditable
                  value={config.maxLabel ?? "High"}
                  placeholder="High"
                  onCommit={(v) => onEditConfig?.({ maxLabel: v.trim() || "High" })}
                />
              ) : (
                <span>{config.maxLabel ?? "High"}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InlineEditable({
  value, placeholder, onCommit, multiline, fullWidth,
}: {
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
  multiline?: boolean;
  fullWidth?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select?.();
    }
  }, [editing]);

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setEditing(true); } }}
        className={`-mx-1 cursor-text rounded-md px-1 transition-colors hover:bg-foreground/5 ${fullWidth ? "block" : "inline-block"} ${!value ? "text-muted-foreground/60" : ""}`}
      >
        {value || placeholder || " "}
      </span>
    );
  }

  const commit = () => { setEditing(false); if (draft !== value) onCommit(draft); };
  const cancel = () => { setDraft(value); setEditing(false); };

  if (multiline) {
    return (
      <textarea
        ref={(el) => { inputRef.current = el; }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); cancel(); } }}
        rows={2}
        placeholder={placeholder}
        className="-mx-1 block w-full resize-none rounded-md bg-foreground/5 px-1 outline-none ring-1 ring-signal/40"
        style={{ font: "inherit", color: "inherit" }}
      />
    );
  }
  return (
    <input
      ref={(el) => { inputRef.current = el; }}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        else if (e.key === "Escape") { e.preventDefault(); cancel(); }
      }}
      placeholder={placeholder}
      className={`-mx-1 rounded-md bg-foreground/5 px-1 outline-none ring-1 ring-signal/40 ${fullWidth ? "block w-full" : "inline-block"}`}
      style={{ font: "inherit", color: "inherit", letterSpacing: "inherit" }}
    />
  );
}

function EditableChoiceList({
  options, onRename, onDelete, onAdd, multi,
}: {
  options: string[];
  onRename: (i: number, v: string) => void;
  onDelete: (i: number) => void;
  onAdd: () => void;
  multi?: boolean;
}) {
  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={i} className="group flex w-full items-center gap-3 rounded-xl border border-border px-4 py-3">
          <span className={`grid h-6 w-6 shrink-0 place-items-center border border-border font-mono text-xs ${multi ? "rounded-md" : "rounded-full"}`}>
            {String.fromCharCode(65 + i)}
          </span>
          <EditableOptionText value={opt} onCommit={(v) => onRename(i, v)} />
          <button
            type="button"
            onClick={() => onDelete(i)}
            disabled={options.length <= 1}
            aria-label="Remove option"
            className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> Add option
      </button>
    </div>
  );
}

function EditableOptionText({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = draft.trim();
        if (!v) { setDraft(value); return; }
        if (v !== value) onCommit(v);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
        else if (e.key === "Escape") { setDraft(value); (e.target as HTMLInputElement).blur(); }
      }}
      className="-mx-1 flex-1 rounded bg-transparent px-1 outline-none focus:bg-foreground/5"
    />
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