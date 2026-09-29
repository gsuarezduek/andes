import Link from "next/link";
import { CAJA_SECTIONS, type CajaSectionKey } from "./caja-sections";

/**
 * Misma barra de pestañas que `CajaTabs` pero de solo navegación (links a
 * `/caja?tab=…`, no cambia estado in-page) — para las páginas de detalle que
 * viven fuera de `/caja` (proveedor/asociado/cuenta puntual). Sin esto, al
 * entrar a ver una cuenta se perdía toda la navegación de arriba y había que
 * volver a `/caja` (que abre en "Movimientos") y clickear la pestaña de
 * nuevo. La sección de la que se vino queda resaltada.
 */
export function CajaSectionNav({
  active,
  showSaldos = true,
}: {
  active: CajaSectionKey;
  /** Saldos es admin-only — las páginas de detalle de proveedor/asociado la ocultan para un no-admin. */
  showSaldos?: boolean;
}) {
  const sections = showSaldos ? CAJA_SECTIONS : CAJA_SECTIONS.filter((s) => s.key !== "saldos");
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {sections.map((s) => (
        <Link
          key={s.key}
          href={s.key === "movimientos" ? "/caja" : `/caja?tab=${s.key}`}
          aria-current={s.key === active ? "step" : undefined}
          className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
            s.key === active
              ? "bg-foreground text-background"
              : "border border-foreground/15 text-foreground/60 hover:border-foreground/30"
          }`}
        >
          {s.label}
        </Link>
      ))}
    </div>
  );
}
