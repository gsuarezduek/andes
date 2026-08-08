import type { ReactNode } from "react";

/**
 * Botón que alterna un estado on/off con estilo "chip" (borde + fondo tenue
 * cuando está activo). Antes cada wizard reimplementaba a mano las mismas
 * clases con pequeñas variaciones (KM Libres, Mejora de seguro, Pack de KM).
 */
export function ToggleButton({
  active,
  onClick,
  disabled,
  tone = "default",
  className = "",
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "accent";
  className?: string;
  children: ReactNode;
}) {
  const activeClass =
    tone === "accent"
      ? "border-orange-500 bg-orange-500/15 text-orange-700 dark:text-orange-400"
      : "border-foreground bg-foreground text-background";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${active ? activeClass : "border-foreground/25 text-foreground/70"} ${className}`}
    >
      {children}
    </button>
  );
}
