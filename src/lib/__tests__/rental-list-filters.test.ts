import { describe, it, expect } from "vitest";
import { buildRentalWhereClauses, parseRentalListFilters } from "@/lib/rental-list-filters";

describe("buildRentalWhereClauses — búsqueda por texto", () => {
  it("busca por cliente, patente y código de cupón (texto libre, insensible a mayúsculas)", () => {
    const filters = parseRentalListFilters({ q: "ANDESHOSTING" });
    const { currentWhere } = buildRentalWhereClauses(filters);

    const and = (currentWhere as { AND: unknown[] }).AND;
    const searchClause = and[0] as { OR: unknown[] };
    expect(searchClause.OR).toEqual(
      expect.arrayContaining([
        { clientName: { contains: "ANDESHOSTING", mode: "insensitive" } },
        { vehicle: { plate: { contains: "ANDESHOSTING", mode: "insensitive" } } },
        { bookingCouponCode: { contains: "ANDESHOSTING", mode: "insensitive" } },
      ]),
    );
  });

  it("si el texto es todo dígitos, también busca por N° de orden de VikRentCar", () => {
    const filters = parseRentalListFilters({ q: "2997" });
    const { currentWhere } = buildRentalWhereClauses(filters);

    const and = (currentWhere as { AND: unknown[] }).AND;
    const searchClause = and[0] as { OR: unknown[] };
    expect(searchClause.OR).toContainEqual({ wpBookingId: 2997 });
  });
});
