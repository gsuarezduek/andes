import type { ComponentProps, ReactNode } from "react";

const inputBase =
  "h-11 w-full rounded-lg border border-foreground/15 bg-transparent px-3 text-base outline-none focus:border-foreground/40";

function FieldShell({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      {children}
      {hint ? <span className="text-xs text-foreground/50">{hint}</span> : null}
    </label>
  );
}

export function TextField({
  label,
  hint,
  id,
  className = "",
  prefix,
  ...props
}: ComponentProps<"input"> & { label: string; hint?: string; id: string; prefix?: ReactNode }) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      {prefix != null ? (
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-foreground/50">
            {prefix}
          </span>
          <input id={id} name={id} className={`${inputBase} pl-7 ${className}`} {...props} />
        </div>
      ) : (
        <input id={id} name={id} className={`${inputBase} ${className}`} {...props} />
      )}
    </FieldShell>
  );
}

export function TextareaField({
  label,
  hint,
  id,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { label: string; hint?: string; id: string }) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <textarea
        id={id}
        name={id}
        rows={3}
        className={`min-h-[5rem] w-full rounded-lg border border-foreground/15 bg-transparent p-3 text-base outline-none focus:border-foreground/40 ${className}`}
        {...props}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  id,
  children,
  className = "",
  ...props
}: ComponentProps<"select"> & { label: string; hint?: string; id: string }) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint}>
      <select id={id} name={id} className={`${inputBase} ${className}`} {...props}>
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
