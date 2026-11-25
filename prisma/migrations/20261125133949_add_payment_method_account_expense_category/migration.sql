-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "account_expense_category_id" TEXT;

-- AddForeignKey
ALTER TABLE "payment_methods" ADD CONSTRAINT "payment_methods_account_expense_category_id_fkey" FOREIGN KEY ("account_expense_category_id") REFERENCES "cash_movement_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
