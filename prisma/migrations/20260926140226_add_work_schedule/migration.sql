-- CreateEnum
CREATE TYPE "ShiftType" AS ENUM ('morning', 'afternoon', 'split', 'on_call');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "has_schedule" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "shift_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "shift" "ShiftType" NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_changes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "from_shift" "ShiftType",
    "to_shift" "ShiftType",
    "changed_by_id" TEXT,
    "changed_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shift_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "shift_assignments_date_idx" ON "shift_assignments"("date");

-- CreateIndex
CREATE UNIQUE INDEX "shift_assignments_user_id_date_key" ON "shift_assignments"("user_id", "date");

-- CreateIndex
CREATE INDEX "shift_changes_created_at_idx" ON "shift_changes"("created_at");

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_changes" ADD CONSTRAINT "shift_changes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_changes" ADD CONSTRAINT "shift_changes_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
