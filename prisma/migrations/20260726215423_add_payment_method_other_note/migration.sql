-- AlterTable
ALTER TABLE "cash_movements" ADD COLUMN     "payment_method_note" TEXT;

-- AlterTable
ALTER TABLE "payment_methods" ADD COLUMN     "requires_note" BOOLEAN NOT NULL DEFAULT false;

-- Medio de pago catch-all "Otro", al final de la lista: para pagos que no
-- encajan en ningún medio ya configurado (`requires_note` pide indicar a
-- dónde fue, en la entrega y en Caja). Idempotente: no duplica si ya existe.
INSERT INTO "payment_methods" ("id", "name", "requires_note", "ordering", "active", "created_at", "updated_at")
SELECT 'seed-payment-method-other', 'Otro', true,
       COALESCE((SELECT MAX("ordering") FROM "payment_methods"), 0) + 1,
       true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "payment_methods" WHERE "name" = 'Otro');
