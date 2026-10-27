import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-helpers";
import { hasAdminAccess, hasFinanceAccess } from "@/lib/user-permissions";
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
 * pedido del dueño, mismo criterio que Saldos/Proveedores. Admin-only (pedido
 * del dueño): a diferencia de Proveedores, Asociados no se le muestra a un
 * empleado — ni la pestaña ni esta ruta puntual.
 */
export default async function AssociateDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const canSeeFinanceOnly = hasFinanceAccess(user.role, user.owner);

  const [associates, ledger, paymentMethods] = await Promise.all([
    getAssociateBalances(),
    getAssociateLedger(id),
    prisma.paymentMethod.findMany({
      where: { active: true, ...(canSeeFinanceOnly ? {} : { financeOnly: false }) },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true, requiresNote: true, ownership: true, parentId: true },
    }),
  ]);

  const associate = associates.find((a) => a.id === id);
  if (!associate) notFound();

  return (
    <ThirdPartyAccountDetail
      account={associate}
      activeSection="asociados"
      ledger={ledger}
      isAdmin={hasAdminAccess(user.role)}
      paymentMethods={paymentMethods}
      quickActions={<AssociateQuickActions associate={associate} paymentMethods={paymentMethods} />}
    />
  );
}
