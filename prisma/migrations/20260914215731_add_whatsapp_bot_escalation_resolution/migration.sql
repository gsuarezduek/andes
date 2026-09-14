-- AlterTable
ALTER TABLE "whatsapp_bot_escalations" ADD COLUMN     "added_as_example" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "correct_answer" TEXT,
ADD COLUMN     "resolved_at" TIMESTAMP(3),
ADD COLUMN     "resolved_by_id" TEXT;

-- AddForeignKey
ALTER TABLE "whatsapp_bot_escalations" ADD CONSTRAINT "whatsapp_bot_escalations_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
