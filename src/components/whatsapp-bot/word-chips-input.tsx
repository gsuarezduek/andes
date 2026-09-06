"use client";

import { useState } from "react";

/** Texto libre + Enter/botón agrega una palabra; click en la "×" la saca. Estado local. */
export function WordChipsInput({
  label,
  hint,
  words,
  onChange,
}: {
  label: string;
  hint?: string;
  words: string[];
  onChange: (words: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const value = draft.trim();
    if (value && !words.includes(value)) onChange([...words, value]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      {hint ? <span className="text-xs text-foreground/50">{hint}</span> : null}
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className="h-10 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-sm outline-none focus:border-foreground/40"
          placeholder="Escribí y presioná Enter"
        />
        <button
          type="button"
          onClick={add}
          className="h-10 shrink-0 rounded-lg border border-foreground/15 px-3 text-sm font-medium hover:bg-foreground/5"
        >
          Agregar
        </button>
      </div>
      {words.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {words.map((w) => (
            <span key={w} className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-xs">
              {w}
              <button
                type="button"
                onClick={() => onChange(words.filter((x) => x !== w))}
                aria-label={`Sacar "${w}"`}
                className="text-foreground/40 hover:text-foreground"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
