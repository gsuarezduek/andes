-- CreateEnum
CREATE TYPE "CashChangeRequestKind" AS ENUM ('update', 'delete');

-- CreateEnum
CREATE TYPE "CashChangeRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- AlterTable
ALTER TABLE "cash_movement_edits" ADD COLUMN     "approved_by_name" TEXT;

-- CreateTable
CREATE TABLE "cash_movement_change_requests" (
    "id" TEXT NOT NULL,
    "cash_movement_id" TEXT NOT NULL,
    "kind" "CashChangeRequestKind" NOT NULL,
    "status" "CashChangeRequestStatus" NOT NULL DEFAULT 'pending',
    "proposed" JSONB,
    "changes" JSONB,
    "note" TEXT,
    "requested_by_id" TEXT,
    "requested_by_name" TEXT NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "resolved_by_id" TEXT,
    "resolved_by_name" TEXT,
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_movement_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_movement_change_requests_status_idx" ON "cash_movement_change_requests"("status");

-- CreateIndex
CREATE INDEX "cash_movement_change_requests_cash_movement_id_idx" ON "cash_movement_change_requests"("cash_movement_id");

-- CreateIndex
CREATE INDEX "cash_movement_change_requests_requested_by_id_idx" ON "cash_movement_change_requests"("requested_by_id");

-- AddForeignKey
ALTER TABLE "cash_movement_change_requests" ADD CONSTRAINT "cash_movement_change_requests_cash_movement_id_fkey" FOREIGN KEY ("cash_movement_id") REFERENCES "cash_movements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement_change_requests" ADD CONSTRAINT "cash_movement_change_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_movement_change_requests" ADD CONSTRAINT "cash_movement_change_requests_resolved_by_id_fkey" FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
