# CLAUDE.md — Proyecto Andes (MDZ Rent a Car)

Sistema interno de entregas y devoluciones de autos de alquiler. El brief original está en `PROYECTO-ANDES.md`: consultarlo cuando la tarea toque alcance de producto o una funcionalidad nueva (no hace falta leerlo para un fix o un ajuste puntual). Si una decisión de implementación contradice el brief, preguntar antes de avanzar.

Este archivo tiene solo lo que aplica a cualquier tarea. **El detalle de cada funcionalidad está en `docs/features/`** (ver "Mapa del historial" abajo): leer el archivo del área antes de tocarla. Para encontrar una versión citada en el código ("ver v34"), buscarla en `docs/features/README.md`.

## Qué es esta app

- Los empleados registran entregas y devoluciones de autos desde el celular: checklist, kilometraje, nafta, daños en croquis, fotos/video opcionales y **firma del cliente en pantalla**.
- Cada movimiento genera un acta PDF que se envía por email al cliente y al administrador.
- La devolución compara automáticamente contra la entrega (km recorridos, nafta, daños nuevos).
- Dashboard de flota + perfil de cada vehículo con historial y mantenimiento.
- Las reservas se importan periódicamente desde el plugin **VikRentCar** del WordPress de la empresa (MySQL en Hostinger, solo lectura).

## Stack

- Next.js (App Router) + TypeScript, estricto.
- PostgreSQL (Railway) + Prisma. Toda modificación de esquema vía migración (`prisma migrate dev`), nunca `db push` en cambios definitivos.
- Tailwind CSS. PWA (manifest + service worker).
- Cloudflare R2 para fotos, videos, firmas y PDFs (S3 SDK). Nada de archivos binarios en la base ni en el filesystem de Railway.
- Resend para emails. `@react-pdf/renderer` para las actas.
- Auth.js con credenciales y roles `admin` / `empleado`.
- Worker de sincronización con las tablas de VikRentCar usando `mysql2` en modo solo lectura.

## Convenciones

- **Código, nombres de variables, tablas y commits en inglés. La UI de empleados en español (Argentina).**
- **Idiomas del contenido para el cliente** (acta PDF, emails, pantalla de firma): español por defecto, conmutable a inglés por alquiler. Cada `rental` tiene un campo `language` (`es`/`en`, default `es`) que se preselecciona desde el campo `lang` de la orden de VikRentCar y el empleado puede cambiar antes de firmar. Todos los strings de cara al cliente van en diccionarios i18n desde el día 1 — nunca hardcodeados — para poder extender el inglés a toda la app más adelante.
- Zona horaria: `America/Argentina/Mendoza` en toda lógica de fechas. Guardar en UTC, mostrar en hora local.
- Kilometraje siempre entero en km. Nivel de nafta como entero 0–8 (octavos de tanque).
- Componentes de UI reutilizables entre entrega y devolución: son el mismo formulario con variantes, no duplicar.
- Las inspecciones firmadas son **inmutables**: no exponer edición ni borrado; correcciones solo como notas de admin.
- Contra la base de WordPress: **solo SELECT**. Jamás escribir, jamás importar el esquema de WP a Prisma.

## Notas sobre VikRentCar

- Tablas con prefijo de WordPress, típicamente `wp_vikrentcar_*`: `orders`, `customers`, `customers_orders`, `cars`, `categories`, `places`, `busy`. Los nombres de columnas derivan del italiano: `ritiro` = retiro/pickup, `consegna` = devolución/drop-off (ambos timestamps Unix).
- Una orden referencia el modelo (`idcar`) y la unidad (`carindex`). Nuestro vehículo físico mapea al par (`idcar`, `carindex`) vía `vehicles.wp_car_id` + `vehicles.wp_car_index`.
- Importar solo órdenes `confirmed` (estado `standby` configurable). El `id` de la orden se guarda como `rentals.wp_booking_id`.
- **Verificar el esquema real en Fase 0** contra la versión instalada antes de programar el sync, y documentarlo en `docs/wordpress-mapping.md`. No asumir nombres de columnas sin verlos.

