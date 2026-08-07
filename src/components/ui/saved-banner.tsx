/** Banner "Guardado ✓" tras un submit exitoso (patrón `?saved=1` + redirect). */
export function SavedBanner({ show, label = "Guardado." }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
      {label}
    </p>
  );
}
