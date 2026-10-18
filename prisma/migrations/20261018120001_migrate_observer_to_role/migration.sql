-- DataMigration: el checkbox "Observador" pasa a ser el rol "observador" —
-- conserva el acceso de nivel admin que ya tenía (ver CLAUDE.md, el checkbox
-- decía "entra con permisos de su rol, típicamente admin").
UPDATE "users" SET "role" = 'observador' WHERE "observer" = true;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "observer";
