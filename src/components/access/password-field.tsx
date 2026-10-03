"use client";

import { useState } from "react";
import { TextField } from "@/components/ui/fields";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

/**
 * Campo de contraseña con botón de ojo para alternar texto plano/oculto
 * mientras se tipea — `type="password"` nativo sin esto no deja revisar un
 * typo antes de guardar. El botón va en el `suffix` de `TextField`, que lo
 * posiciona dentro de un span `pointer-events-none`; se le pasa
 * `pointer-events-auto` para que siga siendo clickeable.
 */
export function PasswordField({
  id,
  label,
  hint,
  defaultValue,
  required,
}: {
  id: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      id={id}
      label={label}
      hint={hint}
      type={visible ? "text" : "password"}
      defaultValue={defaultValue}
      required={required}
      autoComplete="off"
      suffix={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar" : "Mostrar"}
          className="pointer-events-auto rounded-md p-1 text-foreground/40 hover:text-foreground/70"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      }
    />
  );
}
