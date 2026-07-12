-- CreateEnum
CREATE TYPE "SignatureRequestStatus" AS ENUM ('pending', 'signed', 'expired', 'cancelled');

-- CreateTable
CREATE TABLE "signature_requests" (
    "id" TEXT NOT NULL,
    "draft_id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "language" "Language" NOT NULL DEFAULT 'es',
    "summary" JSONB,
    "signer_name" TEXT,
    "signature_key" TEXT,
    "status" "SignatureRequestStatus" NOT NULL DEFAULT 'pending',
    "created_by_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "signature_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "signature_requests_rental_id_idx" ON "signature_requests"("rental_id");

-- AddForeignKey
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signature_requests" ADD CONSTRAINT "signature_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
