import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { getAssociateBalances, getAssociateLedger } from "@/lib/associates";
import { ThirdPartyAccountDetail } from "@/components/cash/third-party-account-detail";
import { AssociateQuickActions } from "@/components/cash/associate-quick-actions";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const associate = (await getAssociateBalances()).find((a) => a.id === id);
  return { title: associate ? `${associate.name} — Caja — Andes` : "Asociado — Andes" };
}

/**
 * Historial completo de un asociado (Asociados → click en la tarjeta),
 * partido por mes — reemplaza el viejo expandible inline en `AssociateCard`:
 * pedido del dueño, mismo criterio que Saldos/Proveedores. Visible para
 * cualquier rol; editar/borrar un movimiento sigue siendo solo admin
 * (`ThirdPartyLedgerMonths`).
 */
export default async function AssociateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const [associates, ledger, paymentMethods] = await Promise.all([
    getAssociateBalances(),
    getAssociateLedger(id),
    prisma.paymentMethod.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true, requiresNote: true },
    }),
  ]);

  const associate = associates.find((a) => a.id === id);
  if (!associate) notFound();

  return (
    <ThirdPartyAccountDetail
      account={associate}
      ledger={ledger}
      isAdmin={user.role === "admin"}
      paymentMethods={paymentMethods}
      quickActions={<AssociateQuickActions associate={associate} paymentMethods={paymentMethods} />}
    />
  );
}
