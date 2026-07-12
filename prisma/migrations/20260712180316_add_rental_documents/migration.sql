-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('license', 'dni', 'passport');

-- CreateTable
CREATE TABLE "rental_documents" (
    "id" TEXT NOT NULL,
    "rental_id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "url" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rental_documents_rental_id_idx" ON "rental_documents"("rental_id");

-- AddForeignKey
ALTER TABLE "rental_documents" ADD CONSTRAINT "rental_documents_rental_id_fkey" FOREIGN KEY ("rental_id") REFERENCES "rentals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_documents" ADD CONSTRAINT "rental_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
