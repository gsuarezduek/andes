// Sincroniza el checklist con la lista canónica del contrato, sin borrar datos.
// Los ítems que no están en la lista quedan inactivos (no se borran, por si hay
// inspecciones que los referencian). Idempotente.
// Run local:  node --env-file=.env prisma/sync-checklist.mjs
// Run prod:   DATABASE_URL="<DATABASE_PUBLIC_URL>" node prisma/sync-checklist.mjs
import { PrismaClient } from "@prisma/client";
import { CHECKLIST_LABELS } from "./seed.mjs";

const prisma = new PrismaClient();
const canonical = new Set(CHECKLIST_LABELS);

const existing = await prisma.checklistItem.findMany();
const byLabel = new Map(existing.map((i) => [i.label, i]));

// Desactivar los que no son canónicos.
let deactivated = 0;
for (const item of existing) {
  if (!canonical.has(item.label) && item.active) {
    await prisma.checklistItem.update({ where: { id: item.id }, data: { active: false } });
    deactivated++;
  }
}

// Asegurar los canónicos, en orden.
let created = 0;
let updated = 0;
for (let i = 0; i < CHECKLIST_LABELS.length; i++) {
  const label = CHECKLIST_LABELS[i];
  const found = byLabel.get(label);
  if (found) {
    await prisma.checklistItem.update({
      where: { id: found.id },
      data: { active: true, ordering: i + 1 },
    });
    updated++;
  } else {
    await prisma.checklistItem.create({ data: { label, ordering: i + 1, active: true } });
    created++;
  }
}

console.log(`checklist sincronizado: creados=${created} actualizados=${updated} desactivados=${deactivated}`);
await prisma.$disconnect();
