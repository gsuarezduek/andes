-- CreateTable
CREATE TABLE "usd_rates" (
    "id" TEXT NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usd_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usd_rates_created_at_idx" ON "usd_rates"("created_at");
