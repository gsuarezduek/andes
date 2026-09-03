"use client";

import type { ComponentProps, ReactNode, WheelEvent } from "react";

const inputBase =
  "h-11 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40";
const inputErrorClass = "border-red-500/60 focus:border-red-500";

/**
 * Estilo compacto para controles SIN label visible (filtros de un listado:
 * estado, orden, búsqueda por usuario, etc.) — no son TextField/SelectField
 * porque esos siempre muestran un label arriba, y un filtro inline no lo
 * necesita. Antes cada pantalla de filtros repetía este mismo className a
 * mano; ahora es una sola fuente.
 */
export const compactControlClass =
  "h-10 rounded-lg border border-foreground/15 bg-transparent px-2 text-sm outline-none focus:border-foreground/40";

function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      {children}
      {error ? (
        <span className="text-xs font-medium text-red-600 dark:text-red-400">{error}</span>
      ) : hint ? (
        <span className="text-xs text-foreground/50">{hint}</span>
      ) : null}
    </label>
  );
}

// El browser cambia el valor de un <input type="number"> enfocado al girar
// la rueda del mouse encima — un usuario que solo quiere scrollear la
// página termina modificando un monto sin darse cuenta. Sacarle el foco al
// input en el primer evento de wheel evita el cambio de valor sin bloquear
// el scroll de la página (que sigue funcionando normal una vez desenfocado).
function blurOnWheel(e: WheelEvent<HTMLInputElement>) {
  e.currentTarget.blur();
}

export function TextField({
  label,
  hint,
  error,
  id,
  className = "",
  prefix,
  suffix,
  ...props
}: ComponentProps<"input"> & {
  label: string;
  hint?: string;
  error?: string;
  id: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}) {
  const onWheel = props.type === "number" ? blurOnWheel : undefined;
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error}>
      {prefix != null || suffix != null ? (
        <div className="relative">
          {prefix != null && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-foreground/50">
              {prefix}
            </span>
          )}
          <input
            id={id}
            name={id}
            aria-invalid={error ? true : undefined}
            className={`${inputBase} ${prefix != null ? "pl-7" : ""} ${suffix != null ? "pr-10" : ""} ${error ? inputErrorClass : ""} ${className}`}
            onWheel={onWheel}
            {...props}
          />
          {suffix != null && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-foreground/50">
              {suffix}
            </span>
          )}
        </div>
      ) : (
        <input
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          className={`${inputBase} ${error ? inputErrorClass : ""} ${className}`}
          onWheel={onWheel}
          {...props}
        />
      )}
    </FieldShell>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  id,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { label: string; hint?: string; error?: string; id: string }) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error}>
      <textarea
        id={id}
        name={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={`min-h-[5rem] w-full rounded-lg border border-foreground/15 bg-transparent p-3 text-base outline-none focus:border-foreground/40 ${error ? inputErrorClass : ""} ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  id,
  children,
  className = "",
  ...props
}: ComponentProps<"select"> & { label: string; hint?: string; error?: string; id: string }) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error}>
      <select
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        className={`${inputBase} ${error ? inputErrorClass : ""} ${className}`}
        {...props}
      >
        {children}
      </select>
    </FieldShell>
  );
}

/** Bloque de error de formulario, rojo, para mensajes de server actions. */
export function FormError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
      {children}
    </p>
  );
}
