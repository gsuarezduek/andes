import { RentalList } from "@/components/rentals/rental-list";
import type { MonthGroup } from "@/lib/rental-list-grouping";
import type { RentalRow } from "@/lib/rental-list-queries";

export function ProximasSection({ months }: { months: MonthGroup<RentalRow>[] }) {
  if (months.length === 0) {
    return (
      <p className="rounded-lg border border-foreground/10 px-4 py-3 text-sm text-foreground/50">
        No hay reservas próximas.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {months.map((month) => (
        <div key={month.key} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground/80">{month.label}</h3>
          {month.isCurrentMonth ? (
            <div className="flex flex-col gap-3">
              {month.days.map((day) => (
                <div key={day.key} className="flex flex-col gap-1.5">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-foreground/50">
                    {day.label}
                  </h4>
                  <RentalList rentals={day.rentals} />
                </div>
              ))}
            </div>
          ) : (
            <RentalList rentals={month.rentals} />
          )}
        </div>
      ))}
    </div>
  );
}
