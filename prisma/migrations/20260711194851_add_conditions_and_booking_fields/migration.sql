-- AlterTable
ALTER TABLE "rentals" ADD COLUMN     "booking_days" INTEGER,
ADD COLUMN     "booking_note" TEXT,
ADD COLUMN     "booking_price_per_day" DECIMAL(12,2),
ADD COLUMN     "booking_total" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "condition_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "insurance_amount" DECIMAL(12,2),
    "km_per_day" INTEGER,
    "extra_km_rate" DECIMAL(12,2),
    "extra_hour_percent" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "condition_settings_pkey" PRIMARY KEY ("id")
);
