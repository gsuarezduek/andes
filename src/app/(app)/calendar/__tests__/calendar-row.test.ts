import { describe, it, expect } from "vitest";
import { barContentTier, rowHasCompactBar, rowLayout } from "../calendar-row";

describe("barContentTier", () => {
  it("barra ancha (varios días): horario + nombre + horario", () => {
    expect(barContentTier(164)).toBe("full"); // 1 día en la vista ancha previa (168px de columna)
    expect(barContentTier(110)).toBe("full");
  });

  it("barra media: solo los dos horarios, sin nombre", () => {
    expect(barContentTier(109)).toBe("times");
    expect(barContentTier(70)).toBe("times");
  });

  it("barra angosta (ej. 1 día a 46px de columna): horarios apilados", () => {
    expect(barContentTier(69)).toBe("compact");
    expect(barContentTier(42)).toBe("compact"); // 1 * 46 - 4, el caso real más angosto
  });
});

describe("rowHasCompactBar", () => {
  const colW = 46; // COL_W_MONTH real

  it("una barra de 1 día (42px): la fila necesita el doble de alto", () => {
    expect(rowHasCompactBar([{ span: 1 }], colW)).toBe(true);
  });

  it("solo barras de varios días: la fila queda con el alto normal", () => {
    expect(rowHasCompactBar([{ span: 3 }, { span: 5 }], colW)).toBe(false);
  });

  it("alcanza con que UNA de varias barras sea de 1 día", () => {
    expect(rowHasCompactBar([{ span: 4 }, { span: 1 }], colW)).toBe(true);
  });

  it("fila sin barras: no hace falta agrandarla", () => {
    expect(rowHasCompactBar([], colW)).toBe(false);
  });
});

describe("rowLayout", () => {
  const rowH = 40;

  it("un carril, sin alquiler de 1 día: alto normal", () => {
    expect(rowLayout(1, false, rowH)).toEqual({ barsH: 40, laneH: 40, roomy: false });
  });

  it("un carril con alquiler de 1 día: doble de alto, carril holgado", () => {
    expect(rowLayout(1, true, rowH)).toEqual({ barsH: 80, laneH: 80, roomy: true });
  });

  it("2 carriles con alquiler de 1 día: doble de alto, no 4×", () => {
    expect(rowLayout(2, true, rowH)).toEqual({ barsH: 80, laneH: 40, roomy: false });
  });

  it("2 carriles sin alquiler de 1 día: doble de alto", () => {
    expect(rowLayout(2, false, rowH)).toEqual({ barsH: 80, laneH: 40, roomy: false });
  });
});
