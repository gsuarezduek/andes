-- AlterTable
ALTER TABLE "inspections" ADD COLUMN     "contract_version_id" TEXT;

-- CreateTable
CREATE TABLE "contract_versions" (
    "id" TEXT NOT NULL,
    "es_title" TEXT NOT NULL,
    "es_body" TEXT NOT NULL,
    "en_title" TEXT NOT NULL,
    "en_body" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contract_versions_created_at_idx" ON "contract_versions"("created_at");

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_contract_version_id_fkey" FOREIGN KEY ("contract_version_id") REFERENCES "contract_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_versions" ADD CONSTRAINT "contract_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
