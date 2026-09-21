-- AlterTable
ALTER TABLE "rental_quotes" ADD COLUMN     "created_by_name" TEXT;

-- Backfill: mismo criterio que add_user_delete_name_snapshots.
UPDATE "rental_quotes" q SET "created_by_name" = u."name" FROM "users" u WHERE u."id" = q."created_by_id";
