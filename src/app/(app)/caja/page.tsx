import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  currentMonth,
  getCashPeriodDetail,
  getDeletedCashMovements,
  getCashSearchIndex,
  getGuaranteeLedger,
  getOwnAccountBalances,
  getOwnAccountLedger,
  getOwnCashMovements,
  getRentalPickerOptions,
  getUnconfirmedCashMovements,
  getWalletBalance,
  parseCashPeriod,
} from "@/lib/cash";
import { getAllSafeMovements, getSafeBalance, getSafeMovementEdits } from "@/lib/safe";
import { getProviderBalances, getProviderLedger } from "@/lib/providers";
import { getAssociateBalances, getAssociateLedger } from "@/lib/associates";
import { MovementLauncher } from "@/components/cash/movement-launcher";
import { CashMovementSearch } from "@/components/cash/cash-movement-search";
import { CashPeriodDetail } from "@/components/cash/cash-period-detail";
import { IncomesBoard } from "@/components/cash/incomes-board";
import { CashOwnList } from "@/components/cash/cash-own-list";
import { SafeSection } from "@/components/cash/safe-section";
import { SafeLauncher } from "@/components/cash/safe-launcher";
import { UnconfirmedIncomesSection } from "@/components/cash/unconfirmed-incomes-section";
import { ProvidersSection } from "@/components/cash/providers-section";
import { AssociatesSection } from "@/components/cash/associates-section";
import { AccountsSection } from "@/components/cash/accounts-section";
import { GuaranteesSection } from "@/components/cash/guarantees-section";
import { CajaTabs } from "@/components/cash/caja-tabs";

export const metadata: Metadata = { title: "Caja — Andes" };

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const user = await requireUser();
  const { period: rawPeriod, from: rawFrom, to: rawTo } = await searchParams;
  const period = parseCashPeriod(rawPeriod, rawFrom, rawTo);

  const [paymentMethods, expenseCategories, rentalOptions] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true, requiresNote: true, ownership: true, parentId: true },
    }),
    prisma.cashMovementCategory.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true },
    }),
    getRentalPickerOptions(),
  ]);

  const isAdmin = user.role === "admin";
  const periodDetail = await getCashPeriodDetail(period);

  const movimientos = (
    <div className="flex flex-col gap-5">
      <CashMovementSearch index={await getCashSearchIndex(isAdmin)} />

      <MovementLauncher paymentMethods={paymentMethods} rentalOptions={rentalOptions} expenseCategories={expenseCategories} />

      <UnconfirmedIncomesSection
        movements={await getUnconfirmedCashMovements()}
        paymentMethods={paymentMethods}
      />

      {isAdmin ? (
        <CashPeriodDetail
          data={periodDetail}
          deleted={await getDeletedCashMovements(period)}
          paymentMethods={paymentMethods}
          expenseCategories={expenseCategories}
          period={period}
        />
      ) : (
        <>
          {/* Los ingresos se ven completos, sin restricción, para cualquier
              rol — a diferencia de los egresos, que un no-admin sigue viendo
              solo entre "Mis movimientos" (más abajo). */}
          <IncomesBoard incomes={periodDetail.incomes} totalIncome={periodDetail.totalIncome} period={period} />
          <CashOwnList items={await getOwnCashMovements(user.id, currentMonth())} />
        </>
      )}
    </div>
  );

  // Proveedores (cuenta corriente) y Asociados (resumen) son visibles para
  // cualquier rol — a diferencia de Caja fuerte, no es info sensible: es
  // operativo (a quién le debemos, cargar un pago/ingreso/egreso) y
  // cualquiera puede necesitarlo.
  const providerBalances = await getProviderBalances();
  const providersWithLedger = await Promise.all(
    providerBalances.map(async (p) => ({ ...p, ledger: await getProviderLedger(p.id) })),
  );
  const proveedores = (
    <ProvidersSection providers={providersWithLedger} paymentMethods={paymentMethods} isAdmin={isAdmin} />
  );

  const associateBalances = await getAssociateBalances();
  const associatesWithLedger = await Promise.all(
    associateBalances.map(async (a) => ({ ...a, ledger: await getAssociateLedger(a.id) })),
  );
  const asociados = (
    <AssociatesSection associates={associatesWithLedger} paymentMethods={paymentMethods} isAdmin={isAdmin} />
  );

  // Saldo + historial por cuenta propia — igual que la Caja fuerte, es la
  // posición de plata real de la empresa, así que solo se calcula/pasa para
  // admin (ver comentario en `CajaTabs`).
  let saldos: ReactNode = undefined;
  if (isAdmin) {
    const ownAccountBalances = await getOwnAccountBalances();
    const ownAccountsWithCount = await Promise.all(
      ownAccountBalances.map(async (a) => ({ ...a, movementCount: (await getOwnAccountLedger(a.id)).length })),
    );
    saldos = <AccountsSection accounts={ownAccountsWithCount} />;
  }

  // Garantías/depósitos (ver `RentalPayment.isGuarantee`) — mismo criterio de
  // sensibilidad que Saldos/Caja fuerte, admin-only.
  const garantias = isAdmin ? (
    <GuaranteesSection
      ledger={await getGuaranteeLedger()}
      paymentMethods={paymentMethods}
      expenseCategories={expenseCategories}
    />
  ) : undefined;

  const cajaFuerte = (
    <div className="flex flex-col gap-5">
      <SafeLauncher />
      {isAdmin ? (
        <SafeSection
          movements={await getAllSafeMovements()}
          balance={await getSafeBalance()}
          walletBalance={await getWalletBalance()}
          edits={await getSafeMovementEdits()}
        />
      ) : (
        <SafeSection movements={null} balance={null} walletBalance={null} />
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
        <p className="text-sm text-foreground/60">Registrá ingresos y egresos de las reservas.</p>
      </div>

      <CajaTabs
        movimientos={movimientos}
        asociados={asociados}
        proveedores={proveedores}
        garantias={garantias}
        saldos={saldos}
        cajaFuerte={cajaFuerte}
      />
    </div>
  );
}
