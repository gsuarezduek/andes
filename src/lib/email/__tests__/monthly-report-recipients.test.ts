import { describe, expect, it } from "vitest";
import {
  parseMonthlyReportRoles,
  resolveMonthlyReportRecipients,
  type RecipientCandidate,
} from "../monthly-report-recipients";

const users: RecipientCandidate[] = [
  { name: "Dueño", email: "duenio@x.com", role: "admin", owner: true, active: true },
  { name: "Socia", email: "socia@x.com", role: "observador", owner: false, active: true },
  { name: "Socio inactivo", email: "viejo@x.com", role: "observador", owner: false, active: false },
  { name: "Admin", email: "admin@x.com", role: "admin", owner: false, active: true },
  { name: "Empleado", email: "emp@x.com", role: "empleado", owner: false, active: true },
];

describe("resolveMonthlyReportRecipients", () => {
  it("Socio + propietario: solo los socios activos y el propietario", () => {
    const r = resolveMonthlyReportRecipients(users, { roles: ["observador"], toOwner: true });
    expect(r.map((x) => x.email)).toEqual(["duenio@x.com", "socia@x.com"]);
    expect(r.every((x) => x.fullAccess)).toBe(true);
  });

  it("sin el propietario, un propietario con rol no elegido no recibe", () => {
    const r = resolveMonthlyReportRecipients(users, { roles: ["observador"], toOwner: false });
    expect(r.map((x) => x.email)).toEqual(["socia@x.com"]);
  });

  it("un admin común recibe la versión sin cuentas de Finanzas", () => {
    const r = resolveMonthlyReportRecipients(users, { roles: ["admin"], toOwner: false });
    expect(r).toEqual([
      { name: "Dueño", email: "duenio@x.com", fullAccess: true },
      { name: "Admin", email: "admin@x.com", fullAccess: false },
    ]);
  });

  it("no repite un email aunque coincida por rol y por propietario", () => {
    const r = resolveMonthlyReportRecipients(
      [...users, { name: "Dup", email: "DUENIO@x.com", role: "observador", owner: false, active: true }],
      { roles: ["admin", "observador"], toOwner: true },
    );
    expect(r.filter((x) => x.email.toLowerCase() === "duenio@x.com")).toHaveLength(1);
  });

  it("nada elegido: nadie", () => {
    expect(resolveMonthlyReportRecipients(users, { roles: [], toOwner: false })).toEqual([]);
  });
});

describe("parseMonthlyReportRoles", () => {
  it("descarta valores desconocidos y respeta el orden de la pantalla", () => {
    expect(parseMonthlyReportRoles(["observador", "hacker", "empleado"])).toEqual(["empleado", "observador"]);
  });
});
