export function CompareRow({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-foreground/60">{label}</span>
      <span className={`text-right font-medium ${tone === "warn" ? "text-amber-600" : ""}`}>{value}</span>
    </div>
  );
}
