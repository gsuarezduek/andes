-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "category_name" TEXT;

-- CreateTable
CREATE TABLE "cash_movement_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ordering" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_movement_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cash_movements_category_id_idx" ON "cash_movements"("category_id");

-- AddForeignKey
ALTER TABLE "cash_movements" ADD CONSTRAINT "cash_movements_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "cash_movement_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
