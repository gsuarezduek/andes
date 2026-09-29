-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "dates_edited_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "rental_extensions" (
    "id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "previous_end_at" TIMESTAMP(3) NOT NULL,
    "new_end_at" TIMESTAMP(3) NOT NULL,
    "extra_days" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_extensions_rental_id_idx" ON "rental_extensions"("rental_id");

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
