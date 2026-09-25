import "server-only";
import type { PaymentMethodOwnership } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AUTO_IMPORT_CREATOR_LABEL } from "@/lib/cash";
import { emptyCurrencyTotals, type Currency, type CurrencyTotals } from "@/lib/currency";
import { phoneVariants } from "@/lib/whatsapp/phone";

/**
 * Cuenta corriente genérica para una cuenta ajena (proveedor o asociado) —
 * usada por `providers.ts` y `associates.ts`, que solo fijan `ownership`.
 * Mismo mecanismo para los dos: `debt` (alguien pagó/hizo algo que le
 * correspondía a la empresa, sin que se le devuelva en el momento) suma al
 * saldo; `income` (el cliente le pagó directo) y `expense` (la empresa le
 * pagó) lo saldan. Positivo = le debemos; negativo = a favor nuestro.
 */
export type ThirdPartyBalance = {
  id: string;
  name: string;
  balance: CurrencyTotals;
  /** Otras cuentas reales de esta misma entidad (ver `PaymentMethod.parentId`)
   *  — para poder elegir por cuál cargar un movimiento puntual sin perder esa
   *  info, aunque el saldo ya viene sumado entre todas. */
  subaccounts: { id: string; name: string }[];
  /** Conversación de WhatsApp encontrada para `PaymentMethod.whatsappPhone`
   *  (cruce best-effort por teléfono) — null si no hay teléfono cargado, o si
   *  todavía no existe ninguna conversación con ese número. */
  whatsappConversationId: string | null;
};

/** Solo dígitos, para comparar dos teléfonos sin importar "+"/espacios/guiones. */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Resuelve cada teléfono de `PaymentMethod.whatsappPhone` a la conversación
 * de WhatsApp existente que más probablemente sea esa persona — mismo cruce
 * best-effort que `findRelatedRentals` (Rental↔Customer), reusando
 * `phoneVariants` para tolerar cómo se haya tipeado el número acá vs. el
 * E.164 real que manda Meta.
 */
async function resolveWhatsappConversationIds(phones: (string | null)[]): Promise<Map<string, string>> {
  const withPhone = [...new Set(phones.filter((p): p is string => Boolean(p)))];
  if (withPhone.length === 0) return new Map();

  const conversations = await prisma.whatsAppConversation.findMany({ select: { id: true, phoneE164: true } });
  const byDigits = new Map(conversations.map((c) => [digitsOnly(c.phoneE164), c.id]));

  const result = new Map<string, string>();
  for (const phone of withPhone) {
    const match = phoneVariants(phone)
      .map(digitsOnly)
      .map((d) => byDigits.get(d))
      .find((id): id is string => Boolean(id));
    if (match) result.set(phone, match);
  }
  return result;
}

/**
 * Mapa cuenta → cuenta principal del grupo (una cuenta principal se mapea a
 * sí misma). Varias cuentas reales de la misma entidad (`PaymentMethod.parentId`)
 * se agrupan bajo su principal para que los cálculos no queden partidos por
 * cuenta — ver comentario en el schema. Exportada: también la reusa
 * `getOwnAccountBalances` (`cash.ts`) para el mismo agrupado, con
 * `ownership: "own"`.
 */
export async function resolveToPrincipal(ownership: PaymentMethodOwnership): Promise<{
  principals: {
    id: string;
    name: string;
    whatsappPhone: string | null;
    subaccounts: { id: string; name: string }[];
    // Ajuste manual de saldo (solo tiene sentido en `own`, ver comentario en
    // el schema) — 0 en cualquier otra cuenta.
    balanceAdjustment: CurrencyTotals;
  }[];
  resolve: Map<string, string>;
  memberIds: string[];
}> {
  const accounts = await prisma.paymentMethod.findMany({
    where: { ownership },
    orderBy: { ordering: "asc" },
    select: {
      id: true,
      name: true,
      parentId: true,
      active: true,
      whatsappPhone: true,
      balanceAdjustmentArs: true,
      balanceAdjustmentUsd: true,
    },
  });
  const resolve = new Map<string, string>();
  for (const a of accounts) resolve.set(a.id, a.parentId ?? a.id);
  const principals = accounts
    .filter((a) => a.parentId === null && a.active)
    .map((p) => ({
      id: p.id,
      name: p.name,
      whatsappPhone: p.whatsappPhone,
      subaccounts: accounts.filter((a) => a.parentId === p.id).map((a) => ({ id: a.id, name: a.name })),
      balanceAdjustment: { ars: Number(p.balanceAdjustmentArs), usd: Number(p.balanceAdjustmentUsd) },
    }));
  return { principals, resolve, memberIds: accounts.map((a) => a.id) };
}

/**
 * Saldo de cuenta corriente de cada cuenta ajena de este `ownership`, solo
 * cuentas principales (las subcuentas se suman ahí), histórico completo — es
 * "cuánto se debe hoy", no un corte por período. Info operativa, visible para
 * cualquier rol.
 */
