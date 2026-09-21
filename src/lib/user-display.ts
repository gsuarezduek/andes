/**
 * Nombre a congelar como snapshot (ver Inspection.userName y el resto de los
 * campos `*Name`) cuando se registra una acción de un usuario de sesión. El
 * tipo de `next-auth` deja `name` como `string | null | undefined` aunque
 * `User.name` sea obligatorio en la base — este fallback es solo defensivo.
 */
export function displayName(user: { name?: string | null; email?: string | null }): string {
  return user.name ?? user.email ?? "Desconocido";
}
