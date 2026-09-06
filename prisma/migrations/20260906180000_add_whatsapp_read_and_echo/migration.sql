-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN "last_outbound_at" TIMESTAMP(3);
ALTER TABLE "whatsapp_conversations" ADD COLUMN "last_read_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN "sent_via_app" BOOLEAN NOT NULL DEFAULT false;
