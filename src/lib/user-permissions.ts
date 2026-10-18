export type Role = "empleado" | "admin" | "finanzas" | "observador";

export type UserPerm = { id: string; role: Role; owner: boolean };

/**
 * Orden jerárquico de los roles: cada uno tiene además todo lo del anterior
 * (empleado < admin < finanzas < observador). Ver CLAUDE.md — Finanzas suma
 * la visibilidad de las cuentas `PaymentMethod.financeOnly`; Observador suma
 * además quedar afuera de las listas operativas (`OPERATOR_FILTER`).
 * Propietario (`User.owner`) es un flag aparte, no un rango más: por
 * definición ve todo y nadie puede tocar sus permisos.
 */
export const ROLE_RANK: Record<Role, number> = {
  empleado: 0,
  admin: 1,
  finanzas: 2,
  observador: 3,
};

/** Admin, Finanzas y Observador tienen acceso de "nivel admin" (jerárquico). */
export function hasAdminAccess(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.admin;
}

/** Finanzas, Observador y el propietario ven las cuentas `financeOnly`. */
export function hasFinanceAccess(role: Role, owner = false): boolean {
  return owner || ROLE_RANK[role] >= ROLE_RANK.finanzas;
}

/**
 * Reglas de gestión de usuarios (pura, sin acceso a la base). Devuelve un
 * mensaje de error, o `null` si `actor` puede crear/editar/borrar a `target`.
 *
 * - La cuenta propietaria solo puede tocarla ella misma.
 * - Solo el propietario puede otorgar o subir a un rol de nivel admin o
 *   superior (admin/finanzas/observador) por encima del rango actual del
 *   target — incluido ascenderse a sí mismo. Un admin común (o finanzas)
 *   gestiona empleados sin problema, y puede bajarse de rango a sí mismo
 *   (los guardas de autobloqueo de `updateUser`/`deleteUser` siguen
 *   aplicando); sobre una cuenta que YA está en nivel admin o superior
 *   (salvo la propia), solo el propietario puede tocarla.
 *
 * `target` = null significa alta de un usuario nuevo (arranca en rango
 * "empleado"); `nextRole` es el rol que se le quiere dejar.
 */
export function userManagementError(
  actor: UserPerm,
  target: UserPerm | null,
  nextRole?: Role,
): string | null {
  if (target?.owner && target.id !== actor.id) {
    return "Esa cuenta es del propietario: nadie más puede modificarla.";
  }
  if (actor.owner) return null;

  const currentRank = target ? ROLE_RANK[target.role] : ROLE_RANK.empleado;
  const nextRank = nextRole ? ROLE_RANK[nextRole] : currentRank;

  if (nextRank >= ROLE_RANK.admin && nextRank > currentRank) {
    return "Solo el propietario puede otorgar ese rol.";
  }
  if (target && ROLE_RANK[target.role] >= ROLE_RANK.admin && target.id !== actor.id) {
    return "Solo el propietario puede modificar a otro administrador, usuario de Finanzas u Observador.";
  }
  return null;
}
