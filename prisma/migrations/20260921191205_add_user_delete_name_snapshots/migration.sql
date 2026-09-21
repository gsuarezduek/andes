-- Permite borrar un usuario (ya inactivo) sin romper por una relación
-- obligatoria (inspecciones firmadas, auditoría de condiciones) y sin perder
-- el nombre que ya se mostraba en cada interacción (notas, tareas, caja,
-- daños, whatsapp): cada "*_id" pasa a ser opcional con ON DELETE SET NULL,
-- y cada "*_name" congela el nombre del usuario al momento del hecho.

-- DropForeignKey
ALTER TABLE "condition_settings_edits" DROP CONSTRAINT "condition_settings_edits_edited_by_id_fkey";

-- DropForeignKey
ALTER TABLE "inspections" DROP CONSTRAINT "inspections_user_id_fkey";

-- AlterTable: agregar columnas de nombre, nullable por ahora para poder
-- backfillear desde "users" antes de exigir NOT NULL donde corresponde.
ALTER TABLE "cash_movement_edits" ADD COLUMN     "edited_by_name" TEXT;

ALTER TABLE "cash_movements" ADD COLUMN     "created_by_name" TEXT,
ADD COLUMN     "deleted_by_name" TEXT;

ALTER TABLE "condition_settings_edits" ADD COLUMN     "edited_by_name" TEXT,
ALTER COLUMN "edited_by_id" DROP NOT NULL;

ALTER TABLE "damages" ADD COLUMN     "repaired_by_name" TEXT,
ADD COLUMN     "reported_by_name" TEXT;

ALTER TABLE "inspections" ADD COLUMN     "user_name" TEXT,
ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE "rental_notes" ADD COLUMN     "created_by_name" TEXT,
ADD COLUMN     "resolved_by_name" TEXT;

ALTER TABLE "safe_movement_edits" ADD COLUMN     "edited_by_name" TEXT;

ALTER TABLE "safe_movements" ADD COLUMN     "created_by_name" TEXT,
ADD COLUMN     "deleted_by_name" TEXT;

ALTER TABLE "tasks" ADD COLUMN     "assigned_to_name" TEXT,
ADD COLUMN     "created_by_name" TEXT;

ALTER TABLE "vehicle_notes" ADD COLUMN     "created_by_name" TEXT,
ADD COLUMN     "resolved_by_name" TEXT;

ALTER TABLE "whatsapp_bot_escalations" ADD COLUMN     "resolved_by_name" TEXT;

ALTER TABLE "whatsapp_messages" ADD COLUMN     "sent_by_name" TEXT;

-- Backfill: copiar el nombre actual del usuario a cada fila existente que
-- todavía tiene la FK cargada (las que ya tienen NULL quedan sin nombre,
-- caso preexistente que no podemos reconstruir).
UPDATE "cash_movement_edits" m SET "edited_by_name" = u."name" FROM "users" u WHERE u."id" = m."edited_by_id";
UPDATE "cash_movements" m SET "created_by_name" = u."name" FROM "users" u WHERE u."id" = m."created_by_id";
UPDATE "cash_movements" m SET "deleted_by_name" = u."name" FROM "users" u WHERE u."id" = m."deleted_by_id";
UPDATE "condition_settings_edits" m SET "edited_by_name" = u."name" FROM "users" u WHERE u."id" = m."edited_by_id";
UPDATE "damages" m SET "reported_by_name" = u."name" FROM "users" u WHERE u."id" = m."reported_by_id";
UPDATE "damages" m SET "repaired_by_name" = u."name" FROM "users" u WHERE u."id" = m."repaired_by_id";
UPDATE "inspections" m SET "user_name" = u."name" FROM "users" u WHERE u."id" = m."user_id";
UPDATE "rental_notes" m SET "created_by_name" = u."name" FROM "users" u WHERE u."id" = m."created_by_id";
UPDATE "rental_notes" m SET "resolved_by_name" = u."name" FROM "users" u WHERE u."id" = m."resolved_by_id";
UPDATE "safe_movement_edits" m SET "edited_by_name" = u."name" FROM "users" u WHERE u."id" = m."edited_by_id";
UPDATE "safe_movements" m SET "created_by_name" = u."name" FROM "users" u WHERE u."id" = m."created_by_id";
UPDATE "safe_movements" m SET "deleted_by_name" = u."name" FROM "users" u WHERE u."id" = m."deleted_by_id";
UPDATE "tasks" m SET "assigned_to_name" = u."name" FROM "users" u WHERE u."id" = m."assigned_to_id";
UPDATE "tasks" m SET "created_by_name" = u."name" FROM "users" u WHERE u."id" = m."created_by_id";
UPDATE "vehicle_notes" m SET "created_by_name" = u."name" FROM "users" u WHERE u."id" = m."created_by_id";
UPDATE "vehicle_notes" m SET "resolved_by_name" = u."name" FROM "users" u WHERE u."id" = m."resolved_by_id";
UPDATE "whatsapp_bot_escalations" m SET "resolved_by_name" = u."name" FROM "users" u WHERE u."id" = m."resolved_by_id";
UPDATE "whatsapp_messages" m SET "sent_by_name" = u."name" FROM "users" u WHERE u."id" = m."sent_by_id";

-- Filas huérfanas (creator ya null antes de esta migración, ej. import
-- automático de VikRentCar en cash_movements): les toca un fallback fijo en
-- vez de dejarlas NOT NULL sin dato. El resto de las tablas exige NOT NULL
-- porque siempre tuvieron un autor real al crearse.
UPDATE "cash_movements" SET "created_by_name" = 'Web (VikRentCar)' WHERE "created_by_id" IS NULL AND "created_by_name" IS NULL;
UPDATE "condition_settings_edits" SET "edited_by_name" = 'Desconocido' WHERE "edited_by_name" IS NULL;
UPDATE "inspections" SET "user_name" = 'Desconocido' WHERE "user_name" IS NULL;
UPDATE "rental_notes" SET "created_by_name" = 'Desconocido' WHERE "created_by_name" IS NULL;
UPDATE "tasks" SET "created_by_name" = 'Desconocido' WHERE "created_by_name" IS NULL;
UPDATE "vehicle_notes" SET "created_by_name" = 'Desconocido' WHERE "created_by_name" IS NULL;

-- AlterTable: recién ahora exigir NOT NULL donde el modelo lo requiere.
ALTER TABLE "condition_settings_edits" ALTER COLUMN "edited_by_name" SET NOT NULL;
ALTER TABLE "inspections" ALTER COLUMN "user_name" SET NOT NULL;
ALTER TABLE "rental_notes" ALTER COLUMN "created_by_name" SET NOT NULL;
ALTER TABLE "tasks" ALTER COLUMN "created_by_name" SET NOT NULL;
ALTER TABLE "vehicle_notes" ALTER COLUMN "created_by_name" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "condition_settings_edits" ADD CONSTRAINT "condition_settings_edits_edited_by_id_fkey" FOREIGN KEY ("edited_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
