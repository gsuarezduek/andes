-- CreateEnum
CREATE TYPE "PermitEditAction" AS ENUM ('updated', 'deleted');

-- CreateTable
CREATE TABLE "permits" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "rental_id" TEXT NOT NULL,
    "form_number" TEXT NOT NULL,
    "expires_at" DATE NOT NULL,
    "file_url" TEXT,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_id" TEXT,
    "deleted_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permit_edits" (
    "id" TEXT NOT NULL,
    "permit_id" TEXT NOT NULL,
    "action" "PermitEditAction" NOT NULL,
    "changes" JSONB,
    "edited_by_id" TEXT,
    "edited_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permit_edits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "permits_number_key" ON "permits"("number");

-- CreateIndex
CREATE INDEX "permits_rental_id_idx" ON "permits"("rental_id");

-- CreateIndex
CREATE INDEX "permits_created_at_idx" ON "permits"("created_at");

-- CreateIndex
CREATE INDEX "permit_edits_permit_id_idx" ON "permit_edits"("permit_id");

-- CreateIndex
CREATE INDEX "permit_edits_created_at_idx" ON "permit_edits"("created_at");

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permits" ADD CONSTRAINT "permits_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_edits" ADD CONSTRAINT "permit_edits_permit_id_fkey" FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permit_edits" ADD CONSTRAINT "permit_edits_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
