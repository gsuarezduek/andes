# CLAUDE.md — Proyecto Andes (MDZ Rent a Car)

Sistema interno de entregas y devoluciones de autos de alquiler. La especificación completa está en `PROYECTO-ANDES.md` — **leerla antes de empezar cualquier tarea** y mantenerla como fuente de verdad. Si una decisión de implementación contradice el brief, preguntar antes de avanzar.

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

Seguir las fases 0–6 de `PROYECTO-ANDES.md`. Cada fase termina desplegada en Railway y probada. No mezclar fases en un mismo PR/commit grande.

- **Fase 0 requiere acceso a la base de WordPress** (usuario read-only de Hostinger o un dump): inspeccionar las tablas de VikRentCar, confirmar el esquema de la versión instalada y documentar el mapeo en `docs/wordpress-mapping.md` antes de programar el sync.
- Al terminar cada fase, actualizar la sección "Estado actual" de este archivo.

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

## Estado actual

- [x] **Fase 0 — Fundaciones y descubrimiento WP** ✅ desplegada y verificada
  - Proyecto Next.js 16 (App Router) + TypeScript estricto + Tailwind v4 + ESLint; Prisma 6; PWA (manifest + service worker + registro); i18n es/en desde día 1 (`src/lib/i18n`); helpers de zona horaria Mendoza (`src/lib/datetime.ts`); acceso tipado a env (`src/lib/env.ts`); `.env.example`. Repo en GitHub (`gsuarezduek/andes`).
  - **Deploy Railway + `andes.mdzrentacar.com` con SSL: funcionando** (200, certificado válido).
  - **Descubrimiento VikRentCar: verificado** (MariaDB 11.8.8, prefijo `wp_vikrentcar_`). Ver `docs/wordpress-mapping.md`. Claves: `status` = confirmed/cancelled/standby; `ritiro`/`consegna`/`ts` = Unix segundos; `lang` mayormente NULL (→es); `carindex` NULL frecuente → "sin unidad asignada" común; **77% de confirmed sin `customers_orders`** → fallback obligatorio; flota ≈ **18 unidades / 14 modelos**; `orders` **sin columna de "modificado"** → sync incremental vía `orderhistory` o ventana móvil.
  - **Nota Prisma:** se fijó Prisma **6** a propósito (Prisma 7 exige driver adapters + `prisma.config.ts`; se mantiene el flujo clásico que asume el brief).