## Prioridades de producto (en este orden)

1. **Velocidad y usabilidad en celular del flujo de entrega/devolución.** Es lo que se usa parado en un aeropuerto con mala señal. Un paso por pantalla, botones grandes, autoguardado local del borrador, subida de fotos comprimidas y en segundo plano.
2. Integridad de la evidencia: timestamps, autor, firma, actas siempre regenerables.
3. PDF y emails asíncronos: nunca bloquear la confirmación en el lugar.
4. Dashboard y reportes.

## Plan de trabajo

Las fases 0–11 del brief y las mejoras v3–v123 están cerradas (detalle en `docs/features/`). Cada cambio termina desplegado en Railway y probado. No mezclar cambios sin relación en un mismo commit grande.

## Comandos

```
npm run dev          # desarrollo local
npm run build        # build de producción
npx prisma migrate dev
npx prisma studio
npm run lint
npm test
```

## Testing

- Tests de los flujos críticos: creación de inspección de entrega, cierre de devolución con comparación, cálculo de daños nuevos, generación de acta.
- Probar el flujo de entrega en un viewport móvil (375px) antes de dar por cerrada cualquier tarea de UI.

## Reglas e invariantes

Lecciones que costaron un bug. Valen para cualquier tarea; el porqué está en el historial del área.

**Datos y dominio**
- **Nombre congelado:** toda relación a `User` que se muestre lleva una columna `*Name` (texto) escrita al crear y nunca actualizada, con `onDelete: SetNull` en la relación. Resolver el nombre con `displayName()` (`src/lib/user-display.ts`). Así un usuario borrado o renombrado sigue figurando en lo que cargó (v34).
- **Selectores de personas** (asignar, "en línea", menciones): filtrar con `OPERATOR_FILTER` (`src/lib/users.ts`), que excluye inactivos y Socios.
- **Roles jerárquicos** `empleado < admin < finanzas < observador` ("Socio" en pantalla; en código sigue siendo `observador`). Usar `hasAdminAccess`/`hasFinanceAccess` (`src/lib/user-permissions.ts`), nunca `role === "admin"`. El propietario es el flag `User.owner`, no un rol. Para gestión de usuarios, leer el rol real con `getActorPerm` (`src/lib/user-access.ts`): la sesión puede venir con "Ver como…". Al cambiar un permiso, actualizar a mano `ROLE_ACCESS` (`src/lib/role-access.ts`).
- **Monedas:** pesos y dólares nunca se suman entre sí en Caja (`CurrencyTotals`); Reportes convierte los USD con `usdRateAt`. BTC existe solo en los traspasos (`TransferCurrency`), nunca en `Currency`.
- **Cuentas "Solo Finanzas"** (`PaymentMethod.financeOnly`): todo lugar nuevo que liste o permita elegir medios de pago tiene que filtrarlas con `financeOnlyAccountIds` (`src/lib/finance-only.ts`). Las cuentas Bitcoin (`isBitcoin`) no van en ningún selector de ingreso/egreso.
- **Prisma: nunca `notIn` solo sobre un campo nullable** (descarta también las filas con null). Usar `OR: [{ campo: null }, { campo: { notIn } }]`.
- **Un lugar nuevo que cree un ingreso de Caja** llama a `syncCommission` (`src/lib/commissions-sync.ts`) y a `syncAutoInvoice` (`src/lib/auto-invoice.ts`).
- **Un lugar nuevo que cambie la plata de una reserva** llama a `autoUnverifyRental` (`src/lib/rental-verification-server.ts`).
- **Pagos de una reserva:** "Paga"/saldo suman el importe base (`RentalPayment.amount`, sin recargo del medio y sin garantías: `paidTotal` en `src/lib/contract.ts`); Caja registra lo cobrado real (`adjustedAmount`). Las garantías (`isGuarantee`) quedan fuera de Movimientos y Reportes.
- **Sync de VikRentCar:** nunca pisa `Rental.pricing` (contrato del empleado) ni lo que el empleado corrigió (`clientEditedAt`, `placesEditedAt`, `bookingNoteEditedAt`); solo escribe los `booking_*`. Contra WordPress, solo `SELECT`.
- **Habitaciones:** toda consulta de estadías que pase por `toBookingViews` lleva `include: BOOKING_PAYMENTS_COUNT`; "ocupada" = no `mirrored` y `countsAsOccupancy` (`src/lib/rooms/queries.ts`).
- **Fechas puras** (`@db.Date`: estadías, días especiales, turnos, vencimientos): `keyToDate`/`dateToKey` (`src/lib/rooms/dates.ts`), nunca `formatDateInput`, que corre el día.
- **Textos firmados:** el diccionario `legal` (`src/lib/i18n/dictionaries.ts`) y `ORIGINAL_OWNER_CONTRACT_TEXT` no se editan más (los firmaron inspecciones y contratos viejos). Las condiciones nuevas se cargan como versión desde Configuración → Contrato.
- **Borrar una reserva** (`src/app/(app)/rentals/actions/delete.ts`): todo modelo nuevo con FK obligatoria a `Rental` se suma a la transacción de borrado.
- **Singletons** `id=1`: `ConditionSettings`, `EmailSettings`, `WhatsAppSettings`, `WhatsAppBotConfig`.
- **Reportes** está cacheado (`unstable_cache`, tag `reports`): un cambio que lo afecte llama a `revalidateTag("reports")`. El dashboard del Home no se cachea a propósito.
- **De cara al cliente** (acta, emails, bot, pantalla de firma): nunca el apodo interno del auto. Usar `vehicleBrandModel` (`src/lib/vehicle-ui.ts`).

