import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  currentMonth,
  getCashPeriodDetail,
  getDeletedCashMovements,
  getCashSearchIndex,
  getGuarantees,
  getOwnAccountBalances,
  getOwnCashMovements,
  getRentalPickerOptions,
  getUnconfirmedCashMovements,
  getUnpaidFinishedRentals,
  parseCashPeriod,
} from "@/lib/cash";
import { getSafeBalance, getSafeMonthActivity } from "@/lib/safe";
import { getProviderBalances } from "@/lib/providers";
import { getAssociateBalances } from "@/lib/associates";
import { MovementLauncher } from "@/components/cash/movement-launcher";
import { CashMovementSearch } from "@/components/cash/cash-movement-search";
import { CashPeriodDetail } from "@/components/cash/cash-period-detail";
import { IncomesBoard } from "@/components/cash/incomes-board";
import { CashOwnList } from "@/components/cash/cash-own-list";
import { UnpaidFinishedRentalsSection } from "@/components/cash/unpaid-finished-rentals-section";
import { UnconfirmedIncomesSection } from "@/components/cash/unconfirmed-incomes-section";
import { ProvidersSection } from "@/components/cash/providers-section";
import { AssociatesSection } from "@/components/cash/associates-section";
import { AccountsSection } from "@/components/cash/accounts-section";
import { GuaranteesSection } from "@/components/cash/guarantees-section";
import { CajaTabs } from "@/components/cash/caja-tabs";
import { UsdRateBadge } from "@/components/cash/usd-rate-badge";
import { getCurrentUsdRate } from "@/lib/usd-rate-queries";
import { getAccountTransfers } from "@/lib/account-transfers-queries";

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
      <CashMovementSearch
        index={await getCashSearchIndex(isAdmin)}
        paymentMethods={paymentMethods}
        expenseCategories={expenseCategories}
        canEdit={isAdmin}
      />

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
  // cualquiera puede necesitarlo. El historial de cada uno vive en su propia
  // página (`/caja/proveedores/[id]` y `/caja/asociados/[id]`) — acá solo
  // hace falta el saldo, sin el N+1 de traer el ledger completo de cada uno.
  const proveedores = <ProvidersSection providers={await getProviderBalances()} paymentMethods={paymentMethods} />;
  const asociados = <AssociatesSection associates={await getAssociateBalances()} paymentMethods={paymentMethods} />;

  // Saldo por cuenta propia — igual que la Caja fuerte (que ahora se muestra
  // acá mismo, como una tarjeta más — ver `AccountsSection`, v44), es la
  // posición de plata real de la empresa, así que solo se calcula/pasa para
  // admin (ver comentario en `CajaTabs`). El historial de cada una vive en
  // `/caja/saldos/[id]` (o `/caja/saldos/caja-fuerte`).
  const usdRate = await getCurrentUsdRate();
  const safeMonthActivity = isAdmin ? await getSafeMonthActivity() : null;
  const saldos = isAdmin ? (
    <AccountsSection
      safeBalance={await getSafeBalance()}
      safeMonthIncome={safeMonthActivity!.income}
      safeMonthExpense={safeMonthActivity!.expense}
      accounts={await getOwnAccountBalances()}
      transfers={await getAccountTransfers({ limit: 10 })}
      usdRate={usdRate?.rate ?? null}
    />
  ) : undefined;

  // Garantías/depósitos (ver `RentalPayment.isGuarantee`) — visibles y
  // operables (devolver/cobrar) para cualquier rol; eliminar una cargada por
  // error y editar sus movimientos derivados siguen siendo solo admin.
  const garantias = (
    <GuaranteesSection
      guarantees={await getGuarantees()}
      paymentMethods={paymentMethods}
      expenseCategories={expenseCategories}
      isAdmin={isAdmin}
    />
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
          <p className="text-sm text-foreground/60">Registrá ingresos y egresos de las reservas.</p>
        </div>
        <UsdRateBadge current={usdRate} canEdit={isAdmin} />
      </div>

      <UnpaidFinishedRentalsSection rentals={await getUnpaidFinishedRentals()} />

      <CajaTabs
        movimientos={movimientos}
        asociados={asociados}
        proveedores={proveedores}
        garantias={garantias}
        saldos={saldos}
      />
    </div>
  );
}
