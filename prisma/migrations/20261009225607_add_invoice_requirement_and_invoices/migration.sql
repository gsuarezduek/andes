-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "invoiced_at" TIMESTAMP(3),
ADD COLUMN     "invoiced_by_id" TEXT,
ADD COLUMN     "invoiced_by_name" TEXT,
ADD COLUMN     "invoicing_cuit" TEXT,
ADD COLUMN     "invoicing_name" TEXT,
ADD COLUMN     "needs_invoice" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ars',
    "date" DATE NOT NULL,
    "razon_social" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoices_date_idx" ON "invoices"("date");

-- CreateIndex
CREATE INDEX "cash_movements_needs_invoice_invoiced_at_idx" ON "cash_movements"("needs_invoice", "invoiced_at");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_invoiced_by_id_fkey" FOREIGN KEY ("invoiced_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
