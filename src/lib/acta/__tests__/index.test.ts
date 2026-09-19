import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Mocks (hoisted para poder referenciarlos en vi.mock) ---
const { prismaMock, sendMock } = vi.hoisted(() => ({
  prismaMock: {
    inspection: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    damage: { findMany: vi.fn() },
    checklistItem: { findMany: vi.fn() },
    conditionSettings: { findUnique: vi.fn() },
  },
  sendMock: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/storage", () => ({
  storage: () => ({ get: vi.fn(), put: vi.fn() }),
  actaKey: (id: string) => `actas/${id}.pdf`,
}));
vi.mock("@/lib/email/settings", () => ({
  resolveEmailConfig: vi.fn().mockResolvedValue({
    from: undefined,
    content: {
      handoverSubject: "Acta de entrega",
      returnSubject: "Acta de devolución",
      greeting: "Hola",
      handoverBody: "Cuerpo",
      returnBody: "Cuerpo",
      attachmentNote: "Adjunto",
      regards: "Saludos",
    },
  }),
}));
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: sendMock } })),
}));

import { renderActaBuffer, generateAndSendActa } from "@/lib/acta";

const INSPECTION_CREATED_AT = new Date("2026-01-10T12:00:00Z");

function baseInspection(overrides: Record<string, unknown> = {}) {
  return {
    id: "insp-1",
    type: "handover",
    rentalId: "r1",
    vehicleId: "v1",
    km: 1000,
    fuelLevel: 8,
    checklistResponses: null,
    observations: null,
    signatureUrl: null,
    signerName: "Juan Pérez",
    latitude: null,
    longitude: null,
    createdAt: INSPECTION_CREATED_AT,
    settlement: null,
    damages: [],
    media: [],
    user: { name: "Empleado Test" },
    vehicle: { brand: "Toyota", model: "Etios", plate: "AB123CD", fuelLevels: 8 },
    rental: {
      language: "es",
      clientName: "Juan Pérez",
      clientEmail: "cliente@example.com",
      clientPhone: null,
      clientDocNumber: null,
      clientCountry: null,
      clientAddress: null,
      licenseExpiry: null,
      pricing: null,
      additionalDrivers: null,
      startAt: new Date("2026-01-10T10:00:00Z"),
      endAt: new Date("2026-01-15T10:00:00Z"),
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RESEND_API_KEY = "test-key";
  process.env.EMAIL_FROM = "no-reply@mdzrentacar.com";
  process.env.ADMIN_EMAIL = "admin@mdzrentacar.com";
  prismaMock.checklistItem.findMany.mockResolvedValue([]);
  prismaMock.damage.findMany.mockResolvedValue([]);
  prismaMock.conditionSettings.findUnique.mockResolvedValue({ sendHandoverActa: true, sendReturnActa: true });
  sendMock.mockResolvedValue({ data: { id: "email-1" }, error: null });
});

describe("renderActaBuffer — daños existentes", () => {
  it("filtra los daños activos del auto por la fecha de ESTA inspección (regresión: no debe mostrar daños cargados después)", async () => {
    const inspection = baseInspection();
    prismaMock.inspection.findUnique.mockResolvedValue(inspection);

    await renderActaBuffer("insp-1");

    expect(prismaMock.damage.findMany).toHaveBeenCalledTimes(1);
    const where = prismaMock.damage.findMany.mock.calls[0][0].where;
    // El bug real: esta query traía TODOS los daños activos del vehículo sin
    // filtro de tiempo, así que un daño cargado en una devolución posterior
    // aparecía en el acta de entrega ya firmada. El filtro tiene que anclar
    // "activo" al momento de esta inspección, no al momento en que se abre
    // el PDF.
    expect(where.vehicleId).toBe("v1");
    expect(where.createdAt).toEqual({ lt: INSPECTION_CREATED_AT });
    expect(where.OR).toEqual([{ repaired: false }, { repairedAt: { gt: INSPECTION_CREATED_AT } }]);
  });
});

describe("generateAndSendActa — email al cliente y al admin", () => {
  it("manda el email al cliente y al admin por separado, y persiste el resultado de cada uno", async () => {
    const inspection = baseInspection();
    prismaMock.inspection.findUnique.mockResolvedValue(inspection);

    await generateAndSendActa("insp-1");

    expect(sendMock).toHaveBeenCalledTimes(2);
    const recipients = sendMock.mock.calls.map((c) => c[0].to[0]).sort();
    expect(recipients).toEqual(["admin@mdzrentacar.com", "cliente@example.com"]);

    expect(prismaMock.inspection.update).toHaveBeenCalledWith({
      where: { id: "insp-1" },
      data: expect.objectContaining({
        actaClientEmailStatus: "sent",
        actaAdminEmailStatus: "sent",
      }),
    });
  });

  it("si Resend rechaza el envío al cliente, el admin igual recibe su copia (antes: un `to` inválido tiraba abajo todo el request, incluido el `cc` del admin)", async () => {
    const inspection = baseInspection();
    prismaMock.inspection.findUnique.mockResolvedValue(inspection);
    sendMock.mockImplementation(async ({ to }: { to: string[] }) => {
      if (to[0] === "cliente@example.com") {
        return { data: null, error: { message: "Domain not verified", name: "validation_error" } };
      }
      return { data: { id: "email-admin" }, error: null };
    });

    await generateAndSendActa("insp-1");

    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(prismaMock.inspection.update).toHaveBeenCalledWith({
      where: { id: "insp-1" },
      data: expect.objectContaining({
        actaClientEmailStatus: "failed",
        actaClientEmailError: "Domain not verified",
        actaAdminEmailStatus: "sent",
      }),
    });
  });

  it("un email de cliente con formato inválido queda como fallido sin intentar mandarlo (evita gastar el request y confunde con un bounce)", async () => {
    const inspection = baseInspection({ rental: { ...baseInspection().rental, clientEmail: "juan perez" } });
    prismaMock.inspection.findUnique.mockResolvedValue(inspection);

    await generateAndSendActa("insp-1");

    // Solo el admin se manda de verdad.
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: ["admin@mdzrentacar.com"] }));
    expect(prismaMock.inspection.update).toHaveBeenCalledWith({
      where: { id: "insp-1" },
      data: expect.objectContaining({
        actaClientEmailStatus: "failed",
        actaClientEmailError: expect.stringContaining("formato válido"),
      }),
    });
  });

  it("si el envío al cliente está desactivado en Configuración, queda 'skipped' y no se llama a Resend para el cliente", async () => {
    const inspection = baseInspection();
    prismaMock.inspection.findUnique.mockResolvedValue(inspection);
    prismaMock.conditionSettings.findUnique.mockResolvedValue({ sendHandoverActa: false, sendReturnActa: true });

    await generateAndSendActa("insp-1");

    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith(expect.objectContaining({ to: ["admin@mdzrentacar.com"] }));
    expect(prismaMock.inspection.update).toHaveBeenCalledWith({
      where: { id: "insp-1" },
      data: expect.objectContaining({ actaClientEmailStatus: "skipped" }),
    });
  });
});
