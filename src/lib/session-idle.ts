// Cierre de sesión por inactividad, con excepción para el propietario.
//
// Auth.js firma todos los JWT con el mismo `session.maxAge`: no admite un
// vencimiento distinto por usuario. Por eso el `maxAge` es largo para todos
// (`SESSION_MAX_AGE_S`, y se renueva en cada request) y el corte de 10
// minutos lo aplica `applyIdleTimeout` desde el callback `jwt` (corre en el
// proxy en cada request protegida): a quien no es propietario se le corta la
// sesión si pasó más de `IDLE_TIMEOUT_MS` desde su última request. El
// propietario (`User.owner`) queda con la sesión iniciada indefinidamente
// (mientras abra la app al menos una vez al año). Edge-safe: sin Prisma.

/** Inactividad máxima para quien no es propietario. */
export const IDLE_TIMEOUT_MS = 10 * 60 * 1000;

/** Vencimiento del JWT/cookie para todos (se renueva en cada request). */
export const SESSION_MAX_AGE_S = 365 * 24 * 60 * 60;

type IdleToken = { owner?: boolean; lastSeen?: number };

/**
 * Devuelve el token con `lastSeen` actualizado, o `null` (cierra la sesión)
 * si quien no es propietario estuvo inactivo más de `IDLE_TIMEOUT_MS`. Un
 * token sin `lastSeen` (emitido antes de este cambio, con vencimiento corto
 * propio) cuenta como activo ahora. Pura.
 */
export function applyIdleTimeout<T extends object>(token: T, now: number): T | null {
  const { owner, lastSeen } = token as IdleToken;
  if (owner !== true && typeof lastSeen === "number" && now - lastSeen > IDLE_TIMEOUT_MS) {
    return null;
  }
  return { ...token, lastSeen: now };
}
