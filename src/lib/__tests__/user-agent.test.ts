import { describe, it, expect } from "vitest";
import { detectLoginDevice } from "@/lib/user-agent";

describe("detectLoginDevice", () => {
  it("detecta celular en Android/iPhone/iPad", () => {
    expect(
      detectLoginDevice(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
      ),
    ).toBe("mobile");
    expect(
      detectLoginDevice(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("mobile");
  });

  it("detecta pc en user-agents de escritorio", () => {
    expect(
      detectLoginDevice(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
      ),
    ).toBe("pc");
    expect(
      detectLoginDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15"),
    ).toBe("pc");
  });

  it("sin User-Agent, asume pc", () => {
    expect(detectLoginDevice(null)).toBe("pc");
    expect(detectLoginDevice(undefined)).toBe("pc");
  });
});
