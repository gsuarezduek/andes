import { LockIcon } from "@/components/ui/icons";

/**
 * Etiqueta de una cuenta reservada a Finanzas (ver `PaymentMethod.financeOnly`):
 * fondo negro (blanco en modo oscuro) con candado, para que se distinga de un
 * vistazo de una cuenta común en Saldos y en la página de la cuenta.
 */
export function FinanceOnlyBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-semibold text-background">
      <LockIcon />
      Solo Finanzas
    </span>
  );
}
