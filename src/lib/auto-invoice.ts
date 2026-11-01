import "server-only";
import type { Prisma } from "@prisma/client";
import { autoInvoiceDecision } from "@/lib/invoicing-rules";

type Tx = Prisma.TransactionClient;

/**
 * Deja la marca "va a Facturación" de un ingreso en el estado que corresponde
 * según su cuenta (`PaymentMethod.autoInvoice`): la prende si la cuenta
 * factura sola, y la apaga si había entrado solo por la cuenta y ya no
 * corresponde (se cambió a otra cuenta). Nunca toca un ingreso ya facturado,
 * ni uno que pidió el cliente o se agregó a mano. Idempotente. Se llama en los
 * mismos puntos que `syncCommission` (alta, cambio de cuenta, confirmación del
 * medio de un importado), dentro de la transacción del llamador.
 */
export async function syncAutoInvoice(tx: Tx, movementId: string): Promise<void> {
  const m = await tx.cashMovement.findUnique({
    where: { id: movementId },
    include: { paymentMethod: { select: { autoInvoice: true, ownership: true } } },
  });
  if (!m) return;

  const decision = autoInvoiceDecision({
    type: m.type,
    deleted: m.deletedAt != null,
    isGuarantee: m.isGuarantee,
    fromGuarantee: m.guaranteeSourceId != null,
    needsConfirmation: m.needsConfirmation,
    accountAutoInvoice: m.paymentMethod?.ownership === "own" && m.paymentMethod.autoInvoice,
    needsInvoice: m.needsInvoice,
    invoiceAuto: m.invoiceAuto,
    invoiced: m.invoicedAt != null,
  });
  if (decision === "add") {
    await tx.cashMovement.update({ where: { id: m.id }, data: { needsInvoice: true, invoiceAuto: true } });
  } else if (decision === "remove") {
    await tx.cashMovement.update({ where: { id: m.id }, data: { needsInvoice: false, invoiceAuto: false } });
  }
}
