import { Badge } from "@/components/ui/badge";
import { userRoleBadgeTone } from "@/lib/labels";
import { ROLE_ACCESS } from "@/lib/role-access";

/**
 * Referencia de qué puede ver/hacer cada rol (`ROLE_ACCESS`) — solo se
 * renderiza si quien mira es el propietario (gateado en `page.tsx`, no acá).
 * Colapsado por defecto (mismo patrón que "Historial de ediciones"/"Días
 * especiales"): es material de consulta, no algo que haga falta ver siempre.
 */
export function RolesAccessSection() {
  return (
    <details className="group rounded-xl border border-foreground/10">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        <span>Roles y accesos</span>
        <span className="text-foreground/40 transition-transform group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="flex flex-col gap-3 border-t border-foreground/10 p-4">
        <p className="text-xs text-foreground/50">
          Solo vos ves esta sección — es información sensible sobre permisos, visible únicamente para el
          propietario.
        </p>
        <ul className="flex flex-col gap-3">
          {ROLE_ACCESS.map((r) => (
            <li key={r.role} className="rounded-lg border border-foreground/10 p-3">
              <Badge tone={r.role === "owner" ? "violet" : userRoleBadgeTone[r.role]}>{r.label}</Badge>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-foreground/70">
                {r.access.map((line, i) => (
                  <li key={i}>• {line}</li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
