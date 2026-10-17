-- CreateEnum
CREATE TYPE "CommissionMode" AS ENUM ('none', 'same', 'custom');

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "expense_commission_category_id" TEXT,
ADD COLUMN     "expense_commission_fixed" DECIMAL(12,2),
ADD COLUMN     "expense_commission_mode" "CommissionMode" NOT NULL DEFAULT 'none',
ADD COLUMN     "expense_commission_percent" DECIMAL(6,2);

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_expense_commission_category_id_fkey" FOREIGN KEY ("expense_commission_category_id") REFERENCES "cash_movement_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
