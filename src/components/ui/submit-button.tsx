"use client";

import { useFormStatus } from "react-dom";
import { Button } from "./button";
import type { ComponentProps } from "react";

/** Botón de submit que se deshabilita y muestra "…" mientras el form envía.
 *  `disabled` (ej. un campo obligatorio todavía sin completar) se combina con
 *  el `pending` automático — nunca lo pisa. */
export function SubmitButton({
  children,
  pendingLabel,
  disabled,
  ...props
}: ComponentProps<typeof Button> & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} aria-busy={pending} {...props}>
      {pending ? (pendingLabel ?? "Guardando…") : children}
    </Button>
  );
}
