import { describe, expect, it } from "vitest";
import { canRevealAccessCredential } from "../access-credentials";

describe("canRevealAccessCredential", () => {
  it("cualquiera revela un acceso que no es adminOnly", () => {
    expect(canRevealAccessCredential(false, "empleado")).toBe(true);
    expect(canRevealAccessCredential(false, "admin")).toBe(true);
  });

  it("solo un admin revela un acceso adminOnly", () => {
    expect(canRevealAccessCredential(true, "admin")).toBe(true);
    expect(canRevealAccessCredential(true, "empleado")).toBe(false);
  });
});
