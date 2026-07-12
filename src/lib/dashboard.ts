import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDateInput, mendozaWallTimeToUtc } from "@/lib/datetime";

const SERVICE_KM_THRESHOLD = 500; // avisar cuando falten ≤ 500 km para el service

export type MovementState = "pendiente" | "completada" | "demorada";

/** Datos agregados para el dashboard (§4.3). */
export async function getDashboardData() {
  const now = new Date();
  const todayStr = formatDateInput(now);
  const dayStart = mendozaWallTimeToUtc(`${todayStr}T00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [
    todayHandovers,
    todayReturns,
    rented,
    available,
    outOfService,
    overdueReturns,
    serviceCandidates,
    unassigned,
  ] = await Promise.all([
    // Entregas programadas hoy (por fecha de retiro).
    prisma.rental.findMany({
      where: { status: { not: "cancelled" }, startAt: { gte: dayStart, lt: dayEnd } },
      include: { vehicle: true, inspections: { select: { type: true } } },
      orderBy: { startAt: "asc" },
    }),
    // Devoluciones programadas hoy (por fecha de devolución). Incluye reservas
    // aún no iniciadas en la app: si WordPress dice que el auto vuelve hoy, se
    // muestra aunque la entrega no se haya cargado en Andes.
    prisma.rental.findMany({
      where: { status: { not: "cancelled" }, endAt: { gte: dayStart, lt: dayEnd } },
      include: { vehicle: true, inspections: { select: { type: true } } },
      orderBy: { endAt: "asc" },
    }),
    prisma.rental.findMany({
      where: { status: "active" },
      include: { vehicle: true },
      orderBy: { endAt: "asc" },
    }),
    prisma.vehicle.findMany({ where: { status: "available", archivedAt: null }, orderBy: [{ brand: "asc" }, { model: "asc" }] }),
    prisma.vehicle.findMany({ where: { status: "out_of_service", archivedAt: null }, orderBy: [{ brand: "asc" }, { model: "asc" }] }),
    // Alertas: devoluciones vencidas sin registrar.
    prisma.rental.findMany({
      where: { status: "active", endAt: { lt: now } },
      include: { vehicle: true },
      orderBy: { endAt: "asc" },
    }),
    prisma.vehicle.findMany({ where: { nextServiceKm: { not: null }, archivedAt: null } }),
    prisma.rental.findMany({
      where: { status: "reserved", vehicleId: null },
      orderBy: { startAt: "asc" },
    }),
  ]);

  const handoverState = (r: (typeof todayHandovers)[number]): MovementState => {
    if (r.inspections.some((i) => i.type === "handover")) return "completada";
    return now > r.startAt ? "demorada" : "pendiente";
  };
  const returnState = (r: (typeof todayReturns)[number]): MovementState => {
    if (r.status === "finished") return "completada";
    return now > r.endAt ? "demorada" : "pendiente";
  };

  const upcomingServices = serviceCandidates
    .filter((v) => v.nextServiceKm != null && v.currentKm >= v.nextServiceKm - SERVICE_KM_THRESHOLD)
    .sort((a, b) => (a.nextServiceKm! - a.currentKm) - (b.nextServiceKm! - b.currentKm))
    .map((v) => ({ ...v, overdue: v.currentKm >= v.nextServiceKm! }));

  return {
    today: {
      handovers: todayHandovers.map((r) => ({ rental: r, state: handoverState(r) })),
      returns: todayReturns.map((r) => ({ rental: r, state: returnState(r) })),
    },
    fleet: {
      rented,
      available,
      outOfService,
      counts: { rented: rented.length, available: available.length, outOfService: outOfService.length },
    },
    alerts: { overdueReturns, upcomingServices, unassigned },
  };
}
