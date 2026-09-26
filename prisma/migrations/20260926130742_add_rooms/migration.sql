-- CreateEnum
CREATE TYPE "RoomBookingSource" AS ENUM ('airbnb', 'booking', 'other', 'manual');

-- CreateEnum
CREATE TYPE "RoomBookingStatus" AS ENUM ('confirmed', 'cancelled');

-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "room_booking_id" TEXT;

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER,
    "nightly_rate" DECIMAL(12,2),
    "check_in_time" TEXT NOT NULL DEFAULT '14:00',
    "check_out_time" TEXT NOT NULL DEFAULT '10:00',
    "notes" TEXT,
    "sort_order" INTEGER,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_calendar_feeds" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "source" "RoomBookingSource" NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_sync_at" TIMESTAMP(3),
    "last_sync_ok" BOOLEAN,
    "last_sync_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "room_calendar_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_bookings" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "source" "RoomBookingSource" NOT NULL,
    "feed_id" TEXT,
    "external_uid" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "guest_name" TEXT,
    "external_label" TEXT,
    "external_description" TEXT,
    "is_block" BOOLEAN NOT NULL DEFAULT false,
    "status" "RoomBookingStatus" NOT NULL DEFAULT 'confirmed',
    "cancelled_at" TIMESTAMP(3),
    "notes" TEXT,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" "Currency" NOT NULL DEFAULT 'ars',
    "created_by_id" TEXT,
    "created_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "room_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "room_calendar_feeds_room_id_idx" ON "room_calendar_feeds"("room_id");

-- CreateIndex
CREATE INDEX "room_bookings_room_id_start_date_idx" ON "room_bookings"("room_id", "start_date");

-- CreateIndex
CREATE UNIQUE INDEX "room_bookings_feed_id_external_uid_key" ON "room_bookings"("feed_id", "external_uid");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_room_booking_id_fkey" FOREIGN KEY ("room_booking_id") REFERENCES "room_bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_calendar_feeds" ADD CONSTRAINT "room_calendar_feeds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_feed_id_fkey" FOREIGN KEY ("feed_id") REFERENCES "room_calendar_feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_bookings" ADD CONSTRAINT "room_bookings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
