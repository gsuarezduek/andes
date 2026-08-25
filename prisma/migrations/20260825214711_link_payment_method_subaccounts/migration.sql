-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "payment_methods_parent_id_idx" ON "payment_methods"("parent_id");

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
