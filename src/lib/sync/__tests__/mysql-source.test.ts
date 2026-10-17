import { describe, it, expect } from "vitest";
import { couponCode, paymentMethodName } from "@/lib/sync/mysql-source";

describe("couponCode", () => {
  it("extrae solo el código del formato real de VikRentCar (%;monto;código)", () => {
    expect(couponCode("10;23000;MDZLOVER")).toBe("MDZLOVER");
  });

  it("si no hay ';' asume que el valor ya es el código tal cual", () => {
    expect(couponCode("MDZLOVER")).toBe("MDZLOVER");
  });

  it("recorta espacios alrededor de cada segmento", () => {
    expect(couponCode(" 10 ; 23000 ; MDZLOVER ")).toBe("MDZLOVER");
  });

  it("null o vacío → null", () => {
    expect(couponCode(null)).toBeNull();
    expect(couponCode("")).toBeNull();
    expect(couponCode("  ")).toBeNull();
  });
});

describe("paymentMethodName (regresión, sin cambios en este fix)", () => {
  it("sigue extrayendo el nombre después del '='", () => {
    expect(paymentMethodName("8=Stripe")).toBe("Stripe");
  });
});
