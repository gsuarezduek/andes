-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "recipient_payment_method_id" TEXT,
ADD COLUMN     "recipient_payment_method_name" TEXT,
ADD COLUMN     "recipient_payment_method_note" TEXT;

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_recipient_payment_method_id_fkey" FOREIGN KEY ("recipient_payment_method_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
