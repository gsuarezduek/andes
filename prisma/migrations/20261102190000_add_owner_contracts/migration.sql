-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "owner_address" TEXT,
ADD COLUMN     "owner_doc_number" TEXT,
ADD COLUMN     "owner_email" TEXT;

-- CreateTable
CREATE TABLE "owner_contract_versions" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "owner_contract_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_contracts" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "vehicle_id" TEXT NOT NULL,
    "version_id" TEXT,
    "place" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "owner_name" TEXT NOT NULL,
    "owner_doc_number" TEXT NOT NULL,
    "owner_address" TEXT NOT NULL,
    "owner_email" TEXT,
    "owner_phone" TEXT,
    "vehicle_brand" TEXT NOT NULL,
    "vehicle_model" TEXT NOT NULL,
    "vehicle_year" INTEGER,
    "vehicle_plate" TEXT NOT NULL,
    "insurance_company" TEXT,
    "insurance_policy_number" TEXT,
    "commercial_terms" TEXT,
    "km" INTEGER NOT NULL,
    "fuel_level" INTEGER NOT NULL,
    "fuel_levels" INTEGER NOT NULL,
    "condition" JSONB NOT NULL,
    "observations" TEXT,
    "company_signer_name" TEXT NOT NULL,
    "company_signature_key" TEXT NOT NULL,
    "owner_signer_name" TEXT NOT NULL,
    "owner_signature_key" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voided_at" TIMESTAMP(3),
    "voided_reason" TEXT,
    "voided_by_name" TEXT,
    "email_status" TEXT,
    "email_error" TEXT,
    "email_sent_at" TIMESTAMP(3),

    CONSTRAINT "owner_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "owner_contract_versions_created_at_idx" ON "owner_contract_versions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "owner_contracts_number_key" ON "owner_contracts"("number");

-- CreateIndex
CREATE INDEX "owner_contracts_vehicle_id_ends_at_idx" ON "owner_contracts"("vehicle_id", "ends_at");

-- AddForeignKey
ALTER TABLE "owner_contract_versions" ADD CONSTRAINT "owner_contract_versions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_contracts" ADD CONSTRAINT "owner_contracts_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_contracts" ADD CONSTRAINT "owner_contracts_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "owner_contract_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_contracts" ADD CONSTRAINT "owner_contracts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

