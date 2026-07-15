-- AlterTable
ALTER TABLE "damages" ADD COLUMN     "repaired_at" TIMESTAMP(3),
ADD COLUMN     "repaired_by_id" TEXT,
ADD COLUMN     "reported_by_id" TEXT;

-- AlterTable
ALTER TABLE "rental_documents" ADD COLUMN     "holder_name" TEXT;

-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "additional_drivers" JSONB;

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "fuel_levels" INTEGER NOT NULL DEFAULT 8;

-- AddForeignKey
ALTER TABLE "damages" ADD CONSTRAINT "damages_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "damages" ADD CONSTRAINT "damages_repaired_by_id_fkey" FOREIGN KEY ("repaired_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
