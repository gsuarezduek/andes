# Andes — MDZ Rent a Car

Sistema interno de **entregas y devoluciones** de autos de alquiler de MDZ Rent a
Car (Mendoza, Argentina). Los empleados registran el estado del vehículo desde el
celular (checklist, kilometraje, nafta, daños, fotos y **firma del cliente**),
se genera un **acta PDF** y se compara automáticamente la devolución contra la
entrega.

- Especificación completa: [`PROYECTO-ANDES.md`](./PROYECTO-ANDES.md) (fuente de verdad).
- Guía para trabajar en el repo: [`CLAUDE.md`](./CLAUDE.md).
- Mapeo con VikRentCar (WordPress): [`docs/wordpress-mapping.md`](./docs/wordpress-mapping.md).

## Stack

Next.js (App Router) + TypeScript estricto · PostgreSQL + Prisma · Tailwind CSS ·
PWA · Cloudflare R2 (archivos) · Resend (emails) · `@react-pdf/renderer` (actas) ·
Auth.js (roles admin/empleado) · sync read-only con VikRentCar vía `mysql2`.

## Puesta en marcha local

```bash
npm install
cp .env.example .env      # completar al menos DATABASE_URL
npx prisma generate       # (el postinstall ya lo corre)
npm run dev               # http://localhost:3000
```

> El modelo de datos completo y las migraciones llegan en la **Fase 1**. En la
> Fase 0 el `schema.prisma` solo define el datasource; no hace falta una base
> corriendo para levantar la UI.

## Comandos

```bash
npm run dev          # desarrollo local
npm run build        # build de producción
npm run lint         # ESLint
npm run db:migrate   # prisma migrate dev
npm run db:deploy    # prisma migrate deploy (producción)
npm run db:studio    # prisma studio
```

## Estado

**Fase 0 — Fundaciones** en curso. Base del proyecto lista (Next.js, Prisma,
Tailwind, PWA, i18n es/en, helpers de zona horaria Mendoza, `.env.example`,
mapeo de VikRentCar documentado). Pendiente de accesos del dueño: verificación
del esquema real de VikRentCar, deploy a Railway y subdominio
`andes.mdzrentacar.com`. Ver el detalle en `CLAUDE.md` → "Estado actual".

## Convenciones

- Código/variables/tablas/commits en **inglés**; UI de empleados en **español (AR)**.
- Contenido de cara al cliente (acta, emails, firma) bilingüe **es/en** por
  alquiler, desde diccionarios i18n — nunca hardcodeado.
- Fechas: guardar en **UTC**, mostrar en **America/Argentina/Mendoza**.
- Contra WordPress: **solo `SELECT`**.
- Inspecciones firmadas: **inmutables**.
