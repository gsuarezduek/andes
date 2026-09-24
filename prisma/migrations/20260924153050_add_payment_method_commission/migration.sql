-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "commission_source_id" TEXT;

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "commission_category_id" TEXT,
ADD COLUMN     "commission_fixed" DECIMAL(12,2),
ADD COLUMN     "commission_percent" DECIMAL(6,2);

-- CreateIndex
CREATE INDEX "cash_movements_commission_source_id_idx" ON "cash_movements"("commission_source_id");

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_commission_category_id_fkey" FOREIGN KEY ("commission_category_id") REFERENCES "cash_movement_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_commission_source_id_fkey" FOREIGN KEY ("commission_source_id") REFERENCES "cash_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
