export function AutosaveStatus({ pending, saved }: { pending: boolean; saved: boolean }) {
  if (pending) return <span className="text-xs text-foreground/40">Guardando…</span>;
  if (saved) return <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Guardado ✓</span>;
  return null;
}
