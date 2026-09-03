-- AlterTable
ALTER TABLE "condition_settings" ADD COLUMN     "km_pack_price_truck" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "is_truck" BOOLEAN NOT NULL DEFAULT false;
