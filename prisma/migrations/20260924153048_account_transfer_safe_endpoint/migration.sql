-- DropForeignKey
ALTER TABLE "account_transfers" DROP CONSTRAINT "account_transfers_from_account_id_fkey";

-- DropForeignKey
ALTER TABLE "account_transfers" DROP CONSTRAINT "account_transfers_to_account_id_fkey";

-- AlterTable
ALTER TABLE "account_transfers" ALTER COLUMN "from_account_id" DROP NOT NULL,
ALTER COLUMN "to_account_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "payment_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
