/**
 * Reglas puras de Caja → Facturación (sin Prisma, testeadas). Un ingreso está
 * en Facturación (`needsInvoice`) por alguno de estos motivos:
 *  - la cuenta donde entró factura sola (`PaymentMethod.autoInvoice`, ej.
 *    Mercado Pago, tarjetas, BBVA) → `invoiceAuto: true`;
 *  - el cliente pidió factura y dio sus datos (nombre/CUIT);
 *  - alguien lo agregó a mano (ej. desde una reserva ya entregada).
 * Es siempre un solo ítem: si además el cliente dio sus datos, se le factura a él.
 */

export type AutoInvoiceInput = {
  type: string;
  deleted: boolean;
  isGuarantee: boolean;
  /** Movimiento generado al resolver una garantía (`guaranteeSourceId`). */
  fromGuarantee: boolean;
  needsConfirmation: boolean;
  accountAutoInvoice: boolean;
  needsInvoice: boolean;
  invoiceAuto: boolean;
  invoiced: boolean;
};

/** "add" = prenderle la marca; "remove" = sacarla; "keep" = no tocar nada. */
export function autoInvoiceDecision(m: AutoInvoiceInput): "add" | "remove" | "keep" {
  // Ya facturado: la marca queda como está pase lo que pase.
  if (m.invoiced) return "keep";
  const eligible =
    m.type === "income" &&
    !m.deleted &&
    !m.isGuarantee &&
    !m.fromGuarantee &&
    // Importado de VikRentCar sin el medio real confirmado: se decide al confirmarlo.
    !m.needsConfirmation &&
    m.accountAutoInvoice;
  if (eligible) return m.needsInvoice ? "keep" : "add";
  // Solo se saca lo que entró por la cuenta; lo pedido por el cliente o
  // agregado a mano no depende de la cuenta.
  return m.needsInvoice && m.invoiceAuto ? "remove" : "keep";
}

export type InvoiceGroup = "client" | "account";

/** "client" = el cliente dio datos para la factura; "account" = el resto. */
export function invoiceGroup(m: { invoicingName: string | null; invoicingCuit: string | null }): InvoiceGroup {
  return m.invoicingName?.trim() || m.invoicingCuit?.trim() ? "client" : "account";
}

/**
 * Un ingreso ya facturado no puede cambiar de cuenta, monto ni moneda, ni
 * borrarse: la factura ya está emitida por ese importe. Devuelve el motivo
 * del rechazo, o null si se puede.
 */
export function invoicedChangeError(
  invoiced: boolean,
  change: { account?: boolean; amount?: boolean; currency?: boolean; delete?: boolean },
): string | null {
  if (!invoiced) return null;
  if (change.delete) {
    return "Este ingreso ya está facturado: no se puede eliminar. Si se marcó facturado por error, volvelo a pendiente en Caja → Facturación.";
  }
  if (change.account || change.amount || change.currency) {
    return "Este ingreso ya está facturado: no se puede cambiar la cuenta, el monto ni la moneda. Si se marcó facturado por error, volvelo a pendiente en Caja → Facturación.";
  }
  return null;
}
