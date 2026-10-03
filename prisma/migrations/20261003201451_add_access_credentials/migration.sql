-- CreateEnum
CREATE TYPE "AccessCredentialField" AS ENUM ('password', 'extra');

-- CreateTable
CREATE TABLE "access_credentials" (
    "id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "username" TEXT,
    "password_enc" TEXT,
    "extra_enc" TEXT,
    "admin_only" BOOLEAN NOT NULL DEFAULT false,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,
    "updated_by_id" TEXT,
    "updated_by_name" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "access_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "access_credential_reveals" (
    "id" TEXT NOT NULL,
    "access_credential_id" TEXT NOT NULL,
    "field" "AccessCredentialField" NOT NULL,
    "user_id" TEXT,
    "user_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_credential_reveals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "access_credential_reveals_access_credential_id_idx" ON "access_credential_reveals"("access_credential_id");

-- AddForeignKey
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_credentials" ADD CONSTRAINT "access_credentials_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_credential_reveals" ADD CONSTRAINT "access_credential_reveals_access_credential_id_fkey" FOREIGN KEY ("access_credential_id") REFERENCES "access_credentials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "access_credential_reveals" ADD CONSTRAINT "access_credential_reveals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
