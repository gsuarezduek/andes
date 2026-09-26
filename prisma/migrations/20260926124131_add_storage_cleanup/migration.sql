-- AlterTable
ALTER TABLE "whatsapp_media" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "storage_cleanup_runs" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "date_from" TIMESTAMP(3) NOT NULL,
    "date_to" TIMESTAMP(3) NOT NULL,
    "categories" TEXT[],
    "plan" JSONB,
    "file_count" INTEGER NOT NULL,
    "done_count" INTEGER NOT NULL DEFAULT 0,
    "changed_count" INTEGER NOT NULL DEFAULT 0,
    "bytes_freed" BIGINT NOT NULL DEFAULT 0,
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "storage_cleanup_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deleted_files" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "run_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deleted_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_exports" (
    "id" TEXT NOT NULL,
    "plan_hash" TEXT NOT NULL,
    "part" INTEGER NOT NULL,
    "parts" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,

    CONSTRAINT "storage_exports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "storage_cleanup_runs_created_at_idx" ON "storage_cleanup_runs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "deleted_files_storage_key_key" ON "deleted_files"("storage_key");

-- CreateIndex
CREATE INDEX "storage_exports_plan_hash_idx" ON "storage_exports"("plan_hash");

-- AddForeignKey
ALTER TABLE "storage_cleanup_runs" ADD CONSTRAINT "storage_cleanup_runs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deleted_files" ADD CONSTRAINT "deleted_files_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "storage_cleanup_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_exports" ADD CONSTRAINT "storage_exports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
