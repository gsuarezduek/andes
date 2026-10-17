import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  currentMonth,
  getCashPeriodDetail,
  getDeletedCashMovements,
  getCashSearchIndex,
  getGuarantees,
  getInvoicing,
  getOwnAccountBalances,
  getOwnCashMovements,
  getRentalPickerOptions,
  getRoomBookingPickerOptions,
  getTotalOwnBalanceHistory,
  getUnconfirmedCashMovements,
  getUnpaidFinishedRentals,
  parseCashPeriod,
} from "@/lib/cash";
import { getInvoices } from "@/lib/invoices";
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
import { InvoicingSection } from "@/components/cash/invoicing-section";
import { CajaTabs } from "@/components/cash/caja-tabs";
import { UsdRateBadge } from "@/components/cash/usd-rate-badge";
import { TransferLauncher, type TransferAccountOption } from "@/components/cash/transfer-launcher";
import { getCurrentUsdRate } from "@/lib/usd-rate-queries";
import { getAccountTransfers } from "@/lib/account-transfers-queries";
import { SAFE_ACCOUNT_ID, SAFE_ACCOUNT_NAME } from "@/lib/account-transfers";
import { emptyCurrencyTotals, type CurrencyTotals } from "@/lib/currency";
import {
  parseBalanceHistoryPeriod,
  parseBalanceHistoryGranularity,
  resolveBalanceHistoryGranularity,
} from "@/lib/balance-history";

export const metadata: Metadata = { title: "Caja — Andes" };

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string; balPeriod?: string; balGranularity?: string }>;
}) {
  const user = await requireUser();
  const {
    period: rawPeriod,
    from: rawFrom,
    to: rawTo,
    balPeriod: rawBalPeriod,
    balGranularity: rawBalGranularity,
  } = await searchParams;
  const period = parseCashPeriod(rawPeriod, rawFrom, rawTo);
  const balPeriod = parseBalanceHistoryPeriod(rawBalPeriod);
  const balGranularity = resolveBalanceHistoryGranularity(balPeriod, parseBalanceHistoryGranularity(rawBalGranularity));

  const [paymentMethods, expenseCategories, rentalOptions, roomBookingOptions] = await Promise.all([
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
    getRoomBookingPickerOptions(),
  ]);

  const isAdmin = user.role === "admin";
  const periodDetail = await getCashPeriodDetail(period);

  const movimientos = (
    <div className="flex flex-col gap-5">
      <CashMovementSearch
        index={await getCashSearchIndex(isAdmin)}
        paymentMethods={paymentMethods}
        expenseCategories={expenseCategories}
      />

      <MovementLauncher
        paymentMethods={paymentMethods}
        rentalOptions={rentalOptions}
        roomBookingOptions={roomBookingOptions}
        expenseCategories={expenseCategories}
      />

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
              solo entre "Mis movimientos" (más abajo). Ambas listas son
              editables/eliminables igual que la vista admin. */}
          <IncomesBoard
            incomes={periodDetail.incomes}
            totalIncome={periodDetail.totalIncome}
            period={period}
            paymentMethods={paymentMethods}
            expenseCategories={expenseCategories}
          />
          <CashOwnList
            items={await getOwnCashMovements(user.id, currentMonth())}
            paymentMethods={paymentMethods}
            expenseCategories={expenseCategories}
          />
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
  const accounts = isAdmin ? await getOwnAccountBalances() : [];
  const safeBalance = isAdmin ? await getSafeBalance() : emptyCurrencyTotals();
  const totalBalanceHistory = isAdmin ? await getTotalOwnBalanceHistory(balPeriod, balGranularity) : [];

  // "Mover entre cuentas" vive en el header (al lado del valor del USD), no
  // dentro de la pestaña Saldos — las cuentas elegibles como origen/destino
  // (principales + subcuentas + Caja fuerte) y el saldo de cada principal
  // (para avisar si un traspaso dejaría el origen en negativo) se calculan
  // acá en vez de en `AccountsSection`.
  const transferOptions: TransferAccountOption[] = accounts.flatMap((a) => [
    { id: a.id, name: a.name, principalId: a.id },
    ...a.subaccounts.map((s) => ({ id: s.id, name: `${a.name} · ${s.name}`, principalId: a.id })),
  ]);
  if (isAdmin) transferOptions.push({ id: SAFE_ACCOUNT_ID, name: SAFE_ACCOUNT_NAME, principalId: SAFE_ACCOUNT_ID });
  const transferBalances: Record<string, CurrencyTotals> = {
    ...Object.fromEntries(accounts.map((a) => [a.id, a.balance])),
    [SAFE_ACCOUNT_ID]: safeBalance,
  };

  const saldos = isAdmin ? (
    <AccountsSection
      safeBalance={safeBalance}
      safeMonthIncome={safeMonthActivity!.income}
      safeMonthExpense={safeMonthActivity!.expense}
      accounts={accounts}
      transfers={await getAccountTransfers({ limit: 10 })}
      totalBalanceHistory={totalBalanceHistory}
      balPeriod={balPeriod}
      balGranularity={balGranularity}
    />
  ) : undefined;

  // Garantías/depósitos (ver `RentalPayment.isGuarantee`) — visibles y
  // operables (devolver/cobrar/eliminar una cargada por error/editar sus
  // movimientos derivados) para cualquier rol.
  const garantias = (
    <GuaranteesSection
      guarantees={await getGuarantees()}
      paymentMethods={paymentMethods}
      expenseCategories={expenseCategories}
    />
  );

  // Facturación (ver `needsInvoice`/modelo `Invoice`) — visible para
  // cualquier rol, mismo criterio que Garantías.
  const facturacion = <InvoicingSection invoicing={await getInvoicing()} invoices={await getInvoices()} />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
          <p className="text-sm text-foreground/60">Registrá ingresos y egresos de las reservas.</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <UsdRateBadge current={usdRate} canEdit={isAdmin} />
          {isAdmin && (
            <TransferLauncher accounts={transferOptions} balances={transferBalances} usdRate={usdRate?.rate ?? null} />
          )}
        </div>
      </div>

      <UnpaidFinishedRentalsSection rentals={await getUnpaidFinishedRentals()} />

      <CajaTabs
        movimientos={movimientos}
        asociados={asociados}
        proveedores={proveedores}
        garantias={garantias}
        facturacion={facturacion}
        saldos={saldos}
      />
    </div>
  );
}
