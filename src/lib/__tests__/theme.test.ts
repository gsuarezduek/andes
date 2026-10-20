import { describe, expect, it } from "vitest";
import { parseThemePreference, resolveTheme } from "../theme";

describe("parseThemePreference", () => {
  it("acepta light/dark y cae a system con cualquier otra cosa", () => {
    expect(parseThemePreference("light")).toBe("light");
    expect(parseThemePreference("dark")).toBe("dark");
    expect(parseThemePreference(null)).toBe("system");
    expect(parseThemePreference("azul")).toBe("system");
  });
});

describe("resolveTheme", () => {
  it("system sigue al dispositivo", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });
  it("una elección explícita ignora al dispositivo", () => {
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});
