-- CreateTable
CREATE TABLE "rental_notes" (
    "id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_by_id" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_notes_rental_id_idx" ON "rental_notes"("rental_id");

-- AddForeignKey
ALTER TABLE "rental_notes" ADD CONSTRAINT "rental_notes_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_notes" ADD CONSTRAINT "rental_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_notes" ADD CONSTRAINT "rental_notes_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
