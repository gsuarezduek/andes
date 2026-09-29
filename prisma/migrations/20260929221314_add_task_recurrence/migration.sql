-- CreateEnum
CREATE TYPE "RecurrenceFreq" AS ENUM ('daily', 'weekly', 'monthly', 'yearly');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "recurrence_id" TEXT;

-- CreateTable
CREATE TABLE "task_recurrences" (
    "id" TEXT NOT NULL,
    "freq" "RecurrenceFreq" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "weekday" INTEGER,
    "day_of_month" INTEGER,
    "month" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "text" TEXT NOT NULL,
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "assigned_to_id" TEXT,
    "assigned_to_name" TEXT,
    "vehicle_id" TEXT,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tasks_recurrence_id_idx" ON "tasks"("recurrence_id");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "task_recurrences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_recurrences" ADD CONSTRAINT "task_recurrences_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_recurrences" ADD CONSTRAINT "task_recurrences_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_recurrences" ADD CONSTRAINT "task_recurrences_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
