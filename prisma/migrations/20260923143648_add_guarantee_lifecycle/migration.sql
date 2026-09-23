-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "guarantee_charged_amount" DECIMAL(12,2),
ADD COLUMN     "guarantee_resolved_at" TIMESTAMP(3),
ADD COLUMN     "guarantee_resolved_by_id" TEXT,
ADD COLUMN     "guarantee_resolved_by_name" TEXT,
ADD COLUMN     "guarantee_returned_amount" DECIMAL(12,2),
ADD COLUMN     "guarantee_source_id" TEXT;

-- CreateIndex
CREATE INDEX "cash_movements_guarantee_source_id_idx" ON "cash_movements"("guarantee_source_id");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_guarantee_resolved_by_id_fkey" FOREIGN KEY ("guarantee_resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_guarantee_source_id_fkey" FOREIGN KEY ("guarantee_source_id") REFERENCES "cash_movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
