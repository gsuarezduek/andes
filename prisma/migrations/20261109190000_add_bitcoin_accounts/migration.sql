-- Cuentas en bitcoins: flag en el medio de pago + moneda propia de los
-- traspasos (BTC solo existe en `account_transfers`, no en Caja).

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN "is_bitcoin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "balance_adjustment_btc" DECIMAL(18,8) NOT NULL DEFAULT 0;

-- CreateEnum
CREATE TYPE "TransferCurrency" AS ENUM ('ars', 'usd', 'btc');

-- AlterTable: misma moneda de siempre, ahora del enum de traspasos; los
-- montos admiten 8 decimales (satoshis) sin perder los importes cargados.
ALTER TABLE "account_transfers"
  ALTER COLUMN "from_currency" TYPE "TransferCurrency" USING ("from_currency"::text::"TransferCurrency"),
  ALTER COLUMN "to_currency" TYPE "TransferCurrency" USING ("to_currency"::text::"TransferCurrency"),
  ALTER COLUMN "from_amount" SET DATA TYPE DECIMAL(18,8),
  ALTER COLUMN "to_amount" SET DATA TYPE DECIMAL(18,8);
