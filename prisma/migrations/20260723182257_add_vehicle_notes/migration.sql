-- CreateTable
CREATE TABLE "vehicle_notes" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "created_by_id" TEXT,
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_notes_vehicle_id_idx" ON "vehicle_notes"("vehicle_id");

-- AddForeignKey
ALTER TABLE "vehicle_notes" ADD CONSTRAINT "vehicle_notes_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_notes" ADD CONSTRAINT "vehicle_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_notes" ADD CONSTRAINT "vehicle_notes_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
