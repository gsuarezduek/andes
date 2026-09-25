"use client";

import { useActionState } from "react";
import type { User } from "@prisma/client";
import { TextField, SelectField, FormError } from "@/components/ui/fields";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { userRoleLabels } from "@/lib/labels";
import type { FormState } from "./actions";

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

export function UserForm({
  action,
  user,
  canGrantAdmin,
}: {
  action: Action;
  user?: User;
  /** Solo el propietario puede dejar a alguien como administrador. */
  canGrantAdmin: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const editing = Boolean(user);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField id="name" label="Nombre" required defaultValue={user?.name} />
      <TextField id="email" label="Email" type="email" required defaultValue={user?.email} autoComplete="off" />
      <SelectField id="role" label="Rol" defaultValue={user?.role ?? "empleado"}>
        {Object.entries(userRoleLabels)
          .filter(([value]) => canGrantAdmin || value !== "admin" || user?.role === "admin")
          .map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
      </SelectField>
      <TextField
        id="password"
        label={editing ? "Nueva contraseña" : "Contraseña"}
        type="password"
        autoComplete="new-password"
        required={!editing}
        hint={editing ? "Dejar en blanco para no cambiarla" : "Mínimo 6 caracteres"}
      />
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={user?.active ?? true}
          className="h-4 w-4"
        />
        Usuario activo
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="observer"
          defaultChecked={user?.observer ?? false}
          className="mt-0.5 h-4 w-4"
        />
        <span>
          Observador
          <span className="block text-xs text-foreground/60">
            Entra y ve según su rol, pero no aparece en las listas operativas (asignar tareas, usuarios en línea).
          </span>
        </span>
      </label>

      <FormError>{state.error}</FormError>

      <div className="flex gap-3">
        <SubmitButton>{editing ? "Guardar cambios" : "Crear usuario"}</SubmitButton>
        <ButtonLink href="/users" variant="secondary">
          Cancelar
        </ButtonLink>
      </div>
    </form>
  );
}
