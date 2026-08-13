import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import {
  currentMonth,
  getCashPeriodDetail,
  getCashPeriodEdits,
  getOwnCashMovements,
  getRentalPickerOptions,
  parseCashPeriod,
} from "@/lib/cash";
import { getAllSafeMovements, getOwnSafeMovements, getSafeBalance, getSafeMovementEdits } from "@/lib/safe";
import { MovementLauncher } from "@/components/cash/movement-launcher";
import { CashPeriodDetail } from "@/components/cash/cash-period-detail";
import { CashOwnList } from "@/components/cash/cash-own-list";
import { SafeSection } from "@/components/cash/safe-section";

export const metadata: Metadata = { title: "Caja — Andes" };

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; date?: string }>;
}) {
  const user = await requireUser();
  const { period: rawPeriod, date: rawDate } = await searchParams;
  const period = parseCashPeriod(rawPeriod, rawDate);

  const [paymentMethods, rentalOptions] = await Promise.all([
    prisma.paymentMethod.findMany({
      where: { active: true },
      orderBy: { ordering: "asc" },
      select: { id: true, name: true, requiresNote: true, ownership: true },
    }),
    getRentalPickerOptions(),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Caja</h1>
        <p className="text-sm text-foreground/60">
          Registrá ingresos y egresos de las reservas. La <strong>caja fuerte</strong> (más abajo) es
          aparte: es el efectivo físico guardado, sin vínculo con ninguna reserva.
        </p>
      </div>

      <MovementLauncher paymentMethods={paymentMethods} rentalOptions={rentalOptions} />

      {user.role === "admin" ? (
        <>
          <CashPeriodDetail
            data={await getCashPeriodDetail(period)}
            edits={await getCashPeriodEdits(period)}
            paymentMethods={paymentMethods}
            period={period}
          />
          <SafeSection
            movements={await getAllSafeMovements()}
            balance={await getSafeBalance()}
            edits={await getSafeMovementEdits()}
          />
        </>
      ) : (
        <>
          <CashOwnList items={await getOwnCashMovements(user.id, currentMonth())} />
          <SafeSection movements={await getOwnSafeMovements(user.id)} balance={null} />
        </>
      )}
    </div>
  );
}
