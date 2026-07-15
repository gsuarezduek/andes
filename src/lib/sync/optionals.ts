/**
 * Opcionales de VikRentCar (`wp_vikrentcar_optionals`) → condiciones de Andes.
 *
 * La orden guarda los elegidos como `"id:cantidad;"` (ej. `"4:1;5:1;"`). Los
 * clasificamos contra el catálogo:
 *   - **Mejora de Seguro** (nombre con "seguro") → *flag* que baja la franquicia.
 *   - **Resto** (packs de km, etc.) → *accesorios*: descripción + importe.
 *
 * El importe contempla `perday × días` y la cantidad. Es una **precarga** que el
 * empleado ajusta; el sync nunca pisa `pricing`. Lógica pura (sin I/O) para testear.
 * Ver docs/wordpress-mapping.md.
 */

import type { RawOptional } from "./types";

export type ResolvedOptionals = {
  /** La reserva incluye "Mejora de Seguro" (franquicia reducida). */
  insuranceUpgrade: boolean;
  /** Descripción de los accesorios (packs de km, etc.), o null. */
  accessoriesDesc: string | null;
  /** Importe sumado de los accesorios (perday × días × cantidad), o null. */
  accessoriesAmount: number | null;
};

/** Parsea `"id:cantidad;id:cantidad;"` → `[{ id, qty }]`. Cantidad ausente = 1. */
export function parseOptionals(raw: string | null | undefined): { id: number; qty: number }[] {
  if (!raw) return [];
  const out: { id: number; qty: number }[] = [];
  for (const part of raw.split(";")) {
    const t = part.trim();
    if (!t) continue;
    const [idS, qtyS] = t.split(":");
    const id = Number(idS);
    const qty = qtyS != null && qtyS !== "" ? Number(qtyS) : 1;
    if (Number.isFinite(id) && id > 0) {
      out.push({ id, qty: Number.isFinite(qty) && qty > 0 ? qty : 1 });
    }
  }
  return out;
}

/** ¿El opcional es una mejora de seguro? Se identifica por el nombre. */
export function isInsuranceUpgrade(name: string): boolean {
  return /seguro/i.test(name);
}

/**
 * Clasifica los opcionales de una reserva. `catalog` es `wp_vikrentcar_optionals`;
 * `days` los días del alquiler (para los opcionales por-día). Los ids sin match en
 * el catálogo se ignoran.
 */
export function resolveOptionals(
  raw: string | null | undefined,
  catalog: RawOptional[],
  days: number | null,
): ResolvedOptionals {
  const parsed = parseOptionals(raw);
  if (parsed.length === 0) {
    return { insuranceUpgrade: false, accessoriesDesc: null, accessoriesAmount: null };
  }
  const byId = new Map(catalog.map((o) => [o.id, o]));
  const d = days && days > 0 ? days : 1;

  let insuranceUpgrade = false;
  const descParts: string[] = [];
  let amount = 0;
  let anyAccessory = false;

  for (const { id, qty } of parsed) {
    const opt = byId.get(id);
    if (!opt) continue;
    if (isInsuranceUpgrade(opt.name)) {
      insuranceUpgrade = true;
      continue;
    }
    anyAccessory = true;
    descParts.push(qty > 1 ? `${opt.name} ×${qty}` : opt.name);
    const line = (opt.cost ?? 0) * (opt.perDay ? d : 1) * qty;
    if (Number.isFinite(line)) amount += line;
  }

  return {
    insuranceUpgrade,
    accessoriesDesc: descParts.length > 0 ? descParts.join(", ") : null,
    accessoriesAmount: anyAccessory ? Math.round(amount) : null,
  };
}
