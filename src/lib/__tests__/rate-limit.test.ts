import { describe, it, expect, vi, afterEach } from "vitest";
import { isRateLimited } from "@/lib/rate-limit";

describe("isRateLimited", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("permite hasta `max` intentos dentro de la ventana", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(key, 5, 60_000)).toBe(false);
    }
  });

  it("bloquea el intento que supera `max`", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) isRateLimited(key, 5, 60_000);
    expect(isRateLimited(key, 5, 60_000)).toBe(true);
  });

  it("libera de nuevo una vez que la ventana expira", () => {
    vi.useFakeTimers();
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) isRateLimited(key, 5, 1000);
    expect(isRateLimited(key, 5, 1000)).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(isRateLimited(key, 5, 1000)).toBe(false);
  });

  it("las claves distintas no se pisan entre sí", () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    for (let i = 0; i < 5; i++) isRateLimited(keyA, 5, 60_000);
    expect(isRateLimited(keyA, 5, 60_000)).toBe(true);
    expect(isRateLimited(keyB, 5, 60_000)).toBe(false);
  });
});
