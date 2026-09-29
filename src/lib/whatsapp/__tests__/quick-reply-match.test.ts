import { describe, expect, it } from "vitest";
import { normalizeShortcut, matchQuickReplies } from "@/lib/whatsapp/quick-reply-match";

describe("normalizeShortcut", () => {
  it("baja a minúsculas y sin acentos", () => {
    expect(normalizeShortcut("Hórario")).toBe("horario");
  });

  it("sacar la barra inicial si viene con ella", () => {
    expect(normalizeShortcut("/horario")).toBe("horario");
  });

  it("saca espacios y caracteres inválidos", () => {
    expect(normalizeShortcut(" Buenos Días! ")).toBe("buenosdias");
  });

  it("permite guiones y guiones bajos", () => {
    expect(normalizeShortcut("fuera-de_horario")).toBe("fuera-de_horario");
  });

  it("vacío da vacío", () => {
    expect(normalizeShortcut("   ")).toBe("");
  });
});

describe("matchQuickReplies", () => {
  const replies = [
    { shortcut: "horario", text: "a" },
    { shortcut: "fuera-de-horario", text: "b" },
    { shortcut: "bienvenida", text: "c" },
    { shortcut: "ubicacion", text: "d" },
  ];

  it("sin query devuelve todas", () => {
    expect(matchQuickReplies(replies, "")).toEqual(replies);
  });

  it("prioriza las que empiezan con la búsqueda antes que las que solo la contienen", () => {
    const result = matchQuickReplies(replies, "hor");
    expect(result.map((r) => r.shortcut)).toEqual(["horario", "fuera-de-horario"]);
  });

  it("ignora acentos y mayúsculas en la búsqueda", () => {
    expect(matchQuickReplies(replies, "Ubicación").map((r) => r.shortcut)).toEqual(["ubicacion"]);
  });

  it("sin coincidencias devuelve vacío", () => {
    expect(matchQuickReplies(replies, "zzz")).toEqual([]);
  });
});
