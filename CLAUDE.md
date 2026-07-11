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
  - **Arquitectura transport-agnostic** (`src/lib/sync/`): interfaz `BookingSource` con dos adaptadores intercambiables — **MySQL directo** (`mysql-source.ts`, `mysql2` solo lectura, para pruebas) y **REST** (`rest-source.ts`, transporte de producción vía mu-plugin). Factory (`source.ts`) prefiere REST si `WP_REST_URL` está seteado. El **motor** (`engine.ts`) hace: ventana móvil sobre `ritiro`/`consegna` (hoy−2d…hoy+60d, configurable), upsert idempotente por `wpBookingId`, mapeo de unidad por par (`idcar`,`carindex`), preselección de idioma (`resolveLocale`), cancelaciones (**solo si el rental aún no tiene inspección** — inmutabilidad), y registro en `sync_logs`. Nunca pisa datos del empleado (pricing/licencia/patente) ni reservas ya iniciadas.
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
  - **Prueba pendiente (dueño):** verificar en celular real el flujo offline (ver arriba) y que las migraciones `add_service_interval` + `add_rental_indexes` apliquen en el deploy de Railway.

## Pendientes que dependen del dueño

- ~~Acceso read-only a WordPress para Fase 0~~ ✅ provisto y descubrimiento hecho.
- **Seguridad WP MySQL (Fase 5 lista, falta acción del dueño):** se implementó el **Plan B REST** (mu-plugin `wordpress-plugin/andes-sync.php`). Falta: instalarlo, definir `ANDES_SYNC_TOKEN` en `wp-config.php`, setear `WP_REST_URL/TOKEN` + `CRON_SECRET` en Railway, **cerrar el Remote MySQL (`%`)** y configurar el cron que llame a `POST /api/sync` cada 5–10 min. Instrucciones en `wordpress-plugin/README.md`.
- Casilla remitente de emails y verificación del dominio en Resend.
- **Login con Google (opcional):** crear credenciales OAuth 2.0 (tipo "Aplicación web") en Google Cloud Console con redirect URI `https://andes.mdzrentacar.com/api/auth/callback/google` y setear `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` en Railway. Sin esas variables el botón no aparece y solo funciona el login por email/contraseña. Recordar que Google solo deja entrar a usuarios ya dados de alta por el admin (mismo email).
- ~~Tamaño de flota~~ ≈ 18 unidades / 14 modelos (de `wp_vikrentcar_cars`). Falta cantidad de empleados.
- Política de nafta (por ahora solo se registra la diferencia, no se cobra).
- ~~Versión VikRentCar / daños en el plugin~~ free, sin daños cargados para migrar (reconfirmar).
