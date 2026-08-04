-- CreateEnum
CREATE TYPE "SafeMovementType" AS ENUM ('deposit', 'withdrawal');

-- CreateEnum
CREATE TYPE "SafeMovementEditAction" AS ENUM ('updated', 'deleted');

-- CreateTable
CREATE TABLE "safe_movements" (
    "id" TEXT NOT NULL,
    "type" "SafeMovementType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "created_by_id" TEXT,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safe_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "safe_movement_edits" (
    "id" TEXT NOT NULL,
    "safe_movement_id" TEXT NOT NULL,
    "action" "SafeMovementEditAction" NOT NULL,
    "changes" JSONB,
    "edited_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safe_movement_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "safe_movements_created_at_idx" ON "safe_movements"("created_at");

-- CreateIndex
CREATE INDEX "safe_movements_created_by_id_idx" ON "safe_movements"("created_by_id");

-- CreateIndex
CREATE INDEX "safe_movement_edits_safe_movement_id_idx" ON "safe_movement_edits"("safe_movement_id");

-- CreateIndex
CREATE INDEX "safe_movement_edits_created_at_idx" ON "safe_movement_edits"("created_at");

-- AddForeignKey
ALTER TABLE "safe_movements" ADD CONSTRAINT "safe_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safe_movements" ADD CONSTRAINT "safe_movements_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safe_movement_edits" ADD CONSTRAINT "safe_movement_edits_safe_movement_id_fkey" FOREIGN KEY ("safe_movement_id") REFERENCES "safe_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safe_movement_edits" ADD CONSTRAINT "safe_movement_edits_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
