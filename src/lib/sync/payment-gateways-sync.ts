import "server-only";
import { prisma } from "@/lib/prisma";
import type { BookingSource } from "./types";
import { planGatewaySync } from "./payment-gateways";

/**
 * Actualiza el catálogo `WpPaymentMethod` con los métodos de pago reales de
 * VikRentCar: marca cuáles siguen activos (Configuración → Medios de pago
 * muestra solo esos), suma los activos que todavía no aparecieron en ninguna
 * reserva y, si un método se renombró, le pasa al nombre nuevo las
 * asociaciones del viejo. Sin dato del plugin (versión vieja o grupo
 * "Económico" apagado) no toca nada. Las filas inactivas no se borran: las
 * órdenes viejas siguen trayendo ese nombre y lo resuelven igual.
 */
export async function syncWpPaymentGateways(src: BookingSource): Promise<void> {
  const data = await src.fetchPaymentGateways();
  if (!data) return;

  const rows = await prisma.wpPaymentMethod.findMany({
    include: { paymentMethods: { select: { id: true } } },
  });
  const plan = planGatewaySync(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      wpGatewayId: r.wpGatewayId,
      active: r.active,
      linkedIds: r.paymentMethods.map((m) => m.id),
    })),
    data,
  );

  await prisma.$transaction(async (tx) => {
    for (const c of plan.create) {
      await tx.wpPaymentMethod.upsert({
        where: { name: c.name },
        create: c,
        update: { wpGatewayId: c.wpGatewayId, active: c.active },
      });
    }
    for (const u of plan.update) {
      await tx.wpPaymentMethod.update({
        where: { id: u.id },
        data: { wpGatewayId: u.wpGatewayId, active: u.active },
      });
    }
    for (const c of plan.carryLinks) {
      // Un medio de pago de Andes borrado entre el findMany y acá haría fallar
      // el connect: se filtra contra los que existen.
      const existing = await tx.paymentMethod.findMany({
        where: { id: { in: c.paymentMethodIds } },
        select: { id: true },
      });
      if (existing.length === 0) continue;
      await tx.wpPaymentMethod.update({
        where: { name: c.toName },
        data: { paymentMethods: { connect: existing } },
      });
    }
  });
}
