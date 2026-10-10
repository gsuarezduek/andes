import "server-only";
import { prisma } from "@/lib/prisma";
import type { Currency } from "@/lib/currency";

/**
 * Libro de facturas emitidas (Caja → Facturación). Ver comentario del
 * modelo `Invoice` en el schema: es un registro suelto, sin vínculo formal
 * con los `CashMovement` marcados "Hay que facturar".
 */
export type InvoiceRow = {
  id: string;
  amount: number;
  currency: Currency;
  date: Date;
  razonSocial: string;
  cuit: string;
  createdByName: string;
  createdAt: Date;
};

export async function getInvoices(): Promise<InvoiceRow[]> {
  const rows = await prisma.invoice.findMany({ orderBy: [{ date: "desc" }, { createdAt: "desc" }] });
  return rows.map((r) => ({
    id: r.id,
    amount: Number(r.amount),
    currency: r.currency,
    date: r.date,
    razonSocial: r.razonSocial,
    cuit: r.cuit,
    createdByName: r.createdByName,
    createdAt: r.createdAt,
  }));
}
