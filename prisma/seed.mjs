// Seed de datos de prueba (Fase 1). Idempotente.
// Run: npm run db:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEV_PASSWORD = "andes1234"; // solo para desarrollo — cambiar en producción.

// Usuarios ---------------------------------------------------------------
async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);
  const users = [
    { name: "Administrador", email: "admin@mdzrentacar.com", role: "admin" },
    { name: "Empleado Demo", email: "empleado@mdzrentacar.com", role: "empleado" },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role },
      create: { ...u, passwordHash },
    });
  }
  console.log(`✔ usuarios: ${users.length} (pass dev: ${DEV_PASSWORD})`);
}

// Checklist configurable — ítems del contrato vigente (23) -----------------
export const CHECKLIST_LABELS = [
  "Lavado y aspirado",
  "Nivel de combustible: mismo nivel o superior",
  "Tablero sin testigos de alerta",
  "Arranque correcto",
  "Llave y cerradura en correcto funcionamiento",
  "Seguro vigente",
  "Tarjeta verde",
  "Documentación completa en guantera",
  "Kit de seguridad completo",
  "Gato y llave cruz en baúl",
  "Tuerca de seguridad",
  "Exterior filmado / fotografías tomadas",
  "Sin daños por granizo",
  "Vidrios en buen estado",
  "Ópticas delanteras y traseras OK",
  "Luces probadas (altas, bajas, giro, stop)",
  "Cubiertas en buen estado",
  "Espejos exteriores OK",
  "Plásticos interiores en buen estado",
  "Tapizados en buen estado",
  "Alfombras completas y limpias",
  "Levanta cristales funcionando",
  "Perfume / accesorios completos",
];

async function seedChecklist() {
  const labels = CHECKLIST_LABELS;
  if ((await prisma.checklistItem.count()) === 0) {
    await prisma.checklistItem.createMany({
      data: labels.map((label, i) => ({ label, ordering: i + 1 })),
    });
    console.log(`✔ checklist_items: ${labels.length}`);
  } else {
    console.log("• checklist_items ya existían, se omite");
  }
}

// Flota — 14 modelos / 18 unidades de wp_vikrentcar_cars ------------------
// wpCarId = idcar del plugin; wpCarIndex = 1..units. Patentes placeholder.
const FLEET = [
  { wpCarId: 4, brand: "Fiat", model: "Cronos Full", units: 2 },
  { wpCarId: 5, brand: "Fiat", model: "Cronos Base", units: 1 },
  { wpCarId: 7, brand: "Renault", model: "Sandero 1.6", units: 1 },
  { wpCarId: 8, brand: "Chevrolet", model: "Onix 1.4", units: 1 },
  { wpCarId: 15, brand: "Toyota", model: "Etios Automático", units: 1 },
  { wpCarId: 16, brand: "Renault", model: "Logan Life 1.6", units: 1 },
  { wpCarId: 17, brand: "Renault", model: "Stepway Automática", units: 1 },
  { wpCarId: 19, brand: "Renault", model: "Kwid Zen 1.0", units: 1 },
  { wpCarId: 20, brand: "Jeep", model: "Renegade", units: 1 },
  { wpCarId: 21, brand: "Renault", model: "Kwid Iconic 1.0", units: 4 },
  { wpCarId: 23, brand: "Volkswagen", model: "Tera", units: 1 },
  { wpCarId: 24, brand: "Fiat", model: "Cronos o Similar", units: 1 },
  { wpCarId: 25, brand: "Chevrolet", model: "Spin Premier Automática 2025", units: 1 },
  { wpCarId: 26, brand: "Volkswagen", model: "Polo 1.0 Automático 2026", units: 1 },
];

async function seedVehicles() {
  let n = 0;
  let plateSeq = 1;
  for (const car of FLEET) {
    for (let index = 1; index <= car.units; index++) {
      const plate = `TEMP${String(plateSeq++).padStart(3, "0")}`;
      await prisma.vehicle.upsert({
        where: { wpCarId_wpCarIndex: { wpCarId: car.wpCarId, wpCarIndex: index } },
        update: { brand: car.brand, model: car.model },
        create: {
          plate,
          brand: car.brand,
          model: car.model,
          status: "available",
          currentKm: 0,
          notes: "Patente placeholder — completar en el ABM.",
          wpCarId: car.wpCarId,
          wpCarIndex: index,
        },
      });
      n++;
    }
  }
  console.log(`✔ vehicles: ${n} unidades`);
}

// Alquileres de ejemplo (manuales) --------------------------------------
async function seedRentals() {
  if ((await prisma.rental.count()) > 0) {
    console.log("• rentals ya existían, se omite");
    return;
  }
  const anyVehicle = await prisma.vehicle.findFirst({ orderBy: { plate: "asc" } });
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();

  await prisma.rental.create({
    data: {
      vehicleId: anyVehicle?.id ?? null,
      clientName: "Juan Pérez",
      clientEmail: "juan.perez@example.com",
      clientPhone: "+54 261 555 0100",
      startAt: new Date(now + day),
      endAt: new Date(now + 4 * day),
      origin: "manual",
      language: "es",
      status: "reserved",
    },
  });

  // Reserva sin vehículo asignado (caso frecuente de VikRentCar).
  await prisma.rental.create({
    data: {
      clientName: "Mary Smith",
      clientEmail: "mary.smith@example.com",
      startAt: new Date(now + 2 * day),
      endAt: new Date(now + 6 * day),
      origin: "manual",
      language: "en",
      status: "reserved",
    },
  });

  console.log("✔ rentals: 2 (1 con vehículo, 1 sin unidad asignada)");
}

async function main() {
  await seedUsers();
  await seedChecklist();
  await seedVehicles();
  await seedRentals();
}

// Solo ejecutar el seed cuando se corre directamente (no al importar CHECKLIST_LABELS).
const isDirectRun = import.meta.url === `file://${process.argv[1]}`;
if (isDirectRun) {
  main()
    .then(() => console.log("Seed completo."))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