**Next.js / React (Next 16, React 19)**
- Un archivo `"use server"` exporta solo funciones async y tipos, nunca constantes. `next build` no siempre lo detecta, explota en runtime.
- Lo que exporta un archivo `"use client"` no se puede llamar como función desde un Server Component: los helpers puros van en un módulo sin directiva.
- `import "server-only"` bloquea el módulo entero para el cliente: una función pura que use el cliente va en un archivo aparte.
- **Nada que se pollee en segundo plano es un Server Action** (su ID cambia en cada deploy): usar una ruta `/api/...`.
- Las Server Actions devuelven `{ error }` en vez de tirar: Next redacta el mensaje de un `throw` en producción.
- `<form action>` resetea los campos no controlados al terminar: formularios cuyo valor tiene que sobrevivir, controlados; filas editables inline con `key` compuesta por los campos editables.
- Nada de `setState` dentro de `useEffect` (lint `react-hooks/set-state-in-effect`): resolverlo en el evento que lo dispara.
- Modo oscuro con `[data-theme="dark"]` / variante `dark:`, nunca `@media (prefers-color-scheme)`.
- Headers de seguridad y CSP en `next.config.ts` (`connect-src` necesita `data:`); límite de body de Server Actions en 20 MB ahí mismo.
- Prisma está fijado en 6 a propósito (Prisma 7 exige driver adapters). Si un campo nuevo del schema explota en runtime con el dev server viejo: `npx prisma generate` y reiniciar.

**UI**
- Una pantalla nueva se suma a `COMMANDS` (`src/lib/command-palette.ts`) y, si vive dentro de un área, a `isActive` (`src/components/app-nav.tsx`).
- Reusar `src/components/ui` (`fields.tsx`, `Modal`, `TabBar`, `Badge`…). Modales siempre con `<Modal>`. Fechas tipeables en el celular con `DateField`, no `<input type="date">`.

