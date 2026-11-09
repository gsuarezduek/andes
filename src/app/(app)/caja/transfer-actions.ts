"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { hasFinanceAccess } from "@/lib/user-permissions";
import { displayName } from "@/lib/user-display";
import { SAFE_ACCOUNT_ID, SAFE_ACCOUNT_NAME } from "@/lib/account-transfers";

const createSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  fromAmount: z.coerce.number().positive(),
  fromCurrency: z.enum(["ars", "usd", "btc"]),
  toCurrency: z.enum(["ars", "usd", "btc"]),
  // Solo se completa con monedas distintas; con la misma moneda entra lo mismo que sale.
  toAmount: z.coerce.number().positive().optional(),
  description: z.string().trim().max(500).default(""),
});

export type TransferResult = { error?: string; ok?: boolean };

/**
 * Traspaso entre dos cuentas propias (Saldos) — ni ingreso ni egreso, solo
 * mueve saldo. Solo admin, igual que Saldos. La Caja fuerte también puede ser
 * origen o destino (id `SAFE_ACCOUNT_ID`, se guarda como cuenta nula). Con la misma moneda entra lo
 * mismo que sale; con monedas distintas (ARS ↔ USD) el form manda los dos
 * montos. Una cuenta Bitcoin (`isBitcoin`) siempre va en BTC y cualquier otra
 * nunca: comprar o vender BTC es un cambio de moneda más. Devuelve `{error}` en vez de tirar excepción (Next redacta el
 * mensaje de un `throw` en producción).
 */
export async function createAccountTransfer(_prev: TransferResult, formData: FormData): Promise<TransferResult> {
  const user = await requireAdmin();
  const parsed = createSchema.safeParse({
    fromAccountId: formData.get("fromAccountId"),
    toAccountId: formData.get("toAccountId"),
    fromAmount: formData.get("fromAmount"),
    fromCurrency: formData.get("fromCurrency"),
    toCurrency: formData.get("toCurrency"),
    toAmount: formData.get("toAmount") || undefined,
    description: formData.get("description") ?? "",
  });
  if (!parsed.success) return { error: "Revisá los datos: elegí las dos cuentas y un monto mayor a cero." };
  const d = parsed.data;

  if (d.fromAccountId === d.toAccountId && d.fromCurrency === d.toCurrency) {
    return { error: "El origen y el destino son la misma cuenta." };
  }
  const sameCurrency = d.fromCurrency === d.toCurrency;
  if (!sameCurrency && d.toAmount == null) return { error: "Indicá cuánto entra en la cuenta destino." };
  const toAmount = sameCurrency ? d.fromAmount : d.toAmount!;

  const fromIsSafe = d.fromAccountId === SAFE_ACCOUNT_ID;
  const toIsSafe = d.toAccountId === SAFE_ACCOUNT_ID;
  if (fromIsSafe && toIsSafe && sameCurrency) return { error: "El origen y el destino son la misma cuenta." };

  const accounts = await prisma.paymentMethod.findMany({
    where: { id: { in: [d.fromAccountId, d.toAccountId] } },
    select: { id: true, name: true, ownership: true, isBitcoin: true, parent: { select: { isBitcoin: true } } },
  });
  const from = fromIsSafe ? null : accounts.find((a) => a.id === d.fromAccountId);
  const to = toIsSafe ? null : accounts.find((a) => a.id === d.toAccountId);
  if (from === undefined || to === undefined) return { error: "No se encontró alguna de las cuentas." };
  if ((from && from.ownership !== "own") || (to && to.ownership !== "own")) {
    return { error: "Solo se puede mover saldo entre cuentas propias y la Caja fuerte." };
  }
  // Una subcuenta de una cuenta Bitcoin también es Bitcoin.
  const isBitcoin = (a: typeof from) => !!a && (a.isBitcoin || !!a.parent?.isBitcoin);
  if (isBitcoin(from) !== (d.fromCurrency === "btc") || isBitcoin(to) !== (d.toCurrency === "btc")) {
    return { error: "Una cuenta Bitcoin se mueve siempre en BTC, y las demás cuentas nunca en BTC." };
  }
  // BTC admite 8 decimales (satoshis); pesos y dólares, 2.
  const round = (n: number, currency: string) =>
    currency === "btc" ? Math.round(n * 1e8) / 1e8 : Math.round(n * 100) / 100;
  const fromAmount = round(d.fromAmount, d.fromCurrency);
  const finalToAmount = round(toAmount, d.toCurrency);
  if (fromAmount <= 0 || finalToAmount <= 0) return { error: "El monto tiene que ser mayor a cero." };

  await prisma.accountTransfer.create({
    data: {
      fromAccountId: from?.id ?? null,
      fromAccountName: from?.name ?? SAFE_ACCOUNT_NAME,
      fromAmount,
      fromCurrency: d.fromCurrency,
      toAccountId: to?.id ?? null,
      toAccountName: to?.name ?? SAFE_ACCOUNT_NAME,
      toAmount: finalToAmount,
      toCurrency: d.toCurrency,
      description: d.description,
      createdByName: displayName(user),
    },
  });

  revalidatePath("/caja");
  revalidatePath("/caja/saldos/[id]", "page");
  return { ok: true };
}

/**
 * Elimina un traspaso mal cargado (soft delete, con motivo obligatorio). No
 * se edita: si está mal, se elimina y se vuelve a cargar — mismo criterio que
 * el resto de Caja.
 */
export async function deleteAccountTransfer(id: string, formData: FormData) {
  const user = await requireAdmin();
  const note = z.string().trim().min(1).max(300).parse(formData.get("note"));

  const existing = await prisma.accountTransfer.findUnique({
    where: { id },
    include: { fromAccount: { select: { financeOnly: true } }, toAccount: { select: { financeOnly: true } } },
  });
  if (!existing || existing.deletedAt) throw new Error("Traspaso no encontrado");
  // Un traspaso que toca una cuenta de Finanzas cambia su saldo: solo lo
  // elimina quien puede verla (en la lista ni aparece el botón).
  if ((existing.fromAccount?.financeOnly || existing.toAccount?.financeOnly) && !hasFinanceAccess(user.role, user.owner)) {
    throw new Error("Este traspaso involucra una cuenta reservada a Finanzas.");
  }

  await prisma.accountTransfer.update({
    where: { id },
    data: { deletedAt: new Date(), deletedByName: displayName(user), deleteNote: note },
  });

  revalidatePath("/caja");
  revalidatePath("/caja/saldos/[id]", "page");
}
