import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { formatDateInput } from "@/lib/datetime";
import { currentMonth, getCashMonthDetail, getOwnCashMovements } from "@/lib/cash";
import { CashMovementForm } from "@/components/cash/cash-movement-form";
import { CashMonthDetail } from "@/components/cash/cash-month-detail";
import { CashOwnList } from "@/components/cash/cash-own-list";

export const metadata: Metadata = { title: "Caja — Andes" };

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month: rawMonth } = await searchParams;
  const today = currentMonth();
  const month = rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : today;

  const [paymentMethods, rentals] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true },
    }),
    prisma.rental.findMany({
      where: { status: { in: ["reserved", "active"] } },
      orderBy: { startAt: "desc" },
      take: 100,
      select: { id: true, clientName: true, startAt: true, vehicle: { select: { plate: true } } },
    }),
  ]);

  const rentalOptions = rentals.map((r) => ({
    id: r.id,
    label: `${r.clientName} — ${r.vehicle?.plate ?? "sin unidad"} (${formatDateInput(r.startAt)})`,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
        <p className="text-sm text-foreground/60">Registrá cobros y pagos.</p>
      </div>

      <CashMovementForm paymentMethods={paymentMethods} rentalOptions={rentalOptions} />

      {user.role === "admin" ? (
        <CashMonthDetail data={await getCashMonthDetail(month)} todayMonth={today} />
      ) : (
        <CashOwnList items={await getOwnCashMovements(user.id, today)} />
      )}
    </div>
  );
}
