-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "reports_excluded_at" TIMESTAMP(3),
ADD COLUMN     "reports_excluded_by_name" TEXT,
ADD COLUMN     "reports_excluded_reason" TEXT;
