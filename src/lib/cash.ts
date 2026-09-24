import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDateInput } from "@/lib/datetime";
import type { RentalPayment } from "@/lib/contract";
import type { FieldChange } from "@/lib/movement-audit";
import { monthRangeUtc, resolveCashPeriod, type CashPeriod } from "@/lib/cash-period";
import { getLegacySafeBalance } from "@/lib/safe";
import { resolveToPrincipal } from "@/lib/third-party-accounts";
import { applyTransfersToBalances, walletDeltaFromTransfers } from "@/lib/account-transfers";
import { emptyCurrencyTotals, sumByCurrency, type Currency, type CurrencyTotals } from "@/lib/currency";
import { vehicleDisplayName } from "@/lib/vehicle-ui";

// El tipo/las constantes/las funciones puras del filtro de fecha (Hoy/Semana/
// Mes/fecha puntual) viven en `cash-period.ts`, sin "server-only" — así el
// client component que dibuja el selector (`cash-period-picker.tsx`) puede
// importarlas sin arrastrar Prisma. Re-exportadas acá para no tener que
// cambiar los imports del resto del código de servidor (page.tsx, etc.).
export {
  monthRangeUtc,
  mondayOf,
  resolveCashPeriod,
  parseCashPeriod,
  cashPeriodSearch,
  DEFAULT_CASH_PERIOD,
  CASH_PERIOD_OPTIONS,
  type CashPeriod,
} from "@/lib/cash-period";

function monthOf(date: Date): string {
  return formatDateInput(date).slice(0, 7);
}

/**
 * `createdById` nulo en un CashMovement solo pasa por un único camino: el
 * import automático de la seña desde VikRentCar (`importBookingPayment` en
 * `sync/booking-upsert.ts`, el único `cashMovement.create` del código que no
 * pasa `createdById`). Nunca es "no sabemos quién lo cargó" — mostrar esto en
 * vez de un "—" ambiguo evita que se lea como un dato faltante.
 */
export const AUTO_IMPORT_CREATOR_LABEL = "Web (VikRentCar)";

export function currentMonth(): string {
  return monthOf(new Date());
}

export type CashMovementRow = {
  id: string;
  type: "income" | "expense";
  description: string;
  amount: number;
  currency: Currency;
  paymentMethodId: string | null;
  paymentMethodName: string;
  paymentMethodNote: string | null;
  // Destino de un Egreso: cuenta ajena a la que se le pagó. Opcional — no
  // todo egreso tiene una cuenta ajena puntual. No se usa en Ingresos.
  recipientPaymentMethodId: string | null;
  recipientPaymentMethodName: string | null;
  recipientPaymentMethodNote: string | null;
  // Categoría opcional de un Egreso (ver `CashMovementCategory`) — siempre
  // null en un Ingreso.
  categoryId: string | null;
  categoryName: string | null;
  // Importado automático desde VikRentCar sin poder resolver el medio de pago
  // real — falta que alguien lo confirme (ver `confirmCashMovementPaymentMethod`).
  needsConfirmation: boolean;
  // Egreso generado solo por la comisión de un ingreso (ver
  // `PaymentMethod.commissionPercent`) — se muestra con una marca en el detalle.
  isCommission: boolean;
  rentalId: string | null;
  rentalClientName: string | null;
  // Nº de orden de VikRentCar de la reserva vinculada (si tiene) — para poder
  // buscar un movimiento por número de reserva (ver `getCashSearchIndex`).
  rentalBookingId: string | null;
  createdByName: string;
  createdAt: Date;
  // Última edición real (no borrado) de este movimiento, si tiene — se
  // muestra en el lugar mismo donde se ve el movimiento (no en una sección
  // aparte, ver `MovementMetaLine`).
  lastEditedByName: string | null;
  lastEditedAt: Date | null;
  // Ciclo de vida de una garantía (ver comentario en el schema) — solo
  // tienen sentido en la fila que la tomó (`isGuarantee && type === "income"`);
  // en cualquier otra fila quedan todos `null`. `guaranteeResolvedAt` nulo =
  // todavía activa.
  guaranteeResolvedAt: Date | null;
  guaranteeChargedAmount: number | null;
  guaranteeReturnedAmount: number | null;
  guaranteeResolvedByName: string | null;
};

