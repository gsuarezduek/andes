import { AccountCard } from "./account-card";
import type { OwnAccountBalance } from "@/lib/cash";

/**
 * Saldo de cada cuenta propia (Efectivo, banco, Mercado Pago, etc.) — una
 * `AccountCard` por cuenta principal, que linkea a `/caja/saldos/[id]` para
 * ver su historial (ya no se expande inline, ver `AccountCard`). Solo admin
 * (ver `caja/page.tsx`): a diferencia de Proveedores/Asociados, esto es la
 * posición de plata real de la empresa.
 */
export function AccountsSection({
  accounts,
}: {
  accounts: (OwnAccountBalance & { movementCount: number })[];
}) {
  if (accounts.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-3 py-2 text-sm text-foreground/50">
        Todavía no hay cuentas propias configuradas. Agregalas en Configuración → Medios de pago (Tipo de cuenta:
        Propia).
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {accounts.map((a) => (
        <AccountCard key={a.id} account={a} />
      ))}
    </div>
  );
}
