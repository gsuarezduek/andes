import { describe, expect, it, vi } from "vitest";
import { autoUnverifyRental } from "@/lib/rental-verification-server";

function fakeDb(count: number) {
  return {
    rental: { updateMany: vi.fn().mockResolvedValue({ count }) },
    rentalVerification: { create: vi.fn().mockResolvedValue({}) },
  };
}

describe("autoUnverifyRental", () => {
  it("le quita la verificación y deja constancia con el motivo", async () => {
    const db = fakeDb(1);
    await autoUnverifyRental(db as never, "r1", "Se cargó un pago nuevo.");

    expect(db.rental.updateMany).toHaveBeenCalledWith({
      where: { id: "r1", verifiedAt: { not: null } },
      data: { verifiedAt: null, verifiedById: null, verifiedByName: null },
    });
    expect(db.rentalVerification.create).toHaveBeenCalledWith({
      data: { rentalId: "r1", action: "auto_unverified", reason: "Se cargó un pago nuevo.", byName: "Sistema" },
    });
  });

  it("no deja constancia si la reserva no estaba verificada", async () => {
    const db = fakeDb(0);
    await autoUnverifyRental(db as never, "r1", "Se cargó un pago nuevo.");
    expect(db.rentalVerification.create).not.toHaveBeenCalled();
  });
});
