import { describe, expect, it } from "vitest";
import { nameFromNote, effectiveClientName } from "@/lib/sync/client-name";

describe("nameFromNote", () => {
  it("toma la 1ª línea cuando es un nombre (convención nueva)", () => {
    // Orden 2883 real.
    const note = "DIEGO ALEJANDRO SOTO\r\n\r\n9hrs Aero ALEJANDRO SOTO x 5 dias a $60.000 x dia";
    expect(nameFromNote(note)).toBe("DIEGO ALEJANDRO SOTO");
  });

  it("acepta nombres con espacios y 'y'", () => {
    expect(nameFromNote("Cesar Guillermo Salgado y Fabiola Ortiz\n9 hs aero…")).toBe(
      "Cesar Guillermo Salgado y Fabiola Ortiz",
    );
    expect(nameFromNote("ALBERTO COLMAN \r\n17hs of ALBERTO COLMAN x 3 dias")).toBe("ALBERTO COLMAN");
  });

  it("rechaza la 1ª línea si es una nota operativa (nota vieja: hora/precio)", () => {
    // Orden 2885 real: arranca con la hora.
    expect(nameFromNote("9,20 hs Ramiro Salazar x 2 dias a $70.000 = $140.000")).toBeNull();
    expect(nameFromNote("17hs of Juan x 3 dias")).toBeNull();
    expect(nameFromNote("trf $70.000 al rio")).toBeNull();
  });

  it("null/vacío/línea larga → null", () => {
    expect(nameFromNote(null)).toBeNull();
    expect(nameFromNote("")).toBeNull();
    expect(nameFromNote("   \n resto")).toBeNull();
    expect(nameFromNote("x".repeat(61))).toBeNull();
  });
});

describe("effectiveClientName", () => {
  it("conserva el nombre real si existe", () => {
    expect(effectiveClientName("Juan Pérez", "9hs x 2 dias")).toBe("Juan Pérez");
  });

  it("usa la nota cuando vendría 'Sin nombre'", () => {
    expect(effectiveClientName("Sin nombre", "DIEGO ALEJANDRO SOTO\r\n\r\n9hrs")).toBe(
      "DIEGO ALEJANDRO SOTO",
    );
    expect(effectiveClientName(null, "JOSE ALBERTO CARRIZO")).toBe("JOSE ALBERTO CARRIZO");
  });

  it("cae a 'Sin nombre' si tampoco hay nombre en la nota", () => {
    expect(effectiveClientName("Sin nombre", "9,20 hs Ramiro x 2 dias")).toBe("Sin nombre");
    expect(effectiveClientName(null, null)).toBe("Sin nombre");
  });
});
