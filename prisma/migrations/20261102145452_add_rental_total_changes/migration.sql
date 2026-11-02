-- CreateEnum
CREATE TYPE "RentalTotalChangeStatus" AS ENUM ('pending', 'applied', 'dismissed');

-- CreateTable
CREATE TABLE "rental_total_changes" (
    "id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "previous_total" DECIMAL(12,2) NOT NULL,
    "new_total" DECIMAL(12,2) NOT NULL,
    "status" "RentalTotalChangeStatus" NOT NULL DEFAULT 'pending',
    "applied_amount" DECIMAL(12,2),
    "resolved_at" TIMESTAMP(3),
    "resolved_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_total_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_total_changes_rental_id_status_idx" ON "rental_total_changes"("rental_id", "status");

-- AddForeignKey
ALTER TABLE "rental_total_changes" ADD CONSTRAINT "rental_total_changes_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
