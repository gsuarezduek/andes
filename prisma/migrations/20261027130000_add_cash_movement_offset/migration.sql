-- AlterEnum
ALTER TYPE "CashMovementType" ADD VALUE 'offset';

-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "offset_debt_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "cash_movements_offset_debt_id_key" ON "cash_movements"("offset_debt_id");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_offset_debt_id_fkey" FOREIGN KEY ("offset_debt_id") REFERENCES "cash_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

