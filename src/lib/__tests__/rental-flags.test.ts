import { describe, it, expect } from "vitest";
import { computeRentalFlags } from "@/lib/rental-flags";
import type { RentalStatus, RentalOrigin } from "@prisma/client";

function rental(status: RentalStatus, opts: { origin?: RentalOrigin; vehicleId?: string | null; inspections?: string[] } = {}) {
  return {
    status,
    origin: opts.origin ?? "manual",
    vehicleId: "vehicleId" in opts ? opts.vehicleId! : "v1",
    inspections: (opts.inspections ?? []).map((type) => ({ type })),
  };
}

describe("computeRentalFlags — service/arreglo", () => {
  it("reservada con vehículo y sin entrega: puede marcar service, no cerrarlo", () => {
    const flags = computeRentalFlags(rental("reserved"));
    expect(flags.canMarkService).toBe(true);
    expect(flags.canCloseService).toBe(false);
  });

  it("reservada sin vehículo asignado: no puede marcar service", () => {
    const flags = computeRentalFlags(rental("reserved", { vehicleId: null }));
    expect(flags.canMarkService).toBe(false);
  });

  it("reservada pero ya con entrega hecha: no puede marcar service", () => {
    const flags = computeRentalFlags(rental("reserved", { inspections: ["handover"] }));
    expect(flags.canMarkService).toBe(false);
  });

  it("en service (out_of_service): puede cerrarlo, no puede volver a marcarlo", () => {
    const flags = computeRentalFlags(rental("out_of_service"));
    expect(flags.canCloseService).toBe(true);
    expect(flags.canMarkService).toBe(false);
  });

  it("activa/finalizada/cancelada: ni marcar ni cerrar service", () => {
    for (const status of ["active", "finished", "cancelled"] as const) {
      const flags = computeRentalFlags(rental(status));
      expect(flags.canMarkService).toBe(false);
      expect(flags.canCloseService).toBe(false);
    }
  });
});

describe("computeRentalFlags — editar hora/lugar de retiro/devolución", () => {
  it("reservada: se puede editar retiro y devolución, sin importar el origen", () => {
    for (const origin of ["manual", "vikrentcar"] as const) {
      const flags = computeRentalFlags(rental("reserved", { origin }));
      expect(flags.canEditPickup).toBe(true);
      expect(flags.canEditReturn).toBe(true);
    }
  });

  it("activa: solo se puede editar la devolución (el retiro ya ocurrió), sin importar el origen", () => {
    for (const origin of ["manual", "vikrentcar"] as const) {
      const flags = computeRentalFlags(rental("active", { origin }));
      expect(flags.canEditPickup).toBe(false);
      expect(flags.canEditReturn).toBe(true);
    }
  });

  it("finalizada/cancelada/en service: no se puede editar ni retiro ni devolución", () => {
    for (const status of ["finished", "cancelled", "out_of_service"] as const) {
      const flags = computeRentalFlags(rental(status));
      expect(flags.canEditPickup).toBe(false);
      expect(flags.canEditReturn).toBe(false);
    }
  });
});

describe("computeRentalFlags — extender alquiler", () => {
  it("solo se puede extender una reserva activa, sin importar el origen", () => {
    expect(computeRentalFlags(rental("active", { origin: "manual" })).canExtendRental).toBe(true);
    expect(computeRentalFlags(rental("active", { origin: "vikrentcar" })).canExtendRental).toBe(true);
    for (const status of ["reserved", "finished", "cancelled", "out_of_service"] as const) {
      expect(computeRentalFlags(rental(status)).canExtendRental).toBe(false);
    }
  });
});
