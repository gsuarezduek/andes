-- CreateTable
CREATE TABLE "special_dates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_by_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "special_dates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "special_dates_date_idx" ON "special_dates"("date");

-- CreateIndex
CREATE UNIQUE INDEX "special_dates_date_key" ON "special_dates"("date");

-- AddForeignKey
ALTER TABLE "special_dates" ADD CONSTRAINT "special_dates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
