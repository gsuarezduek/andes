-- CreateEnum
CREATE TYPE "CompetitorPriceStatus" AS ENUM ('verified', 'auto_found', 'needs_review', 'unavailable');

-- CreateEnum
CREATE TYPE "CompetitorRunTrigger" AS ENUM ('manual', 'cron');

-- AlterTable
ALTER TABLE "vehicles" ADD COLUMN     "competitor_category_id" TEXT;

-- CreateTable
CREATE TABLE "competitors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "adapter_key" TEXT NOT NULL,
    "config" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_categories" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "competitor_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_category_mappings" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "raw_label" TEXT NOT NULL,
    "suggested_category_id" TEXT,
    "category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_category_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_price_checks" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "category_id" TEXT,
    "raw_label" TEXT,
    "price" DECIMAL(12,2),
    "currency" "Currency",
    "checked_at" TIMESTAMP(3) NOT NULL,
    "pickup_date" DATE NOT NULL,
    "return_date" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "includes_tax" BOOLEAN,
    "includes_insurance" BOOLEAN,
    "conditions_note" TEXT,
    "source_url" TEXT,
    "status" "CompetitorPriceStatus" NOT NULL,
    "error_reason" TEXT,
    "llm_citation" TEXT,
    "run_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_price_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_current_prices" (
    "id" TEXT NOT NULL,
    "competitor_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "pickup_offset_days" INTEGER NOT NULL,
    "price_check_id" TEXT NOT NULL,
    "last_checked_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_current_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_check_runs" (
    "id" TEXT NOT NULL,
    "triggered_by" "CompetitorRunTrigger" NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),
    "result" "SyncResult",
    "competitors_checked" INTEGER NOT NULL DEFAULT 0,
    "prices_found" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competitor_check_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_price_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "offsets_days" INTEGER[] DEFAULT ARRAY[0, 30, 60]::INTEGER[],
    "rental_duration_days" INTEGER NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_price_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "competitor_categories_label_key" ON "competitor_categories"("label");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_category_mappings_competitor_id_raw_label_key" ON "competitor_category_mappings"("competitor_id", "raw_label");

-- CreateIndex
CREATE INDEX "competitor_price_checks_competitor_id_category_id_pickup_da_idx" ON "competitor_price_checks"("competitor_id", "category_id", "pickup_date");

-- CreateIndex
CREATE INDEX "competitor_price_checks_run_id_idx" ON "competitor_price_checks"("run_id");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_current_prices_price_check_id_key" ON "competitor_current_prices"("price_check_id");

-- CreateIndex
CREATE UNIQUE INDEX "competitor_current_prices_competitor_id_category_id_pickup__key" ON "competitor_current_prices"("competitor_id", "category_id", "pickup_offset_days");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_competitor_category_id_fkey" FOREIGN KEY ("competitor_category_id") REFERENCES "competitor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_category_mappings" ADD CONSTRAINT "competitor_category_mappings_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "competitors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_category_mappings" ADD CONSTRAINT "competitor_category_mappings_suggested_category_id_fkey" FOREIGN KEY ("suggested_category_id") REFERENCES "competitor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_category_mappings" ADD CONSTRAINT "competitor_category_mappings_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "competitor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_price_checks" ADD CONSTRAINT "competitor_price_checks_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "competitors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_price_checks" ADD CONSTRAINT "competitor_price_checks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "competitor_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_price_checks" ADD CONSTRAINT "competitor_price_checks_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "competitor_check_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_current_prices" ADD CONSTRAINT "competitor_current_prices_competitor_id_fkey" FOREIGN KEY ("competitor_id") REFERENCES "competitors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_current_prices" ADD CONSTRAINT "competitor_current_prices_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "competitor_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitor_current_prices" ADD CONSTRAINT "competitor_current_prices_price_check_id_fkey" FOREIGN KEY ("price_check_id") REFERENCES "competitor_price_checks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
