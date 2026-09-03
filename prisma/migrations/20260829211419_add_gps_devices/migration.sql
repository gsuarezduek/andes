-- CreateTable
CREATE TABLE "gps_devices" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "vehicle_id" TEXT,
    "installed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gps_devices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gps_devices_identifier_key" ON "gps_devices"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "gps_devices_vehicle_id_key" ON "gps_devices"("vehicle_id");

-- AddForeignKey
ALTER TABLE "gps_devices" ADD CONSTRAINT "gps_devices_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
