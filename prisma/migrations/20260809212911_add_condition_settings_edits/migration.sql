-- CreateTable
CREATE TABLE "condition_settings_edits" (
    "id" TEXT NOT NULL,
    "changes" JSONB NOT NULL,
    "edited_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "condition_settings_edits_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "condition_settings_edits" ADD CONSTRAINT "condition_settings_edits_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

