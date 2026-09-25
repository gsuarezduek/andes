/**
 * Ordena una lista de cuentas para mostrarla con cada subcuenta pegada debajo
 * de su cuenta principal (`PaymentMethod.parentId`, un solo nivel). Respeta el
 * orden original de la lista tanto entre cuentas de primer nivel como entre las
 * subcuentas de una misma principal. Una subcuenta cuya principal no está en la
 * lista (filtrada por la búsqueda, o de otro grupo) se muestra como cuenta de
 * primer nivel en su lugar — nunca se pierde.
 */
export function groupSubaccounts<T extends { id: string; parentId?: string | null }>(
  items: T[],
): { item: T; isChild: boolean }[] {
  const ids = new Set(items.map((i) => i.id));
  const childrenOf = new Map<string, T[]>();
  const tops: T[] = [];
  for (const it of items) {
    if (it.parentId && ids.has(it.parentId)) {
      const list = childrenOf.get(it.parentId) ?? [];
      list.push(it);
      childrenOf.set(it.parentId, list);
    } else {
      tops.push(it);
    }
  }
  return tops.flatMap((top) => [
    { item: top, isChild: false },
    ...(childrenOf.get(top.id) ?? []).map((item) => ({ item, isChild: true })),
  ]);
}
