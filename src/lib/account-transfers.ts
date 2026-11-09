import { emptyCurrencyTotals, fiatCurrency, type CurrencyTotals, type TransferCurrency } from "@/lib/currency";

/** Id que usa el form de traspasos para la Caja fuerte (no es un `PaymentMethod`; se guarda como cuenta nula). */
export const SAFE_ACCOUNT_ID = "safe";
export const SAFE_ACCOUNT_NAME = "Caja fuerte";

/** Error al cargar un ingreso/egreso en una cuenta Bitcoin (ver `PaymentMethod.isBitcoin`). */
export const BITCOIN_ACCOUNT_ERROR =
  "Una cuenta Bitcoin no admite ingresos ni egresos: comprá o vendé BTC con \"Mover entre cuentas\".";

/**
 * Lo mínimo de un traspaso para calcular saldos (ver `AccountTransfer`). Una
 * cuenta `null` es la Caja fuerte (efectivo físico), que no es un medio de pago.
 */
export type TransferAmounts = {
  fromAccountId: string | null;
  fromAmount: number;
  fromCurrency: TransferCurrency;
  toAccountId: string | null;
  toAmount: number;
  toCurrency: TransferCurrency;
};

/**
 * Aplica traspasos a los saldos por cuenta principal: resta `fromAmount` en la
 * cuenta origen y suma `toAmount` en la destino, cada uno en su moneda.
 * `resolve` lleva cada cuenta (o subcuenta) a su principal; un traspaso entre
 * subcuentas de la misma principal se cancela solo. El lado en BTC (una
 * cuenta Bitcoin) no entra acá: se suma aparte en `bitcoinBalances`. Muta
 * `balances`. Pura y testeable.
 */
export function applyTransfersToBalances(
  balances: Map<string, CurrencyTotals>,
  resolve: Map<string, string>,
  transfers: TransferAmounts[],
): void {
  for (const t of transfers) {
    const fromCurrency = fiatCurrency(t.fromCurrency);
    const from = balances.get(resolve.get(t.fromAccountId ?? "") ?? "");
    if (from && fromCurrency) from[fromCurrency] -= t.fromAmount;
    const toCurrency = fiatCurrency(t.toCurrency);
    const to = balances.get(resolve.get(t.toAccountId ?? "") ?? "");
    if (to && toCurrency) to[toCurrency] += t.toAmount;
  }
}

export type BitcoinBalance = {
  /** Saldo en BTC: lo que entró menos lo que salió por traspasos. */
  btc: number;
  /**
   * Pesos/dólares que se pusieron para comprar menos lo que se recibió al
   * vender (la contraparte de cada traspaso). Positivo = plata aportada que
   * todavía está en BTC; negativo = ya se sacó más de lo que se puso.
   */
  netContributed: CurrencyTotals;
};

/**
 * Saldo de cada cuenta Bitcoin principal (ver `PaymentMethod.isBitcoin`) a
 * partir de los traspasos. `resolve` lleva cada cuenta (o subcuenta) a su
 * principal; solo se calculan las principales de `bitcoinIds`. Un traspaso
 * entre dos subcuentas de la misma cuenta se cancela solo. Pura y testeable.
 */
export function bitcoinBalances(
  bitcoinIds: string[],
  resolve: Map<string, string>,
  transfers: TransferAmounts[],
): Map<string, BitcoinBalance> {
  const result = new Map<string, BitcoinBalance>(
    bitcoinIds.map((id) => [id, { btc: 0, netContributed: emptyCurrencyTotals() }]),
  );
  for (const t of transfers) {
    const from = result.get(resolve.get(t.fromAccountId ?? "") ?? "");
    const to = result.get(resolve.get(t.toAccountId ?? "") ?? "");
    if (from && from === to) continue;
    if (to && t.toCurrency === "btc") {
      to.btc += t.toAmount;
      const paid = fiatCurrency(t.fromCurrency);
      if (paid) to.netContributed[paid] += t.fromAmount;
    }
    if (from && t.fromCurrency === "btc") {
      from.btc -= t.fromAmount;
      const received = fiatCurrency(t.toCurrency);
      if (received) from.netContributed[received] -= t.toAmount;
    }
  }
  return result;
}

