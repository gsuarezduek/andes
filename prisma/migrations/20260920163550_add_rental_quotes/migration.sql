-- CreateTable
CREATE TABLE "rental_quotes" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "client_name" TEXT,
    "note" TEXT,
    "estimated_total" DECIMAL(12,2),
    "conversation_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_quotes_vehicle_id_idx" ON "rental_quotes"("vehicle_id");

-- CreateIndex
CREATE INDEX "rental_quotes_start_at_idx" ON "rental_quotes"("start_at");

-- CreateIndex
CREATE INDEX "rental_quotes_end_at_idx" ON "rental_quotes"("end_at");

-- CreateIndex
CREATE INDEX "rental_quotes_conversation_id_idx" ON "rental_quotes"("conversation_id");

-- AddForeignKey
ALTER TABLE "rental_quotes" ADD CONSTRAINT "rental_quotes_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quotes" ADD CONSTRAINT "rental_quotes_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "whatsapp_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_quotes" ADD CONSTRAINT "rental_quotes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