export type CashPeriodDetail = {
  periodLabel: string;
  incomes: CashMovementRow[];
  expenses: CashMovementRow[];
  // Totales separados por moneda — nunca sumados entre sí (ver `src/lib/currency.ts`).
  totalIncome: CurrencyTotals;
  totalExpense: CurrencyTotals;
  net: CurrencyTotals;
};

// Selección compartida entre `findMovements` y `getGuarantees` (esta última
// no puede reusar `findMovements` tal cual para traer los movimientos
// derivados de una garantía — ver más abajo — porque esos mezclan
// `isGuarantee` true/false, y `findMovements` fuerza uno de los dos).
const MOVEMENT_INCLUDE = {
  rental: { select: { clientName: true, wpBookingId: true } },
  edits: { where: { action: "updated" as const }, orderBy: { createdAt: "desc" as const }, take: 1 },
} satisfies Prisma.CashMovementInclude;

type RawMovement = Prisma.CashMovementGetPayload<{ include: typeof MOVEMENT_INCLUDE }>;

function toCashMovementRow(r: RawMovement): CashMovementRow {
  return {
    id: r.id,
    type: r.type as "income" | "expense",
    description: r.description,
    amount: Number(r.amount),
    currency: r.currency,
    paymentMethodId: r.paymentMethodId,
    paymentMethodName: r.paymentMethodName,
    paymentMethodNote: r.paymentMethodNote,
    recipientPaymentMethodId: r.recipientPaymentMethodId,
    recipientPaymentMethodName: r.recipientPaymentMethodName,
    recipientPaymentMethodNote: r.recipientPaymentMethodNote,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    needsConfirmation: r.needsConfirmation,
    isCommission: r.commissionSourceId != null,
    rentalId: r.rentalId,
    rentalClientName: r.rental?.clientName ?? null,
    rentalBookingId: r.rental?.wpBookingId != null ? String(r.rental.wpBookingId) : null,
    createdByName: r.createdByName ?? AUTO_IMPORT_CREATOR_LABEL,
    createdAt: r.createdAt,
    lastEditedByName: r.edits[0]?.editedByName ?? null,
    lastEditedAt: r.edits[0]?.createdAt ?? null,
    guaranteeResolvedAt: r.guaranteeResolvedAt,
    guaranteeChargedAmount: r.guaranteeChargedAmount != null ? Number(r.guaranteeChargedAmount) : null,
    guaranteeReturnedAmount: r.guaranteeReturnedAmount != null ? Number(r.guaranteeReturnedAmount) : null,
    guaranteeResolvedByName: r.guaranteeResolvedByName,
  };
}

async function findMovements(
  where: Prisma.CashMovementWhereInput,
  opts?: { take?: number; guaranteeOnly?: boolean },
): Promise<CashMovementRow[]> {
  const rows = await prisma.cashMovement.findMany({
    // Nunca trae deudas de proveedor (`type: "debt"`) — esas viven en
    // `src/lib/providers.ts`, no son un ingreso/egreso de caja real todavía.
    // Tampoco mezcla Garantías con Movimientos reales (y viceversa, con
    // `guaranteeOnly`) — ver `getGuarantees` y el comentario de
    // `isGuarantee` en el schema.
    where: { type: { in: ["income", "expense"] }, isGuarantee: !!opts?.guaranteeOnly, ...where, deletedAt: null },
    include: MOVEMENT_INCLUDE,
    orderBy: { createdAt: "desc" },
    ...(opts?.take ? { take: opts.take } : {}),
  });
  return rows.map(toCashMovementRow);
}

/**
 * Ingresos importados automáticamente desde VikRentCar cuyo medio de pago no
 * se pudo resolver — independiente del período visible en Caja (no importa
 * cuándo llegó la seña: hasta que alguien lo confirme, sigue pendiente).
 */
