-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "license_expiry" TIMESTAMP(3),
ADD COLUMN     "pricing" JSONB;
