-- CreateEnum
CREATE TYPE "PaymentMethodOwnership" AS ENUM ('own', 'third_party');

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "ownership" "PaymentMethodOwnership" NOT NULL DEFAULT 'own';
