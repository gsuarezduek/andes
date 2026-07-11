/**
 * Loader de Andes: un trazo de luz recorre la silueta de los picos en loop.
 * Mismo arte que `public/icons/loader.svg`, inline para poder dimensionarlo,
 * teñirlo con la marca y respetar `prefers-reduced-motion`.
 */
export function Loader({
  label = "Cargando…",
  className,
  size = 124,
}: {
  /** Texto accesible; se muestra debajo salvo que se pase `srOnly`. */
  label?: string;
  className?: string;
  /** Ancho del trazo en px (mantiene la relación 248×160). */
  size?: number;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center gap-3 ${className ?? ""}`}
    >
      <svg
        width={size}
        height={(size * 160) / 248}
        viewBox="0 0 248 160"
        aria-hidden="true"
        className="andes-loader"
      >
        <path
          className="andes-loader-track"
          fill="none"
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 140 L84 52 L120 100 L172 24 L232 140"
          pathLength={100}
        />
        <path
          className="andes-loader-runner"
          fill="none"
          strokeWidth={12}
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16 140 L84 52 L120 100 L172 24 L232 140"
          pathLength={100}
        />
      </svg>
      {label ? (
        <span className="text-sm tracking-wide text-foreground/60">{label}</span>
      ) : null}
    </div>
  );
}
