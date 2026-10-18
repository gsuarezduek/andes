import { describe, expect, it } from "vitest";
import { hasAdminAccess, hasFinanceAccess, userManagementError, type UserPerm } from "../user-permissions";

const owner: UserPerm = { id: "o", role: "admin", owner: true };
const admin: UserPerm = { id: "a", role: "admin", owner: false };
const otherAdmin: UserPerm = { id: "b", role: "admin", owner: false };
const staff: UserPerm = { id: "e", role: "empleado", owner: false };
const finance: UserPerm = { id: "f", role: "finanzas", owner: false };
const observer: UserPerm = { id: "v", role: "observador", owner: false };

describe("userManagementError", () => {
  it("el propietario gestiona a cualquiera menos a otro propietario", () => {
    expect(userManagementError(owner, staff, "admin")).toBeNull();
    expect(userManagementError(owner, admin)).toBeNull();
    expect(userManagementError(owner, null, "admin")).toBeNull();
    expect(userManagementError(owner, owner)).toBeNull();
    expect(userManagementError(owner, { id: "o2", role: "admin", owner: true })).not.toBeNull();
  });

  it("nadie más puede tocar la cuenta propietaria", () => {
    expect(userManagementError(admin, owner)).not.toBeNull();
    expect(userManagementError(admin, owner, "empleado")).not.toBeNull();
  });

  it("un admin común gestiona empleados", () => {
    expect(userManagementError(admin, staff, "empleado")).toBeNull();
    expect(userManagementError(admin, null, "empleado")).toBeNull();
  });

  it("un admin común no crea admins ni asciende empleados", () => {
    expect(userManagementError(admin, null, "admin")).not.toBeNull();
    expect(userManagementError(admin, staff, "admin")).not.toBeNull();
  });

  it("un admin común no modifica a otros admins pero sí a sí mismo", () => {
    expect(userManagementError(admin, otherAdmin)).not.toBeNull();
    expect(userManagementError(admin, admin, "admin")).toBeNull();
  });

  it("solo el propietario otorga finanzas u observador", () => {
    expect(userManagementError(admin, staff, "finanzas")).not.toBeNull();
    expect(userManagementError(admin, null, "observador")).not.toBeNull();
    expect(userManagementError(owner, staff, "finanzas")).toBeNull();
    expect(userManagementError(owner, null, "observador")).toBeNull();
  });

  it("nadie más que el propietario toca una cuenta de finanzas u observador", () => {
    expect(userManagementError(admin, finance)).not.toBeNull();
    expect(userManagementError(admin, observer)).not.toBeNull();
    expect(userManagementError(owner, finance)).toBeNull();
    expect(userManagementError(owner, observer)).toBeNull();
  });

  it("finanzas gestiona empleados igual que admin, y puede bajarse de rango a sí mismo", () => {
    expect(userManagementError(finance, staff, "empleado")).toBeNull();
    expect(userManagementError(finance, finance, "admin")).toBeNull();
  });

  it("finanzas no puede ascenderse a sí mismo a observador sin el propietario", () => {
    expect(userManagementError(finance, finance, "observador")).not.toBeNull();
  });
});

describe("hasAdminAccess", () => {
  it("admin, finanzas y observador tienen acceso de nivel admin; empleado no", () => {
    expect(hasAdminAccess("admin")).toBe(true);
    expect(hasAdminAccess("finanzas")).toBe(true);
    expect(hasAdminAccess("observador")).toBe(true);
    expect(hasAdminAccess("empleado")).toBe(false);
  });
});

describe("hasFinanceAccess", () => {
  it("finanzas, observador y el propietario ven las cuentas restringidas; admin solo no", () => {
    expect(hasFinanceAccess("finanzas")).toBe(true);
    expect(hasFinanceAccess("observador")).toBe(true);
    expect(hasFinanceAccess("admin")).toBe(false);
    expect(hasFinanceAccess("empleado")).toBe(false);
    expect(hasFinanceAccess("admin", true)).toBe(true);
  });
});
