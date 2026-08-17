import { describe, it, expect } from "vitest";
import { groupUpcomingByMonth } from "@/lib/rental-list-grouping";

// "now" fijo: 17/08/2026 10:00 hora Mendoza (13:00 UTC).
const NOW = new Date("2026-08-17T13:00:00Z");

function rental(id: string, isoMendozaWall: string) {
  // isoMendozaWall tipo "2026-08-20T13:00" (hora de pared Mendoza, UTC-3).
  return { id, startAt: new Date(`${isoMendozaWall}:00-03:00`) };
}

describe("groupUpcomingByMonth", () => {
  it("agrupa el mes actual por día, con 'Hoy' para el día de hoy", () => {
    const rentals = [
      rental("a", "2026-08-17T09:00"),
      rental("b", "2026-08-17T15:00"),
      rental("c", "2026-08-20T10:00"),
    ];
    const groups = groupUpcomingByMonth(rentals, NOW);
    expect(groups).toHaveLength(1);
    const august = groups[0];
    expect(august.key).toBe("2026-08");
    expect(august.label).toBe("Agosto");
    expect(august.isCurrentMonth).toBe(true);
    expect(august.rentals.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(august.days).toHaveLength(2);
    expect(august.days[0]).toMatchObject({ key: "2026-08-17", label: "Hoy" });
    expect(august.days[0].rentals.map((r) => r.id)).toEqual(["a", "b"]);
    expect(august.days[1]).toMatchObject({ key: "2026-08-20", label: "Día 20" });
  });

  it("los meses futuros quedan como lista plana, sin subdividir por día", () => {
    const rentals = [rental("a", "2026-09-05T09:00"), rental("b", "2026-09-28T09:00")];
    const groups = groupUpcomingByMonth(rentals, NOW);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe("2026-09");
    expect(groups[0].label).toBe("Septiembre");
    expect(groups[0].isCurrentMonth).toBe(false);
    expect(groups[0].days).toHaveLength(0);
    expect(groups[0].rentals.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("separa varios meses en el orden en que llegan (asc por startAt)", () => {
    const rentals = [
      rental("a", "2026-08-18T09:00"),
      rental("b", "2026-09-02T09:00"),
      rental("c", "2026-10-01T09:00"),
    ];
    const groups = groupUpcomingByMonth(rentals, NOW);
    expect(groups.map((g) => g.key)).toEqual(["2026-08", "2026-09", "2026-10"]);
  });

  it("muestra el año en el label cuando el mes cae en otro año", () => {
    const rentals = [rental("a", "2027-01-05T09:00")];
    const groups = groupUpcomingByMonth(rentals, NOW);
    expect(groups[0].label).toBe("Enero de 2027");
  });

  it("sin reservas, no genera grupos", () => {
    expect(groupUpcomingByMonth([], NOW)).toEqual([]);
  });
});
