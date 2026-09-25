import { describe, expect, it } from "vitest";
import { userManagementError, type UserPerm } from "../user-permissions";

const owner: UserPerm = { id: "o", role: "admin", owner: true };
const admin: UserPerm = { id: "a", role: "admin", owner: false };
const otherAdmin: UserPerm = { id: "b", role: "admin", owner: false };
const staff: UserPerm = { id: "e", role: "empleado", owner: false };

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
});