- [~] **Fase 1 — Datos y autenticación** (construida y probada en local; falta desplegar)
  - **Schema Prisma completo** (`prisma/schema.prisma`) con todos los modelos de §6 + enums; migración `init_core_model` aplicada. **Base de desarrollo local** (PostgreSQL 18 vía Homebrew, `andes_dev`; `DATABASE_URL` en `.env`).
  - **Auth.js v5** (credenciales + JWT, roles admin/empleado): `src/auth.ts`, `src/auth.config.ts` (edge-safe), `src/proxy.ts` (ex-middleware, protege toda la app), login en `/login`. Helpers `requireUser`/`requireAdmin` en `src/lib/auth-helpers.ts`.
  - **Login con Google (opcional)** ✅ (Fase 6): provider `Google` en `src/auth.ts`. **App interna → Google no da de alta usuarios**: el callback `signIn` solo deja entrar emails que ya existen y están `active` en `users` (alta la sigue haciendo el admin); rechazados → `/login?error=AccessDenied` con mensaje claro. El callback `jwt` resuelve `id`/`role` desde la base para las sesiones de Google (sin adapter/tabla de cuentas; JWT puro). El botón "Continuar con Google" solo se muestra si `env.hasGoogleAuth` (variables seteadas). Requiere `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` (ver `.env.example`); redirect URI `…/api/auth/callback/google`.
  - **ABM de vehículos** (admin; lectura para empleados), **ABM de usuarios** (admin, con guarda anti-autobloqueo), **alquiler manual** (ambos roles, con selección opcional de vehículo y conversión Mendoza→UTC). Shell con navegación según rol. Kit de UI reutilizable en `src/components/ui`.
  - **Seed** (`npm run db:seed`): admin + empleado (`admin@mdzrentacar.com` / `empleado@mdzrentacar.com`, pass dev `andes1234`), 11 ítems de checklist (§4.1), 18 unidades con mapeo real a VikRentCar (patentes placeholder `TEMP###`), 2 alquileres de ejemplo.
  - Build y lint en verde; flujos verificados por HTTP (protección de rutas, login, RBAC, credenciales inválidas, listados).
  - **Deploy en Railway (hecho):** PostgreSQL provisionado; variables en el servicio de la app; migraciones vía **Pre-Deploy Command** `npx prisma migrate deploy`; seed corrido una vez desde local con `DATABASE_PUBLIC_URL`. Login + ABM + listados verificados en `https://andes.mdzrentacar.com`.
  - **Gotcha de deploy documentado:** Auth.js necesita **`AUTH_URL=https://andes.mdzrentacar.com`** en Railway; sin esa variable arma los redirects hacia `localhost:PORT` (login queda roto en prod). Está en `.env.example`. Variables mínimas en prod: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`.
- [~] **Fase 2 — Flujo de entrega** (desplegada; R2 verificado en prod; falta prueba en celular real + confirmar email)
  - **Wizard multipaso móvil** (`/rentals/[id]/handover`) con 6 pasos (datos, estado, daños, fotos+obs, firma, resumen), **autoguardado en localStorage**, barra de progreso, un paso por pantalla. Entrada desde el detalle del alquiler ("Iniciar entrega", solo si `reserved`) + búsqueda por cliente/patente en `/rentals`.
  - **Componentes** (`src/components/inspection`): selector de nafta (octavos), **croquis** SVG vista superior (toque para marcar daño; daños activos premarcados), **firma** con `signature_pad`, checklist OK/Falla, captura de fotos con **compresión en cliente** y subida en segundo plano.
  - **Almacenamiento** (`src/lib/storage.ts`): abstracción con **R2 en prod y filesystem local en dev** (elige según haya credenciales). Rutas `POST /api/uploads`, `GET /api/media`, `GET /api/acta` (autenticadas). Bucket privado: todo se sirve por rutas con sesión.
  - **Acta PDF** (`@react-pdf/renderer`, i18n es/en) con datos, checklist, daños, fotos y firma; **emails con Resend** (cliente + admin) vía `after()` — **asíncrono, no bloquea la confirmación**. Acta regenerable on-demand desde `/api/acta`.
  - `saveHandover` crea inspección+media+daños en transacción, pasa el alquiler a `active` y el vehículo a `rented` con el km. Inspecciones inmutables.
  - Build y lint en verde; backend del flujo verificado (subida, media, render de acta PDF). **Falta probar el wizard en un celular real** (el brief lo pide).
  - **Desplegado en Railway** con las 7 variables (R2 `andes-media`, Resend, `EMAIL_FROM`/`ADMIN_EMAIL`=info@mdzrentacar.com). Round-trip R2 verificado en prod (subida→lectura OK). **Falta:** prueba del wizard en un celular real y confirmar que llega el email con el acta adjunta (queda del lado del dueño).
- [~] **Fase 3 — Flujo de devolución y comparación** (construida y probada en local; a verificar en prod)
  - Wizard generalizado a `InspectionWizard` (`src/components/inspection/inspection-wizard.tsx`) con `mode` handover/return; el viejo `handover-wizard.tsx` se eliminó. Payload compartido en `src/lib/inspection-input.ts`.
  - **Devolución** (`/rentals/[id]/return`): reutiliza estado/checklist/croquis/fotos/firma, agrega **paso Comparación** (km recorridos, diferencia de nafta, daños nuevos resaltados) antes de firmar. Guarda km ≥ km de entrega.
  - `saveReturn` cierra el alquiler (→ `finished`), libera el vehículo (→ `available`) y actualiza su km. Entrada desde el detalle ("Iniciar devolución" si activo + con entrega + sin devolución).
  - **Acta de devolución** incluye la sección de comparación con la entrega. Verificado el render del PDF.
- [~] **Fase 4 — Dashboard y perfil de vehículo** (construida y probada en local; a verificar en prod)
  - **Dashboard** (home, `src/lib/dashboard.ts` + `page.tsx`): "Hoy" (entregas/devoluciones con estado pendiente/completada/demorada), estado de flota (contadores + alquilados con cliente y vuelta esperada), y **alertas** (devoluciones vencidas, service próximo por km ≤500, reservas sin vehículo). Flota/alertas solo admin; "Hoy" para todos.
  - **Perfil de vehículo**: gráfico SVG de evolución de km, **daños activos** sobre croquis solo-lectura, historial de alquileres (con km recorridos), historial de inspecciones (con link al acta), y **registro de mantenimiento** (ABM: service/arreglo/gasto/nota con fecha, km, costo).
  - Sin migraciones nuevas (usa `MaintenanceLog` ya existente). Build y lint en verde; render verificado en local.
- [~] **Fase 5 — Sync VikRentCar** (construida y probada contra datos reales en local; falta instalar el mu-plugin y desplegar el cron)
  - **Arquitectura transport-agnostic** (`src/lib/sync/`): interfaz `BookingSource` con dos adaptadores intercambiables — **MySQL directo** (`mysql-source.ts`, `mysql2` solo lectura, para pruebas) y **REST** (`rest-source.ts`, transporte de producción vía mu-plugin). Factory (`source.ts`) prefiere REST si `WP_REST_URL` está seteado. El **motor** (`engine.ts`) hace: ventana móvil sobre `ritiro`/`consegna` (hoy−2d…hoy+120d, configurable), upsert idempotente por `wpBookingId`, mapeo de unidad por par (`idcar`,`carindex`), preselección de idioma (`resolveLocale`), cancelaciones (**solo si el rental aún no tiene inspección** — inmutabilidad), y registro en `sync_logs`. Nunca pisa datos del empleado (pricing/licencia/patente) ni reservas ya iniciadas.
  - **Plan B REST elegido** (seguridad): mu-plugin `wordpress-plugin/andes-sync.php` expone `bookings`/`cars` por REST con token (`hash_equals`, solo `SELECT`). Su SQL espeja el del adaptador MySQL. **Permite cerrar el "Remote MySQL"** (`%`). Instrucciones en `wordpress-plugin/README.md`.
  - **Trigger:** `POST /api/sync` autenticado por `CRON_SECRET` (excluido del proxy; para el cron de Railway) + vista admin `/sync` con "Sincronizar ahora", "Importar flota" y tabla de `sync_logs`. **Seed de flota** desde `wp_vikrentcar_cars` (create-only, no pisa patentes cargadas).
  - **Sin migración nueva** (usa `SyncLog`, `Rental.wpBookingId/origin/language`, `Vehicle.wpCarId/Index` ya existentes). Env nuevas: `WP_REST_URL/TOKEN`, `CRON_SECRET`, `SYNC_WINDOW_DAYS_BACK/FORWARD`, `SYNC_INCLUDE_STANDBY`.
  - **Verificado contra datos reales** (adaptador MySQL, base real): 25 órdenes en ventana (22 confirmed / 3 cancelled), 17 mapean a vehículo, idioma/fallback de cliente OK; import real en Postgres local **idempotente** (2ª corrida: 0 nuevas, 22 actualizadas, sin duplicados). Build y lint en verde.
  - **Pendiente del dueño para prod:** (1) instalar el mu-plugin + `ANDES_SYNC_TOKEN` en `wp-config.php`; (2) setear `WP_REST_URL/TOKEN` + `CRON_SECRET` en Railway; (3) **cerrar el Remote MySQL** (`%`); (4) configurar el cron de Railway que pegue a `POST /api/sync` cada 5–10 min; (5) correr "Importar flota" una vez para reconciliar unidades.
- [~] **Fase 6 — Refinamientos** (en curso)
  - **Editar datos del cliente al iniciar la entrega** ✅: el paso "Datos" del wizard (solo handover) permite corregir nombre/documento/teléfono/email (las órdenes de VikRentCar pueden llegar sin nombre); `saveHandover` los persiste; la aclaración de firma sigue al nombre; el resumen lo confirma.
  - **QR por vehículo** ✅: QR imprimibles (`/vehicles/[id]/qr` y hoja de flota `/vehicles/qr`, admin, con CSS de impresión) que deep-linkean a `/v/[id]`, landing que resuelve el estado del auto y ofrece iniciar entrega/devolución sin buscar la reserva. Lib `src/lib/qr.ts` (dep `qrcode`).
  - **PWA offline más profunda** ✅ (construido; **falta probar en celular real**): cola de subida persistente en IndexedDB (`src/lib/client/upload-queue.ts`) — **fotos y firma** se guardan en el dispositivo al capturarlas y se suben con reintentos automáticos al recuperar señal (sobrevive recargas y cortes); rehidratación de pendientes al reabrir el wizard; guardado final resiliente vía un efecto que reintenta solo cuando hay conexión y toda la evidencia (fotos + firma) ya subió — el guard del servidor evita duplicados; banner de "sin conexión"; service worker mejorado (network-first para navegación/RSC, cache-first para estáticos, `andes-shell-v2`).
    - **Fix (firma offline):** la firma se subía directo (online-only) y trababa el paso "Firma" sin señal. Ahora va por la misma cola persistente que las fotos (slot `signature`); el guardado espera a que suba sin bloquear el avance.
    - **Prueba pendiente (dueño/dev):** en un celular real, con el flujo de entrega abierto, activar modo avión / throttling: sacar fotos (deben quedar "pendiente de señal"), intentar guardar (debe quedar "esperando señal"), reactivar la red y confirmar que fotos + acta se suben solos sin duplicar.
  - **Alertas de service configurables** ✅: intervalo de service por auto (`vehicles.service_interval_km`, migración `add_service_interval`); registrar un service con km reprograma `nextServiceKm = km + intervalo` y avanza el km actual; el dashboard distingue "Service vencido" (rojo) de "próximo" (ámbar); el perfil muestra intervalo y km restantes.
  - **Optimizaciones de rendimiento** ✅: el listado de alquileres (`/rentals`) ahora **pagina** (50 más recientes + contador; sin esto, al sincronizar miles de órdenes traería todo). Índices nuevos en `rentals` (`end_at`, `origin`, `vehicle_id`; migración `add_rental_indexes`) para el dashboard, el sync y el listado.
  - **Configuración (ex-Checklist) + condiciones económicas precargadas** ✅ (construido y probado en local; falta desplegar): el ítem de nav **Checklist** pasó a **Configuración** (`/settings`, admin; `/checklist` redirige por compat) con dos bloques: **Checklist** (lo de antes) y **Condiciones**. Las Condiciones son una **plantilla global** (`condition_settings`, singleton id=1; migración `add_conditions_and_booking_fields`): seguro, km/día, $ km extra y **hora extra como % de la tarifa diaria**. Se **precargan** en el paso "Condiciones" de la entrega (junto con `dailyRate`/`days` traídos de la reserva) y el empleado las ajusta; se guardan en `Rental.pricing` y se imprimen en el acta (importe de la hora extra derivado del % — helper `extraHourAmount`). Modelo `ContractPricing` extendido (`kmPerDay`, `extraHourPercent`).
    - **Datos económicos de VikRentCar** ✅: el sync ahora trae `days` (100%), **`custdata`** (100%, texto libre — se muestra al empleado como "Info de la reserva" en la entrega, **no** va al acta), `order_total` (~95%, referencia) y `car_cost` (~24% → `dailyRate` cuando existe). Persistidos en `rentals.booking_days/booking_note/booking_total/booking_price_per_day`. El sync **nunca pisa** `pricing` (contrato del empleado); solo escribe los `booking_*`. Espejado en el mu-plugin REST (`andes-sync.php`) y el adaptador MySQL. **Hallazgo:** no hay tarifa diaria estructurada confiable (car_cost solo 24%); el precio real suele estar en el `custdata`. Ver `docs/wordpress-mapping.md`. **Verificado** contra datos reales (query + round-trip Prisma). **Falta:** desplegar la migración en Railway y actualizar el mu-plugin en WordPress.
  - **Archivar vehículos (baja de flota sin borrar)** ✅ (construido y probado en local; falta desplegar): campo `vehicles.archived_at` (nullable; migración `add_vehicle_archive`), **ortogonal a `status`**. Archivar da de baja el auto de la flota operativa **conservando toda la ficha** (histórico, actas, daños — evidencia inmutable). Los archivados se **excluyen** de dashboard (disponibles/fuera de servicio/alertas de service), listado de vehículos (por defecto; con toggle "Archivados (N)"), hoja de QR y pickers de vehículo (alquiler manual + reasignación en handover). El **perfil sigue accesible** (badge "Archivado" + aviso). Acciones `archiveVehicle`/`unarchiveVehicle` (admin) en `vehicles/actions.ts`; **guarda:** no se puede archivar un auto `rented` o con alquiler activo (primero cerrar la devolución). Reversible ("Reactivar"). **Decisión:** archivado **100% manual desde Andes**, desacoplado de WordPress — el `avail`/`units` de VikRentCar es ambiguo (toggle temporal vs. retiro; y bajar `units` no dice qué `carindex` se fue), así que auto-archivar sería inseguro. El sync sigue siendo create-only y no toca archivados. **Falta:** desplegar la migración `add_vehicle_archive` en Railway.
  - **Prueba pendiente (dueño):** verificar en celular real el flujo offline (ver arriba) y que las migraciones `add_service_interval` + `add_rental_indexes` + `add_vehicle_archive` apliquen en el deploy de Railway.

## v2 (mejoras post-fase-6)

Plan aprobado, cerrado en la Fase 11 (fases 7–11 desplegables). La Fase 12 (i18n completo de la UI del empleado) se **descartó por decisión del dueño**: la UI del empleado se mantiene en español (el equipo es de habla hispana). El contenido de cara al cliente —acta, emails, firma— sigue siendo bilingüe (es/en) por alquiler, como desde el día 1.

- [x] **Fase 7 — Red de tests de flujos críticos** ✅ (local, en verde)
  - **Vitest** (`vitest.config.ts`, scripts `test`/`test:watch`; alias `@/`→src y stub de `server-only` para importar módulos de servidor). Tests junto al código en `src/**/__tests__`. Doc en `test/README.md`.
  - **Lógica de comparación extraída** a `src/lib/comparison.ts` (`computeComparison`: km recorridos, diff de nafta, daños nuevos) — antes estaba inline en el acta y el wizard; ahora la comparten `acta/index.ts` y `inspection-wizard.tsx`.
  - **28 tests** (5 archivos): `comparison`, `contract` (`extraHourAmount`/`formatArs`), `datetime` (Mendoza↔UTC, unix VikRentCar), `i18n` (`resolveLocale` + **paridad de claves es/en**), y `save-flows` (`saveHandover`/`saveReturn` con prisma/auth/acta mockeados: creación de inspección, transición de estados y guards de inmutabilidad). `npm test` + `npm run build` + `npm run lint` en verde.
  - **Diferido:** suite de integración con Postgres de prueba + render real del acta PDF (ver `test/README.md`).
- [x] **Fase 8 — Captura de licencia/DNI/pasaporte** ✅ (local; falta desplegar la migración)
  - Modelo `RentalDocument` + enum `DocumentKind` (license/dni/passport); migración `add_rental_documents`. Relación a `Rental` y `User` (auditoría, `uploadedById`).
  - **Captura opcional en el paso "Datos" de la entrega** (solo handover): licencia/DNI/pasaporte por la **misma cola persistente** (`upload-queue`), con el tipo codificado en el slot (`document:{kind}`) y un `kind=document` nuevo en `storage.ts`/`media.ts`/`/api/uploads`. Rehidratación tras recarga y estado subiendo/pendiente igual que las fotos.
  - `InspectionInput.documents` + validación Zod en `saveHandover`, que persiste filas `RentalDocument` en la transacción.
  - **Solo interno** (privacidad): se muestran en el detalle del alquiler (`/rentals/[id]`) servidos por `/api/media` con sesión; **no** se embeben en el acta ni se envían por email. Tests de persistencia en `save-flows.test.ts` (30 tests en total).
  - **Falta:** desplegar la migración `add_rental_documents` en Railway.
- [x] **Fase 9 — Liquidación de la devolución** ✅ (local; falta desplegar la migración)
  - **Lógica pura** `src/lib/settlement.ts`: `computeSettlement` (excedente de km sobre lo incluido `kmPerDay×days`, nafta faltante, cargo por daño) + `rollupSettlement` (subtotal, depósito aplicado, saldo a cobrar / depósito a devolver). Autocompleta desde `Rental.pricing`. **Sin cobro.** 8 tests.
  - Campo `Inspection.settlement` (Json; migración `add_inspection_settlement`) — inmutable, es lo que el cliente firma. Persistido en `saveReturn` (validación Zod). Test de persistencia en `save-flows.test.ts` (39 tests en total).
  - El paso "Comparación" del wizard de devolución pasa a **Liquidación**: desglose autocalculado con importes editables (km extra, nafta, cargo por cada daño, depósito) + **forma de pago** (efectivo/transferencia/retención) + nota; recálculo en vivo. La página de devolución pasa `pricing` de la entrega. Saldo también en el Resumen.
  - **Acta de devolución** imprime la sección de liquidación (i18n es/en, sub-diccionario `acta.settlement`; paridad de claves testeada).
  - **Falta:** desplegar la migración `add_inspection_settlement` en Railway.
- [x] **Fase 10 — Firma remota / portal del cliente** ✅ (local, roundtrip verificado; falta desplegar la migración)
  - Modelo `SignatureRequest` (id no adivinable, `draftId`, `summary` Json, `status` pending/signed/expired/cancelled, `expiresAt`; migración `add_signature_requests`) + enum `SignatureRequestStatus`. Helper puro `src/lib/remote-signature.ts` (`isSignatureRequestUsable`, TTL 30 min; 5 tests).
  - **Rutas públicas** (excluidas del proxy, junto a `api/sync`): página `/sign/[id]` (sin sesión: valida pending+no vencido, muestra resumen en el idioma del alquiler + texto legal + canvas) con `sign-form.tsx`; `POST /api/sign/[id]` (recibe la firma, **un solo uso** vía `updateMany where status=pending`, la sube bajo `uploads/{draftId}/signature.png` — la **misma clave** que espera `saveHandover/saveReturn`); `GET /api/sign/[id]/status` (lo poolea el wizard).
  - **Wizard** (paso "Firma"): botón "Generar QR para el cliente" → server action `createRemoteSignature` (crea el pedido y devuelve el **QR SVG** generado server-side reusando `qrSvg`) → el cliente escanea y firma en su teléfono → el wizard **poolea** cada 3s y toma la firma. El canvas en el dispositivo del empleado sigue como fallback. Pasado a entrega y devolución.
  - **Verificado (roundtrip, sin sesión):** status pending → POST firma → signed con la clave correcta; doble uso → 409; `/sign/[id]` → 200; rutas privadas siguen en 307→login.
  - **Leer y aceptar las condiciones antes de firmar** ✅ (local; build/lint/test en verde): la pantalla de firma —QR remoto **y** canvas de fallback en el dispositivo del empleado— ahora muestra las **condiciones completas** que antes solo llegaban por email después de firmar: en entrega, las **condiciones económicas** (mismo formato que el acta, vía `PRICING_FIELDS`/`extraHourAmount`); en devolución, la **liquidación** (km extra, nafta, daños, depósito, saldo). Debajo, las **condiciones generales** (texto legal completo: `legal.paragraphs` + `photoConsent` + `jurisdiction` + `acceptance`) en scroll. Un **checkbox de aceptación** (`signature.acceptConditions`, i18n es/en) **habilita** la firma; sin marcarlo, el canvas queda bloqueado (`pointer-events-none`) y el botón deshabilitado. El `POST /api/sign/[id]` exige `accepted=true` (defensivo). **Sin migración** (decisión del dueño: no se persiste `acceptedAt`; el gate del checkbox alcanza). El `SignatureSummary` se extendió con `conditions`/`settlementRows`/`balance*` y el email del acta pasa a ser el **comprobante** de lo leído/firmado. **Falta:** probar el flujo en celular real (QR → teléfono).
  - **Falta:** desplegar la migración `add_signature_requests` en Railway.
- [x] **Fase 11 — Reportes y analítica histórica (admin)** ✅ (local; sin migración)
  - `src/lib/reports.ts` (`getReports`): KPIs (flota, alquilados, activos, finalizados, ingresos, neto), **alquileres finalizados + km recorridos por mes** (últimos 12, cortes en hora de Mendoza), y tabla **por vehículo** (alquileres, ingresos, costos de mantenimiento, neto, daños activos). Ingresos del contrato del empleado (`Rental.pricing.total`) con fallback a `bookingTotal`; sólo alquileres finalizados. Helper puro `recentMonths` (rollover de año) testeado (47 tests).
  - Página `/reports` (admin, `requireAdmin`): KPIs + gráfico de barras SVG por mes + tabla por vehículo. Export **CSV** (`GET /api/reports/export?type=vehicles|months`, admin, BOM para Excel). Ítem "Reportes" en la nav (solo admin).
  - **Sin migración.** Queries verificadas contra la base local (incl. `groupBy` de daños). Build/lint/test en verde.
- [~] **Fase 12 — i18n completo de la UI del empleado — DESCARTADA.** Decisión del dueño: la UI del empleado queda en español. No se implementa.

## v3 — Refinamientos de flota, entrega y acta (post-fase-11)

Tanda de mejoras nacidas del uso real. Construida y probada en local (build/lint + 54 tests en verde, incluido un smoke test que renderiza el acta con el croquis). **Falta desplegar la migración `add_vehicle_fuel_levels_damage_audit_drivers` en Railway** y probar en celular real (375px).

- **Líneas de combustible por auto** ✅: `vehicles.fuel_levels` (Int 4–16, default 8; migración). Configurable en la edición del vehículo (selector) y visible en el perfil. El `FuelSelector` toma `max` dinámico (0..N con etiquetas `n/N`); el wizard lo recibe vía `maxFuel` (del vehículo) y precarga tanque lleno en la entrega; el acta muestra `N/max` en estado, comparación y liquidación. El nivel se sigue guardando como entero; comparación/settlement solo hacen diferencias.
- **Historial de daños auditable** ✅: `damages.reported_by_id`/`repaired_by_id`/`repaired_at` (migración; `created_at` ya era la fecha de carga). `addDamage` y los daños creados en `saveHandover`/`saveReturn` setean `reportedById`; `markDamageRepaired` setea `repairedById`+`repairedAt`. El perfil del vehículo suma una sección **"Historial de daños"** (activos + reparados) con quién lo cargó/reparó y las fechas; "Daños activos" (croquis) se mantiene.
- **Wizard de entrega**:
  - **Detalle del daño existente** ✅: el paso "Daños" lista el texto de los daños ya registrados (antes solo el punto ámbar en el croquis).
  - **Documentos desde la galería** ✅: cada tipo (licencia/DNI/pasaporte) tiene botón 📷 (cámara, `capture`) y 🖼️ (elegir archivo del teléfono, sin `capture`).
  - **Fecha de licencia** ✅ movida al paso "Datos" (debajo de los documentos); ya no está en "Condiciones".
  - **Conductores adicionales** ✅: en "Datos" se agregan conductores (nombre + foto de licencia). Se guardan en `rentals.additional_drivers` (Json `[{name}]`; migración) y la licencia como `RentalDocument` con `holder_name` (migración). Los **nombres figuran en el acta** ("Conductores autorizados", titular + adicionales); la foto queda interna.
  - **KM Libres** ✅: botón en "Condiciones" (`ContractPricing.unlimitedKm`) que deshabilita km/día y km extra; `computeSettlement` no cobra excedente aunque haya km incluido pactado. Se refleja en el acta.
  - **Accesorios en texto** ✅: `TextareaField` para `accessoriesDesc` (ya existía en el type) impreso en el acta.
  - **Símbolo $** ✅ en los inputs de dinero (prop `prefix` nueva en `TextField`).
  - **Bloque Total / Seña / Paga / Saldo** ✅: `ContractPricing.sena` nuevo; el **saldo se autocalcula** = total − seña − paga (helper puro `computeBalance`, testeado), editable.
  - **Garantía (entrega) vs excedentes (devolución)** ✅: en la entrega el depósito se rotula "Garantía" y suma un textarea "Forma de garantía" (`ContractPricing.guaranteeForm`); ambos van al acta. La liquidación de la devolución sigue usando "excedentes/depósito".
  - **Checklist obligatorio** ✅: los ítems arrancan **neutros** (sin OK/Falla); el paso "Estado" no avanza hasta decidir todos (contador "Faltan N"/"Completo ✓"). Se sigue persistiendo solo `ok`/`fail`.
- **Croquis con daños en el acta** ✅: geometría del auto factorizada a `src/components/inspection/croquis-shape.ts` (usada por el croquis en pantalla y por uno nuevo dibujado con `Svg`/`Path`/`Rect`/`Circle` de react-pdf). La sección "Daños" del acta ahora muestra el **croquis con un círculo rojo por daño** + la lista de texto (antes solo texto).
- **Sincronizar a mano desde el header** ✅: ícono de sync junto al menú de perfil (desktop) y un ítem en el menú mobile, con spinner y check. Reusa la server action `triggerSync` (auth por sesión), no el endpoint `CRON_SECRET`.
- Sin cambios de cobros. `ContractPricing` extendido no rompe reportes ni el sync (que nunca pisa `pricing`).

## v4 — Calendario de flota (timeline)

Vista **Calendario** (`/calendar`, en la barra principal, todos los roles). Construida y probada en local (build/lint en verde; render verificado por HTTP autenticado). **Falta desplegar la migración `add_vehicle_sort_order` en Railway.**

- **Grilla tipo Gantt:** filas = autos, columnas = días (ventana móvil de 30 días desde hoy, navegable con Anterior/Hoy/Siguiente vía `?from=YYYY-MM-DD`). Cada alquiler no cancelado se pinta como una barra continua sobre los días que ocupa, con el **nombre del cliente**; al pasar el mouse, tooltip flotante con fechas (hora Mendoza), estado, conductores adicionales y **notas de la reserva** (`bookingNote`/custdata). `title` nativo como fallback para touch. Barras finalizadas en gris, el resto en azul (colores mínimos, no codifican estado por pedido del dueño).
- **Orden manual de autos** (del más caro al más económico, como la agenda): campo nuevo `vehicles.sortOrder` (Int nullable; migración `add_vehicle_sort_order`), editable en la ficha del auto ("Orden en el calendario"). `asc` con NULLS LAST → los sin orden quedan al final por marca/modelo/patente. **Decisión:** el vehículo no tenía precio (sólo vive en el alquiler y con baja cobertura), así que se optó por orden manual explícito en vez de derivarlo.
- **Reservas sin unidad asignada** (`vehicleId` null): fila propia por reserva al final, etiquetada con `bookingModel`, para no pisarse entre sí.
- Lógica en `src/lib/calendar.ts` (`getCalendarData`: ventana, columnas de día en hora Mendoza, recorte de barras a la ventana). UI: `src/app/(app)/calendar/page.tsx` (server) + `calendar-grid.tsx` (client, columna de autos sticky + scroll horizontal + tooltip). Sin dependencias nuevas. Los autos archivados se excluyen.

## v5 — Tarifa por día del auto (desde VikRentCar, actualizada por sync)

Traer y mostrar en la **ficha del auto** el **precio por día de referencia (1 día)**, que varía por temporada y se refresca en cada sincronización. Construida y **verificada end-to-end contra la base real** (acceso MySQL de solo lectura); build/lint + 65 tests en verde. **Falta:** desplegar la migración `add_vehicle_daily_rate` en Railway y **redesplegar el mu-plugin** (v1.1.0) en WordPress.

- **Modelo de datos VikRentCar** (verificado en vivo, ver `docs/wordpress-mapping.md`): tarifa base en `wp_vikrentcar_dispcost` (`days=1`, un solo plan de precios); temporadas en `wp_vikrentcar_seasons` (todas de porcentaje: `type=1`, `val_pcent=2`; `from`/`to` = segundos dentro del año; `idcars` = `-8-,-5-,`). **Tarifa hoy = base × ∏(1+%/100)** de las temporadas activas que incluyan el modelo.
- **Cálculo puro** `src/lib/sync/rates.ts` (`computeDailyRate`, `parseIdCars`, `secondsIntoYear` en hora Mendoza) — testeado (`rates.test.ts`, 9 tests).
- **Sync** `syncCarRates` (`src/lib/sync/engine.ts`) corre al final de cada `runBookingSync` (best-effort), calcula por `idcar` y hace `updateMany` de los `vehicles` con ese `wpCarId` (`vehicles.daily_rate` + `daily_rate_updated_at`; migración `add_vehicle_daily_rate`). Solo actualiza, no crea.
- **Transportes** (`src/lib/sync/{types,mysql-source,rest-source}.ts`): `RawCar.baseDailyRate` + `fetchSeasons()`. La lógica de temporada vive **solo en JS**; los transportes devuelven crudo. **mu-plugin `andes-sync.php` v1.1.0**: `/cars` agrega `baseDailyRate` (subquery a `dispcost`) y nuevo endpoint `/seasons` (SELECT-only). Los adaptadores REST toleran mu-plugins viejos (rate → null, "—" en la ficha).
- **UI:** fila "Tarifa 1 día (ref.)" en la ficha del auto (`src/app/(app)/vehicles/[id]/page.tsx`) con la fecha de última actualización. `null` → "—".
- **Verificado:** corrida real → 17 unidades actualizadas con la base correcta (hoy sin temporada activa: Cronos $80.000, idcar 5 $70.000, etc.).
- **Decisión:** solo 1 día como referencia (acordado con el dueño); v1 soporta temporadas de porcentaje (las únicas en uso).

## v6 — Plugin andes-sync configurable + más datos + reservas sin confirmar

Tanda sobre el plugin de WordPress y el sync. Construida y probada en local (build/lint + 67 tests en verde; SQL verificado contra la base real). **Falta desplegar las migraciones `add_booking_paid_and_country` + `add_booking_confirmed` en Railway y subir el plugin v1.3.0 a WordPress.**

- **Plugin como plugin normal + toggles de datos compartidos** ✅ (`wordpress-plugin/andes-sync.php` v1.3.0): pantalla **Ajustes → Andes Sync** con checkboxes agrupados para elegir qué comparte por REST (Cliente/PII, Económico, Texto libre, Extras de la reserva, Tarifa/Temporadas); los **estructurales** (`wpBookingId, status, idcar, carindex, startUnix, endUnix`) van siempre. Un grupo apagado se envía `null` (o vacío para tarifa/temporadas). Link **"Configuración"** en la fila del plugin (`plugin_action_links`). Lado Andes: `rest-source.ts` coacciona `clientName` null → "Sin nombre" (columna NOT NULL) para que apagar Cliente no rompa el sync.
- **Dos campos nuevos del sync** ✅: `totpaid` → `rentals.booking_paid` (precarga la **"Seña"** en la entrega; el saldo se autocalcula; aprovecha Andes Pay Stripe; baja cobertura hoy) y `country` → `rentals.client_country` (país del cliente en el acta, i18n es/en). Migración `add_booking_paid_and_country`. **Descubrimiento (solo lectura)** descartó `drivers_data` (vacío: 1/559, valor `[]`) y `adminnotes` (0/25 en ventana); encontró **opcionales estructurados** (`orders.optionals/extracosts` + tabla `wp_vikrentcar_optionals`) como candidato futuro para "Accesorios". Ver `docs/wordpress-mapping.md`.
- **Reservas sin confirmar (standby) en naranja** ✅: el sync ahora trae `standby` por defecto (`SYNC_INCLUDE_STANDBY` default **true**; `"false"` para excluir) y guarda `rentals.booking_confirmed` (Boolean, default true; migración `add_booking_confirmed`) = `status === "confirmed"`. Los alquileres manuales nacen confirmados. Se muestran con **diferencial naranja**: barras **naranjas** en el calendario (vs azul confirmada / gris finalizada, con leyenda) + línea "Sin confirmar" en el tooltip; badge **"Sin confirmar"** (tono `orange` nuevo en `Badge`) en el listado, el detalle (con aviso "verificá antes de entregar") y el dashboard "Hoy". La alerta "reservas sin vehículo" se filtra a **confirmadas** (una standby es prematura para asignar unidad). El sync pasa `booking_confirmed` a true si el dueño confirma en VikRentCar. **Hallazgo:** las 17 standby históricas tienen retiro pasado (0 futuras) → hoy no se ve naranja; se enciende con nuevas standby a futuro.
- **Opcionales de VikRentCar → accesorios + franquicia** ✅ (plugin v1.4.0; migración `add_optionals_and_deductible`): el sync trae `orders.optionals` (`"id:cant;"`) + el catálogo `wp_vikrentcar_optionals` (endpoint `/optionals`). Cómputo puro en `src/lib/sync/optionals.ts` (parse + clasificación + importe; 9 tests): la **"Mejora de Seguro"** (por nombre) es un **flag** (`bookingInsuranceUpgrade`) que baja la **franquicia**; el resto son **accesorios** → `bookingAccessories` + `bookingAccessoriesAmount` (`cost × perday?días × cant`). **Franquicia** ahora es concepto del contrato: `ConditionSettings.deductible` + `deductibleReduced` (editables en **Configuración → Condiciones**), `ContractPricing.deductible` + `insuranceUpgrade`. En la **entrega** se precargan accesorios (desc+importe) y, si la reserva trae mejora, la franquicia reducida + el toggle "Mejora de seguro" (naranja, destacado) que intercambia la franquicia; en el **acta** se imprime la franquicia con la nota "con mejora de seguro" (i18n es/en). El sync nunca pisa `pricing`. **Verificado end-to-end** contra la base real (catálogo + `optionals` por reserva; `extracosts` está muerto → ignorado). `drivers_data` seguía descartado.
- **Reactivación automática de vehículos archivados** ✅ (plugin v1.6.0): `/cars` agrega `avail` (campo estructural, toggle de disponibilidad **por modelo**, no por unidad física). Al correr **"Importar flota"** (`seedFleetFromWp`), si `avail=true` y la unidad ya existe archivada, se **reactiva sola** (`archivedAt = null`). **Archivar sigue siendo 100% manual** (la ambigüedad por-modelo-no-por-unidad que ya hacía insegura la auto-archivación no aplica igual a la reactivación: es reversible y de bajo riesgo). Plugins viejos sin `avail` → no tocan nada. El botón muestra el resultado (creadas + reactivadas) en `/sync`.

## Add-on — Andes Pay Stripe (pasarela de pago para VikRentCar)

Plugin de WordPress **independiente** de la app Next.js, en `wordpress-plugin/andes-pay-stripe/`. Agrega **"Andes Pay Stripe"** como método de pago de **VikRentCar Pro (v1.4.6)**: cobra el **total** de la reserva con tarjeta vía **Stripe Checkout** (redirección alojada por Stripe, PCI mínimo). **Probado y funcionando en producción (Live):** cobro → retorno → reserva marcada pagada por VikRentCar.

- **Registro update-safe:** se engancha a los hooks `get_supported_payments_vikrentcar` (filtro) + `load_payment_gateway_vikrentcar` (acción) desde un plugin aparte, **sin tocar la carpeta de VikRentCar** (que se pisa en cada update). Alias del plugin host = `vikrentcar`.
- **Clase** `VikRentCarAndesPayStripePayment extends JPayment` (`payments/andes_pay_stripe.php`): `buildAdminParameters()` (config admin), `beginTransaction()` (crea la Checkout Session vía API REST de Stripe con `JHttp` y muestra botón "Pagar con tarjeta"), `validateTransaction()` (verifica server-side) y `complete()` (redirect a la orden). **No toca la base:** VikRentCar marca la orden pagada por su propio framework al recibir `$status->paid()->verified()`.
- **Claves configurables en dos lugares** con precedencia **método-VikRentCar → panel de WordPress**: pantalla propia **Ajustes → Andes Pay Stripe** (`wp_options` `andes_pay_stripe_options`, Settings API) con entorno/claves/descriptor; los campos password usan "dejar en blanco para conservar" (no reimprimen el secreto). El selector de entorno del método en VikRentCar tiene opción "Usar el del panel de WordPress".
- **Cuenta compartida:** cada pago lleva `metadata[source]=vikrentcar-andes` + `metadata[order_id]` + `client_reference_id` + descriptor de tarjeta, para filtrar/distinguir en un Stripe que también recibe otros cobros.
- **Gotchas resueltos (documentados en el código):**
  - **Validación del retorno:** en el contexto de `validateTransaction` VikRentCar **no** repuebla `transaction_currency`/`total_to_pay`/`order`. No comparar contra el total: se confía en la respuesta de Stripe (`payment_status=paid` + `amount_total`), mismo criterio que la pasarela oficial de PayPal Checkout. Comparar rompía el pago (quedaba "pendiente").
  - **Sin auto-redirect:** un `setTimeout`→Stripe en `beginTransaction` causaba un loop de vuelta a Stripe tras el retorno; se eliminó (queda solo el botón, como la oficial).
  - **Modo test con cuenta US + ARS:** la tarjeta `4242…` (crédito US) se rechaza a propósito ("try a debit card"); usar débito de prueba `4000 0566 5566 5556`.
- **Setup real verificado:** cuenta de Stripe en **EE. UU.**, moneda VikRentCar **ARS** (Stripe convierte a USD para el payout; 1000 ARS ≈ 0,65 USD). ARS es moneda de 2 decimales en Stripe (importe ×100).
- **La copia de referencia de VikRentCar** (`wordpress-plugin/vikrentcar/`) y el **zip de build** (`wordpress-plugin/andes-pay-stripe.zip`) están en `.gitignore`.

**Pendiente / opcional del dueño:**
- **Webhook de respaldo** (`checkout.session.completed`): cierra el caso "el cliente paga y cierra la pestaña sin volver" (hoy la confirmación depende de la redirección de retorno, igual que la PayPal oficial). No implementado aún.
- **Decisión ARS vs USD:** con cuenta US, cobrar en ARS implica doble conversión + fee (~1%) y, para el cliente argentino, impuestos de compra al exterior (PAÍS + percepciones). Cambiar de moneda es sólo cambiar la moneda global de VikRentCar (no requiere tocar el plugin).
- **Logo opcional** `assets/andes_pay_stripe.png` (sin él, el método aparece igual, sin imagen).
- **Reembolsar** el cobro de prueba en Live (0,65 USD) si se desea.

## Pendientes que dependen del dueño

- ~~Acceso read-only a WordPress para Fase 0~~ ✅ provisto y descubrimiento hecho.
- **Seguridad WP MySQL (Fase 5 lista, falta acción del dueño):** se implementó el **Plan B REST** (mu-plugin `wordpress-plugin/andes-sync.php`). Falta: instalarlo, definir `ANDES_SYNC_TOKEN` en `wp-config.php`, setear `WP_REST_URL/TOKEN` + `CRON_SECRET` en Railway, **cerrar el Remote MySQL (`%`)** y configurar el cron que llame a `POST /api/sync` cada 5–10 min. Instrucciones en `wordpress-plugin/README.md`.
- Casilla remitente de emails y verificación del dominio en Resend.
- **Login con Google (opcional):** crear credenciales OAuth 2.0 (tipo "Aplicación web") en Google Cloud Console con redirect URI `https://andes.mdzrentacar.com/api/auth/callback/google` y setear `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` en Railway. Sin esas variables el botón no aparece y solo funciona el login por email/contraseña. Recordar que Google solo deja entrar a usuarios ya dados de alta por el admin (mismo email).
- ~~Tamaño de flota~~ ≈ 18 unidades / 14 modelos (de `wp_vikrentcar_cars`). Falta cantidad de empleados.
- Política de nafta (por ahora solo se registra la diferencia, no se cobra).
- ~~Versión VikRentCar / daños en el plugin~~ free, sin daños cargados para migrar (reconfirmar).
