export type UserPerm = { id: string; role: "admin" | "empleado"; owner: boolean };

/**
 * Reglas de gestión de usuarios (pura, sin acceso a la base). Devuelve un
 * mensaje de error, o `null` si `actor` puede crear/editar/borrar a `target`.
 *
 * - La cuenta propietaria solo puede tocarla ella misma.
 * - Solo el propietario puede crear administradores, ascender a alguien a
 *   admin o modificar a otro admin. Un admin común (incluidos los observadores)
 *   gestiona empleados; sobre su propia cuenta puede editarse (los guardas de
 *   autobloqueo de `updateUser`/`deleteUser` siguen aplicando).
 *
 * `target` = null significa alta de un usuario nuevo; `nextRole` es el rol que
 * se le quiere dejar.
 */
export function userManagementError(
  actor: UserPerm,
  target: UserPerm | null,
  nextRole?: "admin" | "empleado",
): string | null {
  if (target?.owner && target.id !== actor.id) {
    return "Esa cuenta es del propietario: nadie más puede modificarla.";
  }
  if (actor.owner) return null;

  if (nextRole === "admin" && target?.role !== "admin") {
    return "Solo el propietario puede crear administradores o ascender a alguien a administrador.";
  }
  if (target && target.role === "admin" && target.id !== actor.id) {
    return "Solo el propietario puede modificar a otros administradores.";
  }
  return null;
}
