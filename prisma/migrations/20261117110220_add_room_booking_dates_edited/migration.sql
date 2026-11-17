-- AlterTable
ALTER TABLE "room_bookings" ADD COLUMN     "dates_edited_at" TIMESTAMP(3),
ADD COLUMN     "dates_edited_by_name" TEXT,
ADD COLUMN     "original_end_date" DATE,
ADD COLUMN     "original_start_date" DATE;
