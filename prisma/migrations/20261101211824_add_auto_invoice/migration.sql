-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "invoice_auto" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "auto_invoice" BOOLEAN NOT NULL DEFAULT false;
