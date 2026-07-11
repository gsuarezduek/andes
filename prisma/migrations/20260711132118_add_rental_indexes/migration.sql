-- CreateIndex
CREATE INDEX "rentals_end_at_idx" ON "rentals"("end_at");

-- CreateIndex
CREATE INDEX "rentals_origin_idx" ON "rentals"("origin");

-- CreateIndex
CREATE INDEX "rentals_vehicle_id_idx" ON "rentals"("vehicle_id");
