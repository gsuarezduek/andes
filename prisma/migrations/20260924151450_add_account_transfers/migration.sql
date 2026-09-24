-- CreateTable
CREATE TABLE "account_transfers" (
    "id" TEXT NOT NULL,
    "from_account_id" TEXT NOT NULL,
    "from_account_name" TEXT NOT NULL,
    "from_amount" DECIMAL(12,2) NOT NULL,
    "from_currency" "Currency" NOT NULL,
    "to_account_id" TEXT NOT NULL,
    "to_account_name" TEXT NOT NULL,
    "to_amount" DECIMAL(12,2) NOT NULL,
    "to_currency" "Currency" NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "deleted_by_name" TEXT,
    "delete_note" TEXT,

    CONSTRAINT "account_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_transfers_created_at_idx" ON "account_transfers"("created_at");

-- CreateIndex
CREATE INDEX "account_transfers_from_account_id_idx" ON "account_transfers"("from_account_id");

-- CreateIndex
CREATE INDEX "account_transfers_to_account_id_idx" ON "account_transfers"("to_account_id");

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_from_account_id_fkey" FOREIGN KEY ("from_account_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transfers" ADD CONSTRAINT "account_transfers_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