export async function getUnconfirmedCashMovements(): Promise<CashMovementRow[]> {
  return findMovements({ needsConfirmation: true });
}

export async function getCashPeriodDetail(period: CashPeriod): Promise<CashPeriodDetail> {
  const { start, end, label } = resolveCashPeriod(period);
  const rows = await findMovements({ createdAt: { gte: start, lt: end } });

  const incomes = rows.filter((r) => r.type === "income");
  const expenses = rows.filter((r) => r.type === "expense");
  const totalIncome = sumByCurrency(incomes);
  const totalExpense = sumByCurrency(expenses);

  return {
    periodLabel: label,
    incomes,
    expenses,
    totalIncome,
    totalExpense,
    net: { ars: totalIncome.ars - totalExpense.ars, usd: totalIncome.usd - totalExpense.usd },
  };
}

export type GuaranteeHistoryEntry = CashMovementRow & {
  // Movimientos que generó resolverla (el ingreso por lo cobrado, el egreso
  // por lo devuelto — puede haber uno o los dos si el cobro fue parcial). Se
  // muestran con `MovementRow`, editables como cualquier otro movimiento.
  derived: CashMovementRow[];
};

export type Guarantees = {
  active: CashMovementRow[];
  // Suma de lo tomado en las garantías activas — "en poder de la empresa
  // hoy". Ya no es tomado-histórico menos devuelto-histórico (eso mezclaba
  // para siempre movimientos ya resueltos); una garantía resuelta sale de
  // acá y pasa a `history`.
  activeTotal: CurrencyTotals;
  history: GuaranteeHistoryEntry[];
};

/**
 * Garantías/depósitos (ver `RentalPayment.isGuarantee`): cada una es la fila
 * que la tomó (`type: income, isGuarantee: true`) — activa mientras
 * `guaranteeResolvedAt` sea null. Se resuelve con "Devolver" o "Cobrar"
 * (`caja/guarantee-actions.ts`, total o parcial) y ahí sale de "activas" y
 * pasa al historial, sin volver atrás — mismo criterio de "posición real de
 * la empresa" que Saldos/Caja fuerte, admin-only (ver `caja/page.tsx`).
 */
export async function getGuarantees(): Promise<Guarantees> {
  const [active, resolved] = await Promise.all([
    findMovements({ type: "income", guaranteeResolvedAt: null }, { guaranteeOnly: true }),
    findMovements({ type: "income", guaranteeResolvedAt: { not: null } }, { guaranteeOnly: true }),
  ]);

  // Movimientos que generó resolver cada garantía (el cobro, la devolución,
  // o ambos si fue parcial) — `isGuarantee` mezclado (true/false), así que
  // no puede salir de `findMovements` (fuerza uno de los dos).
  const rawDerived =
    resolved.length === 0
      ? []
      : await prisma.cashMovement.findMany({
          where: { guaranteeSourceId: { in: resolved.map((r) => r.id) }, deletedAt: null },
          include: MOVEMENT_INCLUDE,
          orderBy: { createdAt: "asc" },
        });
  const derivedByGuaranteeId = new Map<string, CashMovementRow[]>();
  for (const r of rawDerived) {
    const list = derivedByGuaranteeId.get(r.guaranteeSourceId!) ?? [];
    list.push(toCashMovementRow(r));
    derivedByGuaranteeId.set(r.guaranteeSourceId!, list);
  }

  return {
    active,
    activeTotal: sumByCurrency(active),
    history: resolved.map((g) => ({ ...g, derived: derivedByGuaranteeId.get(g.id) ?? [] })),
  };
}

export async function getOwnCashMovements(userId: string, month: string): Promise<CashMovementRow[]> {
  const { start, end } = monthRangeUtc(month);
  return findMovements({ createdById: userId, createdAt: { gte: start, lt: end } });
}

const SEARCH_INDEX_LIMIT = 500;

