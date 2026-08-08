import type { ReactNode } from "react";

type Tone = "neutral" | "emerald" | "amber" | "red" | "blue" | "orange";

const tones: Record<Tone, string> = {
  neutral: "bg-foreground/10 text-foreground/70",
  // "Positivo" en toda la app es emerald (no green) — mismo tono que el ring
  // "complete" de acá abajo y el resto de los indicadores de éxito.
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  red: "bg-red-500/15 text-red-700 dark:text-red-400",
  blue: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  orange: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
};

type RingTone = "complete" | "pending";

const ringTones: Record<RingTone, string> = {
  complete: "ring-2 ring-emerald-500",
  pending: "ring-2 ring-red-500",
};

export function Badge({
  children,
  tone = "neutral",
  ring,
}: {
  children: ReactNode;
  tone?: Tone;
  /** Marca de pago (ver `paymentAccent` en src/lib/rental-payments.ts), superpuesta al tono del estado. */
  ring?: RingTone | null;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]} ${ring ? ringTones[ring] : ""}`}
    >
      {children}
    </span>
  );
}
