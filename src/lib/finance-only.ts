import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Cómo se muestra una cuenta `PaymentMethod.financeOnly` a quien no tiene
 * acceso de Finanzas, cuando no se puede ocultar del todo (ej. un traspaso
 * desde esa cuenta hacia una cuenta visible: la plata que entró sí cuenta).
 */
export const RESTRICTED_ACCOUNT_NAME = "Cuenta reservada";

/**
 * Ids de las cuentas propias `financeOnly` — para excluirlas de cualquier
 * listado o cálculo cuando quien mira no tiene acceso de Finanzas (ver
 * `hasFinanceAccess`). `canSeeFinanceOnly=true`: sin exclusión.
 */
export async function financeOnlyAccountIds(canSeeFinanceOnly: boolean): Promise<string[]> {
  if (canSeeFinanceOnly) return [];
  const rows = await prisma.paymentMethod.findMany({
    // Una subcuenta de una cuenta de Finanzas también es de Finanzas, aunque
    // no tenga el tilde propio.
    where: { ownership: "own", OR: [{ financeOnly: true }, { parent: { financeOnly: true } }] },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
