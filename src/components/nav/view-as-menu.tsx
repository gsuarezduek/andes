import type { ViewAsMenu } from "@/components/nav/types";

/** Etiqueta "Vista X" junto al nombre de usuario mientras se ve como otro rol. */
export function ViewAsBadge({ view, className = "" }: { view?: ViewAsMenu; className?: string }) {
  if (!view?.current) return null;
  return (
    <span
      className={`rounded-full bg-amber-500/15 px-1.5 py-0.5 text-amber-700 dark:text-amber-400 ${className}`}
    >
      Vista {view.current}
    </span>
  );
}

/**
 * Sección "Ver como…" del menú de cuenta (desktop y mobile): un ítem por cada
 * rol simulable y, si ya se está viendo como otro, "Volver a mi vista".
 */
export function ViewAsMenuItems({
  view,
  itemClassName,
  inMenu = false,
}: {
  view: ViewAsMenu;
  itemClassName: string;
  /** true dentro del `role="menu"` del desktop (los botones van como `menuitem`). */
  inMenu?: boolean;
}) {
  const role = inMenu ? "menuitem" : undefined;
  return (
    <>
      <div className="my-1 border-t border-foreground/10" />
      <span className="block px-3 pb-1 pt-1.5 text-xs sm:px-4 uppercase tracking-wide text-foreground/40">Ver como…</span>
      {view.options.map((opt) =>
        opt.role === view.currentRole ? (
          <span
            key={opt.role}
            aria-current="true"
            className={`${itemClassName} flex items-center justify-between bg-foreground/10 font-medium text-foreground`}
          >
            {opt.label}
            <span aria-hidden="true">✓</span>
          </span>
        ) : (
          <form key={opt.role} action={view.set}>
            <input type="hidden" name="role" value={opt.role} />
            <button
              type="submit"
              role={role}
              className={`${itemClassName} text-foreground/70 hover:bg-foreground/5`}
            >
              {opt.label}
            </button>
          </form>
        ),
      )}
      {view.current ? (
        <form action={view.clear}>
          <button
            type="submit"
            role={role}
            className={`${itemClassName} font-medium text-amber-700 hover:bg-foreground/5 dark:text-amber-400`}
          >
            Volver a mi vista
          </button>
        </form>
      ) : null}
    </>
  );
}
