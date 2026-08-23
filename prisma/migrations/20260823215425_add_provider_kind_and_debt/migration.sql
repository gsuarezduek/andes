-- CreateEnum
CREATE TYPE "ThirdPartyKind" AS ENUM ('employee', 'provider');

-- AlterEnum
ALTER TYPE "CashMovementType" ADD VALUE 'debt';

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "third_party_kind" "ThirdPartyKind";
