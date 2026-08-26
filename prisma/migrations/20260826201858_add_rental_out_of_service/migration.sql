-- AlterEnum
ALTER TYPE "RentalStatus" ADD VALUE 'out_of_service';

-- AlterTable
ALTER TABLE "maintenance_logs" ADD COLUMN     "rental_id" TEXT;

-- CreateIndex
CREATE INDEX "maintenance_logs_rental_id_idx" ON "maintenance_logs"("rental_id");

-- AddForeignKey
ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
