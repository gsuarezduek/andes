-- AlterTable
ALTER TABLE "condition_settings" ADD COLUMN     "send_handover_acta" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "send_return_acta" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "client_address" TEXT;
