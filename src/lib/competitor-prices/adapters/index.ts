import type { CompetitorPriceAdapter } from "../types";
import { mockAdapter } from "./mock";

const registry: Record<string, CompetitorPriceAdapter> = {
  mock: mockAdapter,
};

/** Claves válidas para `Competitor.adapterKey` — para poblar el `<select>` del ABM y no permitir crear un competidor con un adaptador inexistente. */
export const ADAPTER_KEYS = Object.keys(registry);

/** Adaptador por `Competitor.adapterKey` (mirror de `createBookingSource` en src/lib/sync/source.ts). */
export function getAdapter(adapterKey: string): CompetitorPriceAdapter {
  const adapter = registry[adapterKey];
  if (!adapter) throw new Error(`Adaptador de competidor desconocido: "${adapterKey}"`);
  return adapter;
}
