-- AlterTable
ALTER TABLE "task_recurrences" ADD COLUMN     "scheduled_time" TEXT;

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "scheduled_time" TEXT;