/**
 * Movimientos recientes (histórico, sin acotar al período visible de Caja)
 * para el buscador por cliente/N° de reserva/detalle — filtrado client-side
 * en `CashMovementSearch` (mismo patrón que `RentalPicker`/`PaymentMethodPicker`:
 * traer una lista acotada una vez, filtrar en el navegador mientras se
 * escribe). `includeExpenses` decide si entran los egresos — un empleado no
 * admin busca solo entre ingresos (misma restricción que el resto de Caja).
 */
export async function getCashSearchIndex(includeExpenses: boolean): Promise<CashMovementRow[]> {
  return findMovements(includeExpenses ? {} : { type: "income" }, { take: SEARCH_INDEX_LIMIT });
}

export type RentalPickerOption = {
  id: string;
  clientName: string;
  bookingId: string | null;
  plate: string | null;
  /** Apodo del vehículo (si tiene) — se puede buscar por él, igual que por patente. */
  vehicleName: string | null;
  label: string;
};

const RETURNED_VISIBILITY_DAYS = 5;

/**
 * Reservas candidatas para vincular a un movimiento de Caja: las que todavía
 * no se devolvieron (reserved/active) más las recién devueltas (finished),
 * ocultando las que ya pasaron `RETURNED_VISIBILITY_DAYS` días desde la
 * devolución. Orden: `updatedAt` desc — se actualiza al entregar y al
 * devolver (ver saveHandover/saveReturn), así que aproxima "últimos
 * entregados/devueltos primero" sin necesitar el timestamp real de la
 * inspección.
 */
