-- DropIndex
DROP INDEX "gps_devices_vehicle_id_key";

-- CreateIndex
CREATE INDEX "gps_devices_vehicle_id_idx" ON "gps_devices"("vehicle_id");
