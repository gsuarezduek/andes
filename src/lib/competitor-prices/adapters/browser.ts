import "server-only";
import { chromium, type Page } from "playwright";

/**
 * Ciclo de vida del browser compartido entre adaptadores reales (mirror del
 * lanzar/cerrar contexto de un `BookingSource`). `--no-sandbox` hace falta
 * para correr Chromium como root en el contenedor de Railway; no afecta el
 * uso local. Cierra siempre, incluso si el adaptador tira una excepción —
 * el motor (`engine.ts`) ya tolera errores por ítem, pero un browser sin
 * cerrar se acumula entre corridas.
 */
export async function withBrowserPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    return await fn(page);
  } finally {
    await browser.close();
  }
}