export async function getRentalPickerOptions(): Promise<RentalPickerOption[]> {
  const returnedCutoff = new Date(Date.now() - RETURNED_VISIBILITY_DAYS * 24 * 60 * 60 * 1000);

  const rentals = await prisma.rental.findMany({
    where: {
      OR: [
        { status: { in: ["reserved", "active"] } },
        { status: "finished", updatedAt: { gte: returnedCutoff } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: 150,
    select: {
      id: true,
      clientName: true,
      startAt: true,
      wpBookingId: true,
      vehicle: { select: { plate: true, name: true, brand: true, model: true } },
    },
  });

  return rentals.map((r) => {
    const bookingId = r.wpBookingId != null ? String(r.wpBookingId) : null;
    return {
      id: r.id,
      clientName: r.clientName,
      bookingId,
      plate: r.vehicle?.plate ?? null,
      vehicleName: r.vehicle?.name ?? null,
      label: `${r.clientName} — ${r.vehicle ? vehicleDisplayName(r.vehicle) : "sin unidad"} (${formatDateInput(r.startAt)})${
        bookingId ? ` · #${bookingId}` : ""
      }`,
    };
  });
}

/**
 * Traduce las líneas de pago anotadas en la entrega/devolución (medio de pago
 * real, con % de ajuste y nota) a filas de `CashMovement` — un ingreso por
 * línea, vinculado a la reserva. Se usa dentro de la misma transacción de
 * `saveHandover`/`saveReturn` (ver esos archivos) para que la Caja quede al
 * día sin que el empleado tenga que anotarlo dos veces.
 */
export function paymentsToCashMovements(
  payments: RentalPayment[],
  opts: { rentalId: string; createdById: string; createdByName: string; description: string },
): Prisma.CashMovementCreateManyInput[] {
  // Ids generados acá (en vez de por la base) para que el llamador sepa qué
  // ingresos acaba de crear con un `createMany` (que no devuelve filas) y les
  // pueda generar su comisión — ver `syncCommission`.
  return payments.map((p) => ({
    id: randomUUID(),
    type: "income" as const,
    description: opts.description,
    amount: p.adjustedAmount,
    paymentMethodId: p.methodId ?? null,
    paymentMethodName: p.methodName,
    paymentMethodNote: p.note ?? null,
    needsConfirmation: p.unconfirmed ?? false,
    isGuarantee: p.isGuarantee ?? false,
    rentalId: opts.rentalId,
    createdById: opts.createdById,
    createdByName: opts.createdByName,
  }));
}

export type CashMovementFieldChange = FieldChange;

export type DeletedCashMovementRow = {
  id: string;
  reason: string;
  deletedByName: string;
  movementDescription: string;
  movementAmount: number;
  movementCurrency: Currency;
  movementType: "income" | "expense";
  createdAt: Date;
};

/**
 * Movimientos de Caja (Ingreso/Egreso) eliminados dentro del período visible
 * (por fecha del borrado). Solo borrados — una edición normal ya se muestra
 * en el lugar mismo del movimiento (ver `lastEditedByName`/`lastEditedAt` en
 * `CashMovementRow` y `MovementMetaLine`); un borrado, en cambio, hace
 * desaparecer la fila del listado, así que necesita este lugar aparte para
 * poder verlo. Excluye deudas de proveedor (`type: "debt"`) — esas viven en
 * la pestaña Cuentas corrientes, no acá.
 */
export async function getDeletedCashMovements(period: CashPeriod): Promise<DeletedCashMovementRow[]> {
  const { start, end } = resolveCashPeriod(period);
  const rows = await prisma.cashMovementEdit.findMany({
    where: {
      action: "deleted",
      createdAt: { gte: start, lt: end },
      cashMovement: { type: { in: ["income", "expense"] } },
    },
    include: {
      cashMovement: { select: { description: true, amount: true, currency: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => {
    const changes = (r.changes as CashMovementFieldChange[] | null) ?? null;
    return {
      id: r.id,
      reason: changes?.find((c) => c.field === "Motivo")?.to ?? "—",
      deletedByName: r.editedByName ?? "—",
      movementDescription: r.cashMovement.description,
      movementAmount: Number(r.cashMovement.amount),
      movementCurrency: r.cashMovement.currency,
      movementType: r.cashMovement.type as "income" | "expense",
      createdAt: r.createdAt,
    };
  });
}

/**
 * Saldo de "Billetera": efectivo físico en mano que todavía NO se depositó en
 * la caja fuerte. Histórico completo (no por período) — mismo criterio que
 * `getSafeBalance`, representa cuánto hay HOY, no un movimiento puntual.
 * Separado por moneda (un ingreso en efectivo puede ser ARS o USD).
 *
 * Billetera = (ingresos − egresos en Caja con un medio marcado `isCash`, más
 * los traspasos que entran/salen de esas cuentas) − el saldo de los
 * movimientos VIEJOS de la caja fuerte (`SafeMovement`, sin cuenta de origen:
 * antes se restaban de la Billetera directo). Los traspasos nuevos hacia/desde
 * la caja fuerte ya bajan/suben la cuenta de efectivo, así que NO se restan de
 * nuevo acá (sería contarlos dos veces) — ver `getLegacySafeBalance`.
 * Info sensible — solo para admin (mismo criterio que la Caja fuerte).
 */
export async function getWalletBalance(): Promise<CurrencyTotals> {
  const [income, expense, legacySafeBalance, transfers] = await Promise.all([
    prisma.cashMovement.groupBy({
      by: ["currency"],
      where: { type: "income", deletedAt: null, paymentMethod: { isCash: true } },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["currency"],
      where: { type: "expense", deletedAt: null, paymentMethod: { isCash: true } },
      _sum: { amount: true },
    }),
    getLegacySafeBalance(),
    prisma.accountTransfer.findMany({
      where: { deletedAt: null },
      include: { fromAccount: { select: { isCash: true } }, toAccount: { select: { isCash: true } } },
    }),
  ]);
  const totals = emptyCurrencyTotals();
  for (const row of income) totals[row.currency] += Number(row._sum.amount ?? 0);
  for (const row of expense) totals[row.currency] -= Number(row._sum.amount ?? 0);
  // Un traspaso que saca plata de una cuenta `isCash` (o la mete) también
  // mueve el efectivo en mano, aunque no sea ingreso ni egreso.
  const transferDelta = walletDeltaFromTransfers(
    transfers.map((t) => ({
      fromAccountId: t.fromAccountId,
      fromAmount: Number(t.fromAmount),
      fromCurrency: t.fromCurrency,
      toAccountId: t.toAccountId,
      toAmount: Number(t.toAmount),
      toCurrency: t.toCurrency,
      fromIsCash: t.fromAccount?.isCash ?? false,
      toIsCash: t.toAccount?.isCash ?? false,
    })),
  );
  return {
    ars: totals.ars + transferDelta.ars - legacySafeBalance.ars,
    usd: totals.usd + transferDelta.usd - legacySafeBalance.usd,
  };
}

export type OwnAccountBalance = {
  id: string;
  name: string;
  balance: CurrencyTotals;
  /** Otras cuentas reales de la misma entidad agrupadas acá (ver `PaymentMethod.parentId`). */
  subaccounts: { id: string; name: string }[];
};

/**
 * Saldo actual de cada cuenta propia (Efectivo, banco, Mercado Pago, etc.),
 * agrupado por cuenta principal — histórico completo, no por período: es
 * "cuánta plata entró y salió por esta cuenta desde siempre", no un corte
 * puntual. A diferencia de `getThirdPartyBalances`, acá no hace falta mirar
 * `recipientPaymentMethodId` ni el tipo `debt`: el Destino de un Egreso nunca
 * es una cuenta propia (ver `CashMovementForm`/`createCashMovement`), así que
 * solo entra plata por un Ingreso con esta cuenta como medio y sale por un
 * Egreso con esta cuenta como Origen. Distinto de la "Billetera"
 * (`getWalletBalance`): esto es el saldo de UNA cuenta puntual, no el
 * agregado de todas las marcadas `isCash` menos lo depositado en la caja
 * fuerte. Info sensible (posición de plata real) — solo para admin, mismo
 * criterio que la Caja fuerte y la Billetera.
 */
export async function getOwnAccountBalances(): Promise<OwnAccountBalance[]> {
  const { principals, resolve, memberIds } = await resolveToPrincipal("own");
  if (principals.length === 0) return [];

  const [income, expense, transfers] = await Promise.all([
    prisma.cashMovement.groupBy({
      by: ["paymentMethodId", "currency"],
      where: { type: "income", deletedAt: null, paymentMethodId: { in: memberIds } },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["paymentMethodId", "currency"],
      where: { type: "expense", deletedAt: null, paymentMethodId: { in: memberIds } },
      _sum: { amount: true },
    }),
    prisma.accountTransfer.findMany({ where: { deletedAt: null } }),
  ]);

  const balances = new Map(principals.map((p) => [p.id, emptyCurrencyTotals()]));
  for (const row of income) {
    const principalId = row.paymentMethodId && resolve.get(row.paymentMethodId);
    const totals = principalId && balances.get(principalId);
    if (totals) totals[row.currency] += Number(row._sum.amount ?? 0);
  }
  for (const row of expense) {
    const principalId = row.paymentMethodId && resolve.get(row.paymentMethodId);
    const totals = principalId && balances.get(principalId);
    if (totals) totals[row.currency] -= Number(row._sum.amount ?? 0);
  }
  // Traspasos entre cuentas: no son ingreso ni egreso, solo mueven saldo.
  applyTransfersToBalances(
    balances,
    resolve,
    transfers.map((t) => ({
      fromAccountId: t.fromAccountId,
      fromAmount: Number(t.fromAmount),
      fromCurrency: t.fromCurrency,
      toAccountId: t.toAccountId,
      toAmount: Number(t.toAmount),
      toCurrency: t.toCurrency,
    })),
  );

  return principals.map((p) => ({
    id: p.id,
    name: p.name,
    balance: balances.get(p.id)!,
    subaccounts: p.subaccounts,
  }));
}

/**
 * Historial completo de una cuenta propia — principal + sus subcuentas,
 * ingresos y egresos con esa cuenta como medio, más reciente primero. Mismo
 * criterio que `getThirdPartyLedger` pero reusando `findMovements` (ya
 * excluye `debt` y `deletedAt`).
 */
export async function getOwnAccountLedger(accountId: string): Promise<CashMovementRow[]> {
  const members = await prisma.paymentMethod.findMany({
    where: { OR: [{ id: accountId }, { parentId: accountId }] },
    select: { id: true },
  });
  return findMovements({ paymentMethodId: { in: members.map((m) => m.id) } });
}
