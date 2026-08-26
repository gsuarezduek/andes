-- CreateTable
CREATE TABLE "season_rates" (
    "id" TEXT NOT NULL,
    "from_seconds" INTEGER NOT NULL,
    "to_seconds" INTEGER NOT NULL,
    "year" INTEGER,
    "diff_percent" DECIMAL(6,2) NOT NULL,
    "car_ids" INTEGER[],
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "season_rates_pkey" PRIMARY KEY ("id")
);
