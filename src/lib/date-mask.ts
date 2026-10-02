/**
 * Máscara DD/MM/AAAA para inputs de fecha con teclado numérico, en vez de
 * `<input type="date">` nativo — en iOS Safari ese input solo se opera con
 * el selector tipo "rueda" al tocarlo, no se puede tipear directamente.
 * El valor "de verdad" sigue siendo un string ISO "YYYY-MM-DD" (o "").
 */

/** "YYYY-MM-DD" -> "DDMMYYYY" (dígitos, sin separadores). "" si no matchea. */
export function isoToDigits(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return "";
  const [, y, mo, d] = m;
  return `${d}${mo}${y}`;
}

/** "DDMMYYYY" (parcial o completo) -> "DD/MM/AAAA" para mostrar en el input. */
export function digitsToDisplay(digits: string): string {
  const d = digits.slice(0, 2);
  const mo = digits.slice(2, 4);
  const y = digits.slice(4, 8);
  let out = d;
  if (digits.length > 2) out += `/${mo}`;
  if (digits.length > 4) out += `/${y}`;
  return out;
}

/** "DDMMYYYY" completo y válido -> "YYYY-MM-DD"; `undefined` si está incompleto o no es una fecha real. */
export function digitsToIso(digits: string): string | undefined {
  if (digits.length !== 8) return undefined;
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (month < 1 || month > 12) return undefined;
  if (year < 1900 || year > 2200) return undefined;
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}
