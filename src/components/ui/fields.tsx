import type { ComponentProps, ReactNode } from "react";

const inputBase =
  "h-11 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40";
const inputErrorClass = "border-red-500/60 focus:border-red-500";

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

export function TextField({
  label,
  hint,
  error,
  id,
  className = "",
  prefix,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string; id: string; prefix?: ReactNode }) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error}>
      {prefix != null ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-foreground/50">
            {prefix}
          </span>
          <input
            id={id}
            name={id}
            aria-invalid={error ? true : undefined}
            className={`${inputBase} pl-7 ${error ? inputErrorClass : ""} ${className}`}
            {...props}
          />
        </div>
      ) : (
        <input
          id={id}
          name={id}
          aria-invalid={error ? true : undefined}
          className={`${inputBase} ${error ? inputErrorClass : ""} ${className}`}
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
