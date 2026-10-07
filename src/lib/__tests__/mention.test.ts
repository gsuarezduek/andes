import { describe, it, expect } from "vitest";
import { activeMentionQuery, insertMention, matchMentionCandidates } from "@/lib/mention";

describe("activeMentionQuery", () => {
  it("sin @ en el texto: null", () => {
    expect(activeMentionQuery("el cliente pidió cambiar el horario", 10)).toBeNull();
  });

  it("@ seguido de texto hasta el cursor: devuelve lo tipeado", () => {
    expect(activeMentionQuery("avisale a @gas", 14)).toBe("gas");
  });

  it("@ con un espacio antes del cursor: ya no es una mención activa", () => {
    expect(activeMentionQuery("avisale a @gaston hoy", 21)).toBeNull();
  });

  it("toma el último @ antes del cursor, no el primero", () => {
    expect(activeMentionQuery("@juan y @gas", 12)).toBe("gas");
  });

  it("cursor justo después del @: búsqueda vacía (abre el desplegable sin filtrar)", () => {
    expect(activeMentionQuery("hola @", 6)).toBe("");
  });
});

describe("matchMentionCandidates", () => {
  const team = [{ name: "Gastón" }, { name: "Andrés" }, { name: "María" }];

  it("sin búsqueda: devuelve los primeros N", () => {
    expect(matchMentionCandidates(team, "", 2)).toEqual([{ name: "Gastón" }, { name: "Andrés" }]);
  });

  it("filtra sin importar tildes ni mayúsculas", () => {
    expect(matchMentionCandidates(team, "gaston", 6)).toEqual([{ name: "Gastón" }]);
    expect(matchMentionCandidates(team, "AND", 6)).toEqual([{ name: "Andrés" }]);
  });

  it("sin coincidencias: array vacío", () => {
    expect(matchMentionCandidates(team, "zzz", 6)).toEqual([]);
  });

  it("recorta al máximo pedido", () => {
    expect(matchMentionCandidates(team, "", 1)).toEqual([{ name: "Gastón" }]);
  });
});

describe("insertMention", () => {
  it("reemplaza desde el @ hasta el cursor por \"@Nombre\" (sin doble espacio, ya hay uno después)", () => {
    const result = insertMention("avisale a @gas por favor", 14, "Gastón");
    expect(result).toEqual({
      text: "avisale a @Gastón por favor",
      insertedText: "@Gastón",
      caret: 17,
    });
  });

  it("al final del texto: agrega un espacio de separación", () => {
    const result = insertMention("avisale a @gas", 14, "Gastón");
    expect(result).toEqual({
      text: "avisale a @Gastón ",
      insertedText: "@Gastón",
      caret: 18,
    });
  });

  it("sin @ antes del cursor: null", () => {
    expect(insertMention("avisale a Gaston", 10, "Gastón")).toBeNull();
  });

  it("inserta en medio del texto, conserva lo que sigue después del cursor", () => {
    const result = insertMention("hola @g che", 7, "Gastón");
    expect(result?.text).toBe("hola @Gastón che");
  });
});
