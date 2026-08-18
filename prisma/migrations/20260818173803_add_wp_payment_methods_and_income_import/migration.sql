-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "needs_confirmation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "booking_paid_imported_amount" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "wp_payment_methods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wp_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_WpPaymentMethodMapping" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_WpPaymentMethodMapping_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "wp_payment_methods_name_key" ON "wp_payment_methods"("name");

-- CreateIndex
CREATE INDEX "_WpPaymentMethodMapping_B_index" ON "_WpPaymentMethodMapping"("B");

-- AddForeignKey
ALTER TABLE "_WpPaymentMethodMapping" ADD CONSTRAINT "_WpPaymentMethodMapping_A_fkey" FOREIGN KEY ("A") REFERENCES "payment_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_WpPaymentMethodMapping" ADD CONSTRAINT "_WpPaymentMethodMapping_B_fkey" FOREIGN KEY ("B") REFERENCES "wp_payment_methods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
