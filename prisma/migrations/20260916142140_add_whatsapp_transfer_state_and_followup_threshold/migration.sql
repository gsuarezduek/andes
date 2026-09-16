-- AlterTable
ALTER TABLE "whatsapp_bot_config" ADD COLUMN     "follow_up_stale_days" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN     "transferred_at" TIMESTAMP(3);
