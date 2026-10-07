-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "rental_id" TEXT,
ADD COLUMN     "source_rental_note_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "tasks_source_rental_note_id_key" ON "tasks"("source_rental_note_id");

-- CreateIndex
CREATE INDEX "tasks_rental_id_idx" ON "tasks"("rental_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_rental_note_id_fkey" FOREIGN KEY ("source_rental_note_id") REFERENCES "rental_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
