-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN     "follow_up_at" TIMESTAMP(3),
ADD COLUMN     "pending_confirmation_at" TIMESTAMP(3);
