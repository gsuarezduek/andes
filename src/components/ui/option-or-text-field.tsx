"use client";

import { useState } from "react";
import { SelectField, TextField } from "@/components/ui/fields";

const OTHER = "__other__";

/**
 * Elegir un valor de una lista o escribir otro. Lo que se envía es siempre un
 * solo campo de texto (`name`), así la acción del servidor no distingue si
 * vino de la lista o se tipeó. Sin opciones, es un campo de texto común.
 *
 * Controlado (`value`/`onChange`): los formularios con `<form action>` de
 * React 19 resetean los campos no controlados después de cada envío.
 */
export function OptionOrTextField({
  id,
  label,
  options,
  value,
  onChange,
  required,
  error,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  error?: string;
  hint?: string;
  placeholder?: string;
}) {
  // "Otro" queda elegido mientras se escribe, aunque el texto todavía esté
  // vacío o coincida a medias con una opción.
  const [typing, setTyping] = useState(() => value !== "" && !options.includes(value));

  if (options.length === 0) {
    return (
      <TextField
        id={id}
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        error={error}
        hint={hint}
        placeholder={placeholder}
      />
    );
  }

  const selected = typing ? OTHER : value;
  return (
    <div className="flex flex-col gap-2">
      <SelectField
        id={`${id}Choice`}
        name=""
        label={label}
        value={selected}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setTyping(true);
            onChange("");
          } else {
            setTyping(false);
            onChange(e.target.value);
          }
        }}
        required={required}
        error={typing ? undefined : error}
        hint={typing ? undefined : hint}
      >
        <option value="">{required ? "Elegí una opción" : "Sin dato"}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        <option value={OTHER}>Otro (escribir)</option>
      </SelectField>
      {typing ? (
        <TextField
          id={id}
          label={`${label} (otro)`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          error={error}
          hint={hint}
          placeholder={placeholder}
          autoFocus
        />
      ) : (
        <input type="hidden" name={id} value={value} />
      )}
    </div>
  );
}
