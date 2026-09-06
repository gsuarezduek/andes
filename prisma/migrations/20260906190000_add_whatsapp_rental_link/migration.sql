-- AlterTable
ALTER TABLE "whatsapp_conversations" ADD COLUMN "rental_id" TEXT;

-- CreateIndex
CREATE INDEX "whatsapp_conversations_rental_id_idx" ON "whatsapp_conversations"("rental_id");

-- AddForeignKey
ALTER TABLE "whatsapp_conversations" ADD CONSTRAINT "whatsapp_conversations_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
