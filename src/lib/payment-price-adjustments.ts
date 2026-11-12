import "server-only";
import { prisma } from "@/lib/prisma";
import type { PaymentPriceAdjustment } from "@/lib/quote-price-options";

/**
 * Descuentos/recargos de los métodos de pago activos en VikRentCar (los trae
 * el sync, plugin andes-sync v1.9.0+). Para los cotizadores: presupuesto del
 * Calendario, mensaje de WhatsApp y bot. Vacío si no hay ninguno o si el
 * plugin todavía no los informa.
 */
export async function getPaymentPriceAdjustments(): Promise<PaymentPriceAdjustment[]> {
  const rows = await prisma.wpPaymentMethod.findMany({
    where: { active: true, priceAdjustmentValue: { not: null }, priceAdjustmentUnit: { not: null } },
    select: { name: true, priceAdjustmentValue: true, priceAdjustmentUnit: true, wpGatewayId: true },
    orderBy: [{ wpGatewayId: "asc" }, { name: "asc" }],
  });
  return rows.map((r) => ({ name: r.name, value: Number(r.priceAdjustmentValue), unit: r.priceAdjustmentUnit! }));
}
