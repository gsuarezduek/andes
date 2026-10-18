-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'finanzas';
ALTER TYPE "UserRole" ADD VALUE 'observador';

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "finance_only" BOOLEAN NOT NULL DEFAULT false;
