/**
 * Convierte un string tipeado por el empleado a number, aceptando coma o
 * punto como separador decimal (formato argentino: "70,50"). `undefined` si
 * está vacío o no es un número válido.
 */
export function parseDecimal(raw: string | number | null | undefined): number | undefined {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  const s = String(raw ?? "").trim();
  if (s === "") return undefined;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : undefined;
}
