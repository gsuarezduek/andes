-- CreateEnum
CREATE TYPE "FundMovementType" AS ENUM ('deposit', 'withdrawal');

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "has_investment_funds" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "fund_movements" (
    "id" TEXT NOT NULL,
    "payment_method_id" TEXT NOT NULL,
    "type" "FundMovementType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ars',
    "note" TEXT,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_name" TEXT,
    "delete_note" TEXT,

    CONSTRAINT "fund_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fund_movements_payment_method_id_idx" ON "fund_movements"("payment_method_id");

-- CreateIndex
CREATE INDEX "fund_movements_created_at_idx" ON "fund_movements"("created_at");

-- AddForeignKey
ALTER TABLE "fund_movements" ADD CONSTRAINT "fund_movements_payment_method_id_fkey" FOREIGN KEY ("payment_method_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
