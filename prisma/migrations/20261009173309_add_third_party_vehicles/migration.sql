-- CreateEnum
CREATE TYPE "ThirdPartyVehicleBookingStatus" AS ENUM ('confirmed', 'cancelled');

-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "third_party_vehicle_booking_id" TEXT;

-- CreateTable
CREATE TABLE "third_party_vehicles" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER,
    "color" TEXT,
    "owner_name" TEXT NOT NULL,
    "owner_phone" TEXT,
    "notes" TEXT,
    "sort_order" INTEGER,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "third_party_vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "third_party_vehicle_bookings" (
    "id" TEXT NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL,
    "client_phone" TEXT,
    "start_at" TIMESTAMP(3) NOT NULL,
    "end_at" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'ars',
    "status" "ThirdPartyVehicleBookingStatus" NOT NULL DEFAULT 'confirmed',
    "cancelled_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "third_party_vehicle_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "third_party_vehicle_bookings_vehicle_id_start_at_idx" ON "third_party_vehicle_bookings"("vehicle_id", "start_at");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_third_party_vehicle_booking_id_fkey" FOREIGN KEY ("third_party_vehicle_booking_id") REFERENCES "third_party_vehicle_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_vehicle_bookings" ADD CONSTRAINT "third_party_vehicle_bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "third_party_vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "third_party_vehicle_bookings" ADD CONSTRAINT "third_party_vehicle_bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
