-- AlterTable
ALTER TABLE "room_bookings" ADD COLUMN     "verified_at" TIMESTAMP(3),
ADD COLUMN     "verified_by_id" TEXT,
ADD COLUMN     "verified_by_name" TEXT;

-- CreateTable
CREATE TABLE "room_booking_verifications" (
    "id" TEXT NOT NULL,
    "room_booking_id" TEXT NOT NULL,
    "action" "RentalVerificationAction" NOT NULL,
    "reason" TEXT,
    "by_id" TEXT,
    "by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_booking_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_booking_verifications_room_booking_id_idx" ON "room_booking_verifications"("room_booking_id");

-- AddForeignKey
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_booking_verifications" ADD CONSTRAINT "room_booking_verifications_room_booking_id_fkey" FOREIGN KEY ("room_booking_id") REFERENCES "room_bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_booking_verifications" ADD CONSTRAINT "room_booking_verifications_by_id_fkey" FOREIGN KEY ("by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