/**
 * Efecto neto de los traspasos sobre la Billetera (efectivo en mano): lo que
 * sale de una cuenta `isCash` resta, lo que entra a una suma. Un traspaso
 * entre dos cuentas `isCash` (o ninguna) no la mueve. Pura y testeable.
 */
export function walletDeltaFromTransfers(
  transfers: (TransferAmounts & { fromIsCash: boolean; toIsCash: boolean })[],
): CurrencyTotals {
  const delta = emptyCurrencyTotals();
  for (const t of transfers) {
    const fromCurrency = fiatCurrency(t.fromCurrency);
    const toCurrency = fiatCurrency(t.toCurrency);
    if (t.fromIsCash && fromCurrency) delta[fromCurrency] -= t.fromAmount;
    if (t.toIsCash && toCurrency) delta[toCurrency] += t.toAmount;
  }
  return delta;
}

/**
 * Efecto neto de los traspasos sobre el saldo de la Caja fuerte: lo que entra
 * (destino `null`) suma, lo que sale (origen `null`) resta. Pura y testeable.
 */
export function safeDeltaFromTransfers(transfers: TransferAmounts[]): CurrencyTotals {
  const delta = emptyCurrencyTotals();
  for (const t of transfers) {
    // La Caja fuerte nunca tiene un lado en BTC (se valida al crear).
    const fromCurrency = fiatCurrency(t.fromCurrency);
    const toCurrency = fiatCurrency(t.toCurrency);
    if (t.toAccountId === null && toCurrency) delta[toCurrency] += t.toAmount;
    if (t.fromAccountId === null && fromCurrency) delta[fromCurrency] -= t.fromAmount;
  }
  return delta;
}

export type TransferAccountOption = {
  id: string;
  name: string;
  /** Cuenta principal a la que suma el saldo (ella misma si no es subcuenta). */
  principalId: string;
  /** Cuenta Bitcoin (o subcuenta de una): su lado del traspaso va siempre en BTC. */
  isBitcoin: boolean;
};

/** Saldo de una cuenta en las monedas que puede tener (BTC solo en cuentas Bitcoin). */
export type TransferBalance = Partial<Record<TransferCurrency, number>>;

/**
 * Cuentas elegibles como origen/destino de un traspaso (principales +
 * subcuentas + Caja fuerte + cuentas Bitcoin) y el saldo de cada principal
 * (para avisar si un traspaso dejaría el origen en negativo). Lo comparten
 * "Mover entre cuentas" del header de Caja y el de la página de cada cuenta.
 */
export function buildTransferOptions(
  accounts: { id: string; name: string; balance: CurrencyTotals; subaccounts: { id: string; name: string }[] }[],
  safeBalance: CurrencyTotals,
  bitcoinAccounts: { id: string; name: string; btc: number; subaccounts: { id: string; name: string }[] }[] = [],
): { options: TransferAccountOption[]; balances: Record<string, TransferBalance> } {
  const toOptions = (a: { id: string; name: string; subaccounts: { id: string; name: string }[] }, isBitcoin: boolean) => [
    { id: a.id, name: a.name, principalId: a.id, isBitcoin },
    ...a.subaccounts.map((s) => ({ id: s.id, name: `${a.name} · ${s.name}`, principalId: a.id, isBitcoin })),
  ];
  const options: TransferAccountOption[] = accounts.flatMap((a) => toOptions(a, false));
  options.push({ id: SAFE_ACCOUNT_ID, name: SAFE_ACCOUNT_NAME, principalId: SAFE_ACCOUNT_ID, isBitcoin: false });
  options.push(...bitcoinAccounts.flatMap((a) => toOptions(a, true)));
  return {
    options,
    balances: {
      ...Object.fromEntries(accounts.map((a) => [a.id, a.balance])),
      [SAFE_ACCOUNT_ID]: safeBalance,
      ...Object.fromEntries(bitcoinAccounts.map((a) => [a.id, { btc: a.btc }])),
    },
  };
}
