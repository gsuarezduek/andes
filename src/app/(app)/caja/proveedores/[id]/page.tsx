import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getProviderBalances, getProviderLedger } from "@/lib/providers";
import { ThirdPartyAccountDetail } from "@/components/cash/third-party-account-detail";
import { ProviderQuickActions } from "@/components/cash/provider-quick-actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const provider = (await getProviderBalances()).find((p) => p.id === id);
  return { title: provider ? `${provider.name} — Caja — Andes` : "Proveedor — Andes" };
}

/**
 * Historial completo de un proveedor (Cuentas corrientes → click en la
 * tarjeta), partido por mes — reemplaza el viejo expandible inline en
 * `ProviderCard`: pedido del dueño, mismo criterio que Saldos. Visible para
 * cualquier rol (no es info sensible, ver `ProvidersSection`); editar/borrar
 * un movimiento sigue siendo solo admin (`ThirdPartyLedgerMonths`).
 */
export default async function ProviderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [providers, ledger, paymentMethods] = await Promise.all([
    getProviderBalances(),
    getProviderLedger(id),
    prisma.paymentMethod.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true, requiresNote: true },
    }),
  ]);

  const provider = providers.find((p) => p.id === id);
  if (!provider) notFound();

  return (
    <ThirdPartyAccountDetail
      account={provider}
      ledger={ledger}
      isAdmin={user.role === "admin"}
      paymentMethods={paymentMethods}
      quickActions={<ProviderQuickActions provider={provider} paymentMethods={paymentMethods} />}
    />
  );
}
