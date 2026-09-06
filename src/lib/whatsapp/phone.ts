/**
 * Normalización de teléfonos para WhatsApp (E.164, ej. +5492611234567) y
 * variantes plausibles para cruzar contra `Rental.clientPhone`, que se carga
 * a mano (VikRentCar o el empleado) en formatos libres: con o sin "+", con o
 * sin el "9" de celular argentino, con o sin el 0 inicial del código de área.
 * El cruce es best-effort — no hay forma de normalizar con certeza sin saber
 * cómo lo tipeó cada persona.
 */

/** A E.164: se queda solo con los dígitos y antepone "+". */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return `+${digits}`;
}

/**
 * Variantes plausibles de un E.164 argentino tal como podría haberse
 * tipeado a mano: con "+", sin "+", y sin el "9" de celular que WhatsApp
 * agrega pero VikRentCar/un alquiler manual normalmente no.
 */
export function phoneVariants(e164: string): string[] {
  const digits = e164.replace(/\D/g, "");
  const variants = new Set<string>([digits, `+${digits}`]);

  // Celular argentino: +549<área><número> — variante sin el "9" (54<área><número>).
  if (digits.startsWith("549")) {
    const withoutNine = `54${digits.slice(3)}`;
    variants.add(withoutNine);
    variants.add(`+${withoutNine}`);
  }

  return Array.from(variants);
}
