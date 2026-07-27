-- CreateEnum
CREATE TYPE "CashMovementEditAction" AS ENUM ('updated', 'deleted');

-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "deleted_by_id" TEXT;

-- CreateTable
CREATE TABLE "cash_movement_edits" (
    "id" TEXT NOT NULL,
    "cash_movement_id" TEXT NOT NULL,
    "action" "CashMovementEditAction" NOT NULL,
    "changes" JSONB,
    "edited_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movement_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_movement_edits_cash_movement_id_idx" ON "cash_movement_edits"("cash_movement_id");

-- CreateIndex
CREATE INDEX "cash_movement_edits_created_at_idx" ON "cash_movement_edits"("created_at");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement_edits" ADD CONSTRAINT "cash_movement_edits_cash_movement_id_fkey" FOREIGN KEY ("cash_movement_id") REFERENCES "cash_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement_edits" ADD CONSTRAINT "cash_movement_edits_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
