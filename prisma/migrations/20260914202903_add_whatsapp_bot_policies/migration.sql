-- AlterTable
ALTER TABLE "whatsapp_bot_config" ADD COLUMN     "policies" JSONB NOT NULL DEFAULT '[]';
