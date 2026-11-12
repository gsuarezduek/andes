import type { RawPaymentGatewayCatalog, RawPriceAdjustment } from "./types";

/**
 * Métodos de pago de VikRentCar → catálogo `WpPaymentMethod` de Andes (lógica
 * pura; la aplica `syncWpPaymentGateways` en payment-gateways-sync.ts).
 *
 * El catálogo se arma con los nombres que aparecen en las reservas, así que
 * cuando el dueño renombra un método en VikRentCar quedan los dos: las órdenes
 * viejas guardan "8=Stripe" y las nuevas "8=Stripe Tarjeta". Con la lista real
 * de `gpayments` se marca cuál sigue activo, y por el id compartido se sabe
 * que el nombre viejo es el mismo método (para pasarle sus asociaciones).
 */

/** `orders.idpayment` ("8=Stripe") → { id: 8, name: "Stripe" }. Sin id numérico o sin nombre → null. */
export function parseIdPayment(v: string | null): { id: number; name: string } | null {
  if (v == null) return null;
  const t = v.trim();
  const eq = t.indexOf("=");
  if (eq <= 0) return null;
  const id = Number(t.slice(0, eq).trim());
  const name = t.slice(eq + 1).trim();
  if (!Number.isInteger(id) || id <= 0 || name.length === 0) return null;
  return { id, name };
}

/**
 * Descuento/recargo de una fila de `gpayments`, con la misma regla que aplica
 * VikRentCar al total (site/controller.php): `charge` = valor, `ch_disc`
 * 1 = recargo / 2 = descuento, `val_pcent` 1 = monto fijo / 2 = porcentaje.
 * Espeja `andes_sync_price_adjustment` del plugin. null = sin ajuste.
 */
export function priceAdjustmentFromRow(r: {
  charge: number | string | null;
  ch_disc: number | string | null;
  val_pcent: number | string | null;
}): RawPriceAdjustment | null {
  const charge = Number(r.charge ?? 0);
  if (!Number.isFinite(charge) || charge <= 0) return null;
  return {
    value: Number(r.ch_disc) === 1 ? charge : -charge,
    unit: Number(r.val_pcent) === 1 ? "fixed" : "percent",
  };
}

export type CatalogRow = {
  id: string;
  name: string;
  wpGatewayId: number | null;
  active: boolean | null;
  priceAdjustment: RawPriceAdjustment | null;
  linkedIds: string[];
};

export type GatewayPlan = {
  /** Nombres de métodos activos que todavía no están en el catálogo. */
  create: { name: string; wpGatewayId: number; active: boolean; priceAdjustment: RawPriceAdjustment | null }[];
  /** Filas existentes cuyo id de VikRentCar, estado o descuento/recargo cambió. */
  update: { id: string; wpGatewayId: number | null; active: boolean; priceAdjustment: RawPriceAdjustment | null }[];
  /**
   * Asociaciones a copiar al nombre nuevo de un método renombrado (por nombre,
   * porque la fila puede ser una de las que se crean en este mismo plan).
   * Solo si el nombre nuevo no tiene ninguna: nunca pisa lo que eligió el admin.
   */
  carryLinks: { toName: string; paymentMethodIds: string[] }[];
};

export function planGatewaySync(catalog: CatalogRow[], data: RawPaymentGatewayCatalog): GatewayPlan {
  const gatewayByName = new Map(data.gateways.map((g) => [g.name, g]));
  // id de VikRentCar de cada nombre: el de la lista real gana sobre el de las órdenes.
  const idByName = new Map<string, number>();
  for (const s of data.seenNames) idByName.set(s.name, s.id);
  for (const g of data.gateways) idByName.set(g.name, g.id);

  const byName = new Map(catalog.map((r) => [r.name, r]));
  const plan: GatewayPlan = { create: [], update: [], carryLinks: [] };

  for (const row of catalog) {
    const gw = gatewayByName.get(row.name);
    const active = gw ? gw.published : false;
    const wpGatewayId = idByName.get(row.name) ?? row.wpGatewayId;
    // Sin dato del plugin (< v1.9.0, `undefined`) se conserva lo guardado.
    const priceAdjustment = gw && gw.priceAdjustment !== undefined ? gw.priceAdjustment : row.priceAdjustment;
    if (
      active !== row.active ||
      wpGatewayId !== row.wpGatewayId ||
      !sameAdjustment(priceAdjustment, row.priceAdjustment)
    ) {
      plan.update.push({ id: row.id, wpGatewayId, active, priceAdjustment });
    }
  }

  for (const gw of data.gateways) {
    if (!gw.published) continue;
    const existing = byName.get(gw.name);
    if (!existing) {
      plan.create.push({ name: gw.name, wpGatewayId: gw.id, active: true, priceAdjustment: gw.priceAdjustment ?? null });
    }
    if (existing && existing.linkedIds.length > 0) continue;
    // Nombres viejos del mismo método (mismo id, otro nombre) que tenían asociaciones.
    const inherited = new Set<string>();
    for (const row of catalog) {
      if (row.name === gw.name || row.linkedIds.length === 0) continue;
      const rowId = idByName.get(row.name) ?? row.wpGatewayId;
      if (rowId === gw.id) row.linkedIds.forEach((id) => inherited.add(id));
    }
    if (inherited.size > 0) plan.carryLinks.push({ toName: gw.name, paymentMethodIds: [...inherited] });
  }

  return plan;
}

function sameAdjustment(a: RawPriceAdjustment | null, b: RawPriceAdjustment | null): boolean {
  if (a == null || b == null) return a == b;
  return a.unit === b.unit && a.value === b.value;
}
