/*
  Warnings:

  - You are about to drop the column `reports_excluded_at` on the `rentals` table. All the data in the column will be lost.
  - You are about to drop the column `reports_excluded_by_name` on the `rentals` table. All the data in the column will be lost.
  - You are about to drop the column `reports_excluded_reason` on the `rentals` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "rentals" DROP COLUMN "reports_excluded_at",
DROP COLUMN "reports_excluded_by_name",
DROP COLUMN "reports_excluded_reason";