**Deploy e integraciones**
- Railway corre las migraciones en el Pre-Deploy (`npx prisma migrate deploy`). Variables mínimas: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL` (sin ella el login redirige a localhost), `NEXT_PUBLIC_APP_URL`. Cron de `POST /api/sync` cada 15 min (servicio `sync-cron`). Desde local no hay acceso a la base de producción.
- Integraciones externas (Chakra, iCal de Booking/Airbnb, `gpayments` de VikRentCar…): lo que no se probó contra una llamada real se marca "sin verificar". Para confirmar el formato real, poner un log temporal y mirar los logs de Railway (así se resolvió el webhook de Chakra, v20).
- Plugins de WordPress: el zip se arma comprimiendo la carpeta del plugin, no los archivos sueltos de adentro (si no, quedan dos copias activas y da un fatal error).

## Mapa del historial (`docs/features/`)

Leer el archivo del área antes de tocarla. Cada uno está en orden cronológico; si algo nuevo contradice lo anterior, manda lo nuevo.

- `fases-0-11.md`: fases del brief (fundaciones, auth, entrega, devolución, dashboard, sync, tests, documentos, liquidación, firma remota, reportes).
- `entrega-devolucion.md`: wizard, evidencia offline, km, liquidación, devolución tardía, firma remota en vivo, contrato versionado, acta.
- `caja.md`: ingresos/egresos, garantías, pagos en USD, condonar saldo, facturación, CSV, aprobación de cambios de empleados.
- `caja-cuentas.md`: proveedores/asociados, subcuentas, Saldos, traspasos, Caja fuerte, Billetera, comisiones, fondos, Bitcoin, Finanzas, compensaciones.
- `whatsapp.md`: inbox (Chakra), webhook, ventana de 24 h, estados de triage, bot de IA con tools, adjuntos.
- `calendario.md`: grilla de flota, barras, horarios y lugares, presupuestos, precios por forma de pago.
- `vehiculos.md`: ficha, GPS, service, competencia, autos de terceros, contrato de cesión, permisos.
- `reservas.md`: notas de equipo, estados, indicador de pago, verificación, menciones.
- `sync-vikrentcar.md`: plugin andes-sync, tarifas/temporadas, opcionales, cupones, cambios post-entrega (y `docs/wordpress-mapping.md` para el esquema).
- `stripe-plugin.md`: pasarela Andes Pay Stripe para VikRentCar.
- `usuarios-auth.md`: logins, contraseña, roles, propietario, inactividad, "Ver como…".
- `reportes.md`, `habitaciones.md`, `tareas-equipo.md` (tareas, horarios, agenda), `plataforma.md` (auditoría v12, nube, paleta, tema, navegación, correos).

## Cómo documentar un cambio

Así este archivo no vuelve a crecer:
1. El detalle va en el **mensaje del commit**.
2. En `docs/features/<área>.md`, una sección `## vN — título` breve (5 a 10 líneas): qué cambió, decisiones del dueño, qué se verificó, migraciones, si quedó desplegado y qué falta. Sumar la fila al índice de `docs/features/README.md`. **Próxima versión: v124.**
3. En este archivo, solo si aparece una regla nueva que valga para cualquier tarea (va en "Reglas e invariantes") o cambian los pendientes del dueño.

## Pendientes que dependen del dueño

- Casilla remitente de emails y verificación del dominio en Resend.
- Cantidad de empleados. Política de nafta (hoy solo se registra la diferencia, no se cobra).
- Probar en un celular real: flujo offline de la entrega (modo avión), firma por QR y el flujo de entrega a 375px.
- Programar el cron diario de `POST /api/daily-summary` en Railway (mismo mecanismo que `/api/sync`).
- PROD-03: decidir cómo se arman las plantillas de condiciones por modelo/segmento (3 opciones en `docs/features/plataforma.md`, v12).
- Cargar en Configuración → Medios de pago el ajuste de saldo de Stripe (v44, en `caja-cuentas.md`) y el de los 4 asociados (v70).
- Varias secciones del historial dicen "sin desplegar todavía" y pueden estar desactualizadas: antes de asumir algo de producción, confirmarlo (por ejemplo, `npx prisma migrate status` contra Railway).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
