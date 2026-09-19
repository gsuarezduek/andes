-- CreateEnum
CREATE TYPE "ActaEmailStatus" AS ENUM ('sent', 'failed', 'skipped');

-- AlterTable
ALTER TABLE "inspections" ADD COLUMN     "acta_admin_email_error" TEXT,
ADD COLUMN     "acta_admin_email_sent_at" TIMESTAMP(3),
ADD COLUMN     "acta_admin_email_status" "ActaEmailStatus",
ADD COLUMN     "acta_client_email_error" TEXT,
ADD COLUMN     "acta_client_email_sent_at" TIMESTAMP(3),
ADD COLUMN     "acta_client_email_status" "ActaEmailStatus";
