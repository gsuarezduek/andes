-- CreateEnum
CREATE TYPE "VehicleOwnership" AS ENUM ('own', 'third_party');

-- DropForeignKey
ALTER TABLE "cash_movements" DROP CONSTRAINT "cash_movements_third_party_vehicle_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "third_party_vehicle_bookings" DROP CONSTRAINT "third_party_vehicle_bookings_vehicle_id_fkey";

-- DropForeignKey
ALTER TABLE "third_party_vehicle_bookings" DROP CONSTRAINT "third_party_vehicle_bookings_created_by_id_fkey";

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "owner_name" TEXT,
ADD COLUMN     "owner_phone" TEXT,
ADD COLUMN     "ownership" "VehicleOwnership" NOT NULL DEFAULT 'own';

-- AlterTable
ALTER TABLE "cash_movements" DROP COLUMN "third_party_vehicle_booking_id";

-- DropTable
DROP TABLE "third_party_vehicles";

-- DropTable
DROP TABLE "third_party_vehicle_bookings";

-- DropEnum
DROP TYPE "ThirdPartyVehicleBookingStatus";