export async function getThirdPartyBalances(ownership: PaymentMethodOwnership): Promise<ThirdPartyBalance[]> {
  const { principals, resolve, memberIds } = await resolveToPrincipal(ownership);
  if (principals.length === 0) return [];

  const [debts, clientPayments, companyPayments] = await Promise.all([
    prisma.cashMovement.groupBy({
      by: ["recipientPaymentMethodId", "currency"],
      where: { type: "debt", deletedAt: null, recipientPaymentMethodId: { in: memberIds } },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["paymentMethodId", "currency"],
      where: { type: "income", deletedAt: null, paymentMethodId: { in: memberIds } },
      _sum: { amount: true },
    }),
    prisma.cashMovement.groupBy({
      by: ["recipientPaymentMethodId", "currency"],
      where: { type: "expense", deletedAt: null, recipientPaymentMethodId: { in: memberIds } },
      _sum: { amount: true },
    }),
  ]);

  const balances = new Map(principals.map((p) => [p.id, emptyCurrencyTotals()]));
  for (const row of debts) {
    const principalId = row.recipientPaymentMethodId && resolve.get(row.recipientPaymentMethodId);
    const totals = principalId && balances.get(principalId);
    if (totals) totals[row.currency] += Number(row._sum.amount ?? 0);
  }
  for (const row of clientPayments) {
    const principalId = row.paymentMethodId && resolve.get(row.paymentMethodId);
    const totals = principalId && balances.get(principalId);
    if (totals) totals[row.currency] -= Number(row._sum.amount ?? 0);
  }
  for (const row of companyPayments) {
    const principalId = row.recipientPaymentMethodId && resolve.get(row.recipientPaymentMethodId);
    const totals = principalId && balances.get(principalId);
    if (totals) totals[row.currency] -= Number(row._sum.amount ?? 0);
  }

  const conversationByPhone = await resolveWhatsappConversationIds(principals.map((p) => p.whatsappPhone));

  return principals.map((p) => ({
    id: p.id,
    name: p.name,
    balance: balances.get(p.id)!,
    subaccounts: p.subaccounts,
    whatsappConversationId: p.whatsappPhone ? (conversationByPhone.get(p.whatsappPhone) ?? null) : null,
  }));
}

export type ThirdPartyLedgerRow = {
  id: string;
  // "debt" suma al saldo (le debemos más); los otros dos lo saldan.
  kind: "debt" | "client_payment" | "company_payment";
  description: string;
  amount: number;
  currency: Currency;
  // Nombre de la cuenta real usada (puede ser una subcuenta) — se muestra
  // solo cuando difiere de la principal.
  accountName: string;
  // Id de esa cuenta real (principal o subcuenta) — valor inicial del
  // selector "Cuenta" al editar un Pago/Deuda (ver `updateAccountMovement`).
  accountId: string | null;
  createdByName: string;
  createdAt: Date;
  rentalId: string | null;
  rentalClientName: string | null;
  // Origen del "company_payment" (de qué cuenta propia/ajena salió la
  // plata) — null en "debt" (no tiene) y en "client_payment" (el medio ES
  // la cuenta ajena, no un origen distinto). Solo se usa al editar un "Pago"
  // o al convertirlo desde/hacia "Deuda" (ver `updateAccountMovement`).
  originId: string | null;
  originName: string | null;
  originNote: string | null;
  // Última edición real (no borrado) de este movimiento, si tiene — se
  // muestra en el lugar mismo del movimiento (ver `AccountMovementRow`).
  lastEditedByName: string | null;
  lastEditedAt: Date | null;
};

/**
 * Historial completo de una cuenta ajena — principal + todas sus subcuentas
 * (deudas + los dos tipos de pago que las saldan), más reciente primero. Trae
 * TODO el histórico sin acotar por mes — la UI decide cuánto mostrar de
 * entrada (ver `filterThisMonth`/`groupProviderLedgerByMonth`).
 */
export async function getThirdPartyLedger(accountId: string): Promise<ThirdPartyLedgerRow[]> {
  const members = await prisma.paymentMethod.findMany({
    where: { OR: [{ id: accountId }, { parentId: accountId }] },
    select: { id: true },
  });
  const memberIds = members.map((m) => m.id);

  const rows = await prisma.cashMovement.findMany({
    where: {
      deletedAt: null,
      OR: [
        { type: "debt", recipientPaymentMethodId: { in: memberIds } },
        { type: "income", paymentMethodId: { in: memberIds } },
        { type: "expense", recipientPaymentMethodId: { in: memberIds } },
      ],
    },
    include: {
      rental: { select: { clientName: true } },
      edits: {
        where: { action: "updated" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.type === "debt" ? "debt" : r.type === "income" ? "client_payment" : "company_payment",
    description: r.description,
    amount: Number(r.amount),
    currency: r.currency,
    accountName: (r.type === "income" ? r.paymentMethodName : r.recipientPaymentMethodName) ?? "",
    accountId: r.type === "income" ? r.paymentMethodId : r.recipientPaymentMethodId,
    createdByName: r.createdByName ?? AUTO_IMPORT_CREATOR_LABEL,
    createdAt: r.createdAt,
    rentalId: r.rentalId,
    rentalClientName: r.rental?.clientName ?? null,
    originId: r.type === "expense" ? r.paymentMethodId : null,
    originName: r.type === "expense" ? r.paymentMethodName : null,
    originNote: r.type === "expense" ? r.paymentMethodNote : null,
    lastEditedByName: r.edits[0]?.editedByName ?? null,
    lastEditedAt: r.edits[0]?.createdAt ?? null,
  }));
}
