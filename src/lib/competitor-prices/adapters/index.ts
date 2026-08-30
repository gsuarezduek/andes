import type { CompetitorPriceAdapter } from "../types";
import { mockAdapter } from "./mock";
import { invernaliaAdapter } from "./invernalia";
import { rentautoAdapter } from "./rentauto";
import { futuraAdapter } from "./futura";

const registry: Record<string, CompetitorPriceAdapter> = {
  mock: mockAdapter,
  invernalia: invernaliaAdapter,
  rentauto: rentautoAdapter,
  futura: futuraAdapter,
};

/** Claves válidas para `Competitor.adapterKey` — para poblar el `<select>` del ABM y no permitir crear un competidor con un adaptador inexistente. */
export const ADAPTER_KEYS = Object.keys(registry);

/** Adaptador por `Competitor.adapterKey` (mirror de `createBookingSource` en src/lib/sync/source.ts). */
export function getAdapter(adapterKey: string): CompetitorPriceAdapter {
  const adapter = registry[adapterKey];
  if (!adapter) throw new Error(`Adaptador de competidor desconocido: "${adapterKey}"`);
  return adapter;
}
