-- AlterTable
ALTER TABLE "users" ADD COLUMN     "owner" BOOLEAN NOT NULL DEFAULT false;

-- Propietario del sistema.
UPDATE "users" SET "owner" = true WHERE lower("email") = 'g.suarezduek@gmail.com';
