-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('ars', 'usd');

-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'ars';

-- AlterTable
ALTER TABLE "safe_movements" ADD COLUMN     "currency" "Currency" NOT NULL DEFAULT 'ars';
