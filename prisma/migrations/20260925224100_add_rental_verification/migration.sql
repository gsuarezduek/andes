-- CreateEnum
CREATE TYPE "RentalVerificationAction" AS ENUM ('verified', 'unverified', 'auto_unverified');

-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by_id" TEXT,
ADD COLUMN     "verified_by_name" TEXT;

-- CreateTable
CREATE TABLE "rental_verifications" (
    "id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "action" "RentalVerificationAction" NOT NULL,
    "reason" TEXT,
    "by_id" TEXT,
    "by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_verifications_rental_id_idx" ON "rental_verifications"("rental_id");

-- AddForeignKey
ALTER TABLE "rental_verifications" ADD CONSTRAINT "rental_verifications_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_verifications" ADD CONSTRAINT "rental_verifications_by_id_fkey" FOREIGN KEY ("by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
