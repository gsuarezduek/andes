import "server-only";
import { unstable_cache } from "next/cache";

export type BtcPrice = { usd: number; fetchedAt: Date };

const PRICE_URL = "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd";

// Si CoinGecko falla, tira: así `unstable_cache` no guarda el error y el
// próximo pedido lo vuelve a intentar.
const fetchBtcPrice = unstable_cache(
  async (): Promise<{ usd: number; fetchedAt: string }> => {
    const res = await fetch(PRICE_URL, {
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`CoinGecko respondió ${res.status}`);
    const body = (await res.json()) as { bitcoin?: { usd?: unknown } };
    const usd = Number(body.bitcoin?.usd);
    if (!Number.isFinite(usd) || usd <= 0) throw new Error("CoinGecko devolvió un precio inválido");
    return { usd, fetchedAt: new Date().toISOString() };
  },
  ["btc-price-usd"],
  { revalidate: 300 },
);

/**
 * Precio de 1 BTC en dólares, de la API pública de CoinGecko (sin clave),
 * cacheado 5 minutos para todos. Se consulta desde el servidor, nunca desde
 * el navegador. Es solo para mostrar el valor aproximado de una cuenta
 * Bitcoin: no se guarda en la base ni entra en ningún saldo. Devuelve null
 * si el servicio no responde (la cuenta se muestra igual, sin valuación).
 */
export async function getBtcPrice(): Promise<BtcPrice | null> {
  try {
    const { usd, fetchedAt } = await fetchBtcPrice();
    return { usd, fetchedAt: new Date(fetchedAt) };
  } catch (err) {
    console.warn("[btc-price] no se pudo obtener el precio de BTC:", err instanceof Error ? err.message : err);
    return null;
  }
}
