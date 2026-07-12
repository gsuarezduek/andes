# Tests — Andes

Runner: **Vitest** (`vitest.config.ts`). Los tests viven junto al código en `src/**/__tests__/*.test.ts`.

```
npm test          # corrida única (CI)
npm run test:watch
```

## Qué se cubre (Fase 7)

Lógica pura y flujos críticos con Prisma mockeado — sin base de datos, rápido y determinista:

- **`comparison.test.ts`** — `computeComparison` (km recorridos, diff de nafta, daños nuevos). Es la lógica que consume el paso "Comparación" del wizard y el acta de devolución.
- **`contract.test.ts`** — `extraHourAmount` (importe de hora extra por % de la tarifa) y `formatArs`.
- **`datetime.test.ts`** — `mendozaWallTimeToUtc` (hora de pared Mendoza → UTC), `formatDateInput`, `fromUnixSeconds` (timestamps VikRentCar).
- **`i18n.test.ts`** — `resolveLocale`/`isLocale` y **paridad de claves** entre los diccionarios `es` y `en` (red para extender inglés a toda la app — Fase 12).
- **`save-flows.test.ts`** — `saveHandover`/`saveReturn` con `prisma`, `requireUser` y el acta mockeados: creación de la inspección, transición de estados (rental → active/finished, vehicle → rented/available, km) y los guards de inmutabilidad (no reingresar entrega/devolución, km de devolución ≥ km de entrega).

## Convención

- Mockear `@/lib/prisma`, `@/lib/auth-helpers`, `@/lib/acta` y `next/cache`/`next/server` con `vi.mock` + `vi.hoisted`.
- Preferir **lógica pura testeable**: cuando una regla de negocio esté inline en un componente o server action, extraerla a `src/lib/*.ts` (como se hizo con `comparison.ts`).

## Diferido (suite de integración opcional)

- **Render del acta PDF** (`renderActaBuffer`): requiere levantar `@react-pdf/renderer` con fuentes; se probó manualmente y su cálculo de comparación ya está cubierto por `comparison.test.ts`. Para una suite de integración real conviene un Postgres de prueba (`DATABASE_URL` a una base descartable) y correr `saveHandover`→`renderActaBuffer` end-to-end.
