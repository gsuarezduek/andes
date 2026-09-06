-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN     "bot_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "whatsapp_messages" ADD COLUMN     "sent_by_bot" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "whatsapp_bot_config" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "prompt" TEXT NOT NULL DEFAULT '',
    "only_new_conversations" BOOLEAN NOT NULL DEFAULT false,
    "blocked_words" JSONB NOT NULL DEFAULT '[]',
    "escalation_words" JSONB NOT NULL DEFAULT '[]',
    "examples" JSONB NOT NULL DEFAULT '[]',
    "handoff_message" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_bot_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_bot_documents" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "extracted_text" TEXT NOT NULL,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "summarized" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_bot_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_bot_escalations" (
    "id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "reason" TEXT,
    "client_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_bot_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "whatsapp_bot_escalations_conversation_id_idx" ON "whatsapp_bot_escalations"("conversation_id");

-- AddForeignKey
ALTER TABLE "whatsapp_bot_escalations" ADD CONSTRAINT "whatsapp_bot_escalations_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
