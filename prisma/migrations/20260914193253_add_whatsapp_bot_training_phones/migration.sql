-- AlterTable
ALTER TABLE "whatsapp_bot_config" ADD COLUMN     "training_phones" JSONB NOT NULL DEFAULT '[]';
