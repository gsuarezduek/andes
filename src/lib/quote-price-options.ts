/**
 * Precio de un presupuesto según la forma de pago. En la web, VikRentCar
 * aplica al total el descuento (o recargo) de cada método de pago
 * (`gpayments.charge`, traído por el sync a `WpPaymentMethod`): hoy, −5 % con
 * transferencia y cripto. Andes cotiza con la tarifa de lista, así que acá se
 * arma, a partir de ese total, el precio con cada ajuste: primero los
 * descuentos (aclarando con qué medios), después el precio de lista para el
 * resto de los medios.
 *
 * Pura y sin `server-only` a propósito: la usan el presupuestador del
 * Calendario (Client Component), el mensaje de WhatsApp y el bot.
 */
import { formatArs } from "@/lib/contract";
import { quotePricePerDay } from "@/lib/quote-estimate";

/** Descuento/recargo de un método de pago activo. `value` con signo: negativo = descuento. */
export type PaymentPriceAdjustment = { name: string; value: number; unit: "percent" | "fixed" };

export type QuotePriceOption = {
  /** `list` = precio de lista (sin ajuste), para el resto de los medios. */
  kind: "discount" | "list" | "charge";
  /** Medios de pago con este precio (vacío en el de lista). */
  methods: string[];
  /** "−5 %", "+3 %", "−$ 1.000"; null en el de lista. */
  adjustmentLabel: string | null;
  total: number;
  perDay: number | null;
};

function applyAdjustment(total: number, a: { value: number; unit: "percent" | "fixed" }): number {
  const adjusted = a.unit === "percent" ? total * (1 + a.value / 100) : total + a.value;
  return Math.max(0, Math.round(adjusted));
}

function adjustmentLabel(a: { value: number; unit: "percent" | "fixed" }): string {
  const sign = a.value < 0 ? "−" : "+";
  const abs = Math.abs(a.value);
  return a.unit === "percent" ? `${sign}${abs.toLocaleString("es-AR")} %` : `${sign}${formatArs(abs)}`;
}

/**
 * Opciones de precio para un total de lista. Los medios con el mismo ajuste
 * van juntos; orden de menor a mayor precio (descuentos, lista, recargos).
 * Sin ajustes, una sola opción: el precio de lista.
 */
export function quotePriceOptions(
  total: number,
  days: number,
  adjustments: PaymentPriceAdjustment[],
): QuotePriceOption[] {
  const groups = new Map<string, { value: number; unit: "percent" | "fixed"; methods: string[] }>();
  for (const a of adjustments) {
    if (!Number.isFinite(a.value) || a.value === 0) continue;
    const key = `${a.unit}:${a.value}`;
    const g = groups.get(key) ?? { value: a.value, unit: a.unit, methods: [] };
    if (!g.methods.includes(a.name)) g.methods.push(a.name);
    groups.set(key, g);
  }

  const options: QuotePriceOption[] = [...groups.values()].map((g) => {
    const t = applyAdjustment(total, g);
    return {
      kind: g.value < 0 ? "discount" : "charge",
      methods: g.methods,
      adjustmentLabel: adjustmentLabel(g),
      total: t,
      perDay: quotePricePerDay(t, days),
    };
  });
  options.push({ kind: "list", methods: [], adjustmentLabel: null, total, perDay: quotePricePerDay(total, days) });

  const rank = { discount: 0, list: 1, charge: 2 } as const;
  return options.sort((a, b) => rank[a.kind] - rank[b.kind] || a.total - b.total);
}

/** "Transferencia Argentina, USDT o Bitcoin". */
export function joinMethods(methods: string[]): string {
  if (methods.length <= 1) return methods[0] ?? "";
  return `${methods.slice(0, -1).join(", ")} o ${methods[methods.length - 1]}`;
}

/** A quién aplica: "con Transferencia Argentina o Cripto (−5 %)" / "con otros medios de pago". */
export function priceOptionLabel(option: QuotePriceOption): string {
  if (option.kind === "list") return "con otros medios de pago";
  return `con ${joinMethods(option.methods)} (${option.adjustmentLabel})`;
}

/**
 * Una sola línea con todas las opciones, para un placeholder `{total}` o
 * `{precioDia}` de una plantilla de WhatsApp que no use `{precios}`:
 * "$ 202.350 con Transferencia o Cripto (−5 %) · $ 213.000 con otros medios de pago".
 */
export function formatPriceOptionsInline(options: QuotePriceOption[], field: "total" | "perDay"): string | null {
  const parts = options.flatMap((o) => {
    const amount = field === "total" ? o.total : o.perDay;
    if (amount == null) return [];
    return [options.length > 1 ? `${formatArs(amount)} ${priceOptionLabel(o)}` : formatArs(amount)];
  });
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Bloque de precios del mensaje de WhatsApp (placeholder `{precios}`). */
export function formatPriceOptionsBlock(options: QuotePriceOption[]): string {
  if (options.length <= 1) {
    const o = options[0];
    if (!o) return "";
    return [o.perDay != null ? `💰 Precio por día: ${formatArs(o.perDay)}` : null, `💵 Total: ${formatArs(o.total)}`]
      .filter(Boolean)
      .join("\n");
  }
  return options
    .map((o) => {
      const who = priceOptionLabel(o);
      const head = `${o.kind === "discount" ? "💰" : "💳"} ${who.charAt(0).toUpperCase()}${who.slice(1)}`;
      const perDay = o.perDay != null ? `${formatArs(o.perDay)} por día · ` : "";
      return `${head}: ${perDay}Total ${formatArs(o.total)}`;
    })
    .join("\n");
}
