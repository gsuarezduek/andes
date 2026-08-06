export function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  /** "warn" resalta el valor en ámbar (ej. comparaciones que necesitan atención). */
  tone?: "warn";
}) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className={`text-right font-medium ${tone === "warn" ? "text-amber-600" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}
