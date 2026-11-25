# Plataforma, UI general y configuración

> Auditoría v12 (seguridad, UX, performance), nube y limpieza de archivos, paleta de comandos, tema, navegación, correos.
>
> Historial movido desde `CLAUDE.md` el 2026-11-25, sin cambios de contenido. Orden cronológico: si algo más nuevo contradice lo anterior, manda lo nuevo. Hay números de versión repetidos (dos secciones distintas con el mismo vN).

## v12 — Auditoría integral: seguridad, UX del wizard, Configuración/Reportes/Caja, arquitectura y performance

Tanda grande nacida de una auditoría completa del código (backlog de ~70 hallazgos, códigos `SEC-`/`UX-`/`UI-`/`COD-`/`ARQ-`/`PERF-`/`PROD-`). Cada ítem se implementó y desplegó por separado (build/lint/tests en verde en cada uno; UI verificada en navegador, 375px cuando correspondía). Resumen por área (código entre paréntesis para cruzar contra `git log`):

- **Seguridad:**
  - **SEC-03:** la liquidación/pricing de la devolución se recalcula **server-side** antes de persistir — ya no se confía en el monto final que manda el cliente.
  - **SEC-04:** los pagos de entrega/devolución exigen monto positivo (cerraba un caso límite de descuento >100% dejando un pago negativo).
  - **SEC-05:** headers de seguridad nuevos en `next.config.ts` (CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` acotado a cámara/geolocalización propias). Fix inmediato: `connect-src` necesitaba `data:` — sin eso, `fetch()` sobre una `data:` URI (así se sube la firma local del wizard) fallaba en silencio.
  - **SEC-06:** rate limiting básico (5 pedidos/15 min por IP) en `/forgot-password` — sin límite, un script podía agotar la cuota de Resend.
  - **fix(deps):** Next.js 16.2.10→16.3.0 y next-auth beta.31→32 por CVEs reales (next-auth: fail-open crítico en el chequeo de auth; Next.js: SSRF/DoS en Server Actions, bypass de proxy con Turbopack). `npm audit`: 5 vulnerabilidades → 0.
  - **fix(uploads):** `/api/uploads` detecta el Content-Type real por los primeros bytes (magic numbers), no por lo que declara el cliente — cerraba un vector de XSS almacenado (subir un archivo con Content-Type falsificado). `/api/media` suma `X-Content-Type-Options: nosniff`.
  - **fix(rentals):** doble entrega/devolución por carrera (dos empleados, doble-tap, reintento de la cola offline) — `@@unique([rentalId, type])` en `Inspection` + guard que atrapa el conflicto y devuelve un resultado normal en vez de reventar.
- **Flujo de entrega/devolución (wizard):**
  - **UX-02:** confirmación de dos pasos al marcar service/arreglo (antes cancelaba la reserva y bloqueaba el auto con un solo click).
  - **UX-07:** elegir fotos de la galería además de la cámara (fotos generales, de cada daño, y en "Agregar daño" del perfil del vehículo).
  - **UX-08:** los pasos "Condiciones" (5 sub-secciones) y "Comparación/Liquidación" (2) pasan a pestañas (`TabBar`, antes `SubStepTabs`) — menos scroll en 375px, mismo conteo de pasos del wizard.
  - **UX-09:** la barra de progreso del wizard es clicable (saltar a cualquier paso ya visitado); saltar antes de "Firma" con una firma ya hecha la invalida.
  - **fix:** la firma (local o remota) se invalida si se editan datos después de firmar — incluye cancelar el pedido remoto server-side (antes quedaba `pending` y un cliente con la página abierta podía firmarlo igual).
  - **fix:** el resumen de firma remota usaba `maxFuel` hardcodeado en 8; ahora usa el real del vehículo (hasta 16 líneas).
  - **fix:** lock síncrono contra doble-submit del botón final (un doble-tap con señal inestable podía disparar el guardado dos veces antes de que SEC-03/el guard de arriba entraran en juego).
  - **fix:** targets táctiles del selector de nafta a 44px mínimo (autos con hasta 16 líneas quedaban con botones muy chicos).
  - **fix:** la cola de subida offline ya no se traba para siempre si un solo ítem tiene un error no transitorio — reintentos por ítem, error accionable en vez de "Pendiente" indefinido.
  - **COD-11:** el armado del payload final del wizard se extrae a una función pura en `logic.ts`, separada del control de flujo del guardado.
- **Configuración, Reportes y Caja:**
  - **UX-12:** feedback visible (`SavedBanner`) al guardar Condiciones/Correos.
  - **UX-13:** el botón de sync manual del header muestra el resultado real (verde/ámbar/rojo con mensaje) en vez de un ✓ verde fijo aunque el sync hubiera fallado.
  - **UX-19:** confirmación al "marcar reparado" (antes un solo click); aclaración de que Caja y Caja fuerte son cosas distintas.
  - **UX-21:** auditoría de cambios en Condiciones económicas — historial de quién cambió qué y cuándo (`ConditionSettingsEdit`, mismo patrón que Caja).
  - **UX-22:** selector de período (3/6/12/24 meses) y orden por columna en Reportes; export CSV nuevo en Caja.
  - **feat(caja):** "Origen/Destino" en Pagos (cuenta propia obligatoria → cuenta ajena opcional); Caja fuerte (efectivo físico, separado de `CashMovement`) + botón único de guardar en Medios de pago.
  - **COD-09:** diff de detalle+monto para el historial de ediciones extraído a `movement-audit.ts` (antes duplicado en `cash.ts`/`safe.ts`).
  - **COD-06/COD-07:** Reportes reconcilia el KPI de ingresos/costos contra la tabla "por vehículo" (antes el KPI sumaba autos archivados y la tabla los excluía); el sync ya no reasigna una reserva nueva a un vehículo archivado.
- **Arquitectura y calidad de código:**
  - **ARQ-01:** 7 módulos de servidor (prisma, cash, safe, queries) marcados `"server-only"`.
  - **ARQ-05:** documentado en el schema el límite de multi-sucursal de `ConditionSettings`/`EmailSettings` (singleton `id=1`).
  - Varias unificaciones de UI duplicada (sin cambios visuales, verificadas en navegador): `ToggleButton` (UI-01), `TeamNotesSection` de vehículo/reserva (UI-05), "positivo" unificado a emerald (UI-09, sacando `green` suelto), `Row`/`CompareRow`, ícono de editar + tarjeta de confirmar borrado, modales hand-rolled migrados a `<Modal>` (foco atrapado, Escape, `role="dialog"`), emojis funcionales (📷/🖼️/✕) reemplazados por íconos SVG, formulario de service/arreglo duplicado, inputs/formularios divergentes unificados en `fields.tsx` (UI-02).
  - **fix(acta):** loguea si falla la descarga de firma/fotos al generar el PDF (antes fallaba en silencio y el acta se mandaba sin la evidencia); 3 títulos que quedaban hardcodeados en español pasan al diccionario i18n.
  - **fix(app):** `error.tsx` global nuevo (no existía ninguno en toda la app) + manejo de error inline en acciones críticas (eliminar reserva, fusionar duplicado, archivar vehículo) para mostrar el motivo del rechazo en vez de la pantalla de error técnica de Next.
  - **fix(settings):** confirmación de dos pasos al borrar un medio de pago o un ítem de checklist.
  - **fix(nav):** Reportes/Usuarios/Configuración suben a la barra principal (antes enterrados en el dropdown de cuenta, sin pista visual).
- **Performance:**
  - **PERF-01:** `signature_pad` pasa a `import()` dinámico (antes en el bundle inicial de los 7 pasos del wizard, aunque solo lo usa "Firma").
  - **ARQ-02 / PERF-02:** en `reports.ts`, el costo de mantenimiento por vehículo pasa de traer cada registro a un `groupBy` agregado en la base (acotado al tamaño de la flota); `getReports()` se cachea (`unstable_cache`, 60s, sin invalidación por tag — es analítica de admin, tolera hasta 1 minuto desactualizado). El dashboard de Home (`getDashboardData`) queda **a propósito sin caché**: es el estado operativo del día, necesita reflejar cambios al instante.
- **UX-24 (nuevo, no viene de la auditoría original):** resumen diario de alertas vencidas (devoluciones + service) por email al admin. Endpoint `POST /api/daily-summary` (autenticado por `CRON_SECRET`, mismo criterio que `/api/sync`) + botón manual "Enviar resumen ahora" en `/sync` (admin) para probarlo. **Falta programar el cron diario en Railway** (ver pendientes abajo).

**No implementado — PROD-03 (plantillas de condiciones económicas por modelo/segmento):** requiere una decisión de producto antes de tocar el schema (hoy `ConditionSettings` es un singleton global, sin concepto de segmento en `Vehicle`). Opciones evaluadas con el dueño, sin definir todavía: (a) agregar un campo "segmento" al vehículo + una plantilla por segmento, (b) una plantilla opcional por cada marca+modelo exacto (sin campo nuevo, pero con hasta 14 plantillas), o (c) override de condiciones directo en la ficha de cada auto, sin entidad de plantilla. **Pendiente de decisión.**

**Ítems de prioridad "Baja" del backlog, sin implementar:** UX-16, UX-17, UX-20, UX-23; UI-08, UI-11, UI-12, UI-13, UI-14; COD-08, COD-10, COD-12, COD-13; ARQ-03, ARQ-04, ARQ-06; PERF-03, PERF-04, PERF-05, PERF-06; SEC-07, SEC-08; PROD-05.

## v56 — Configuración → Nube (uso de base de datos y archivos)

Página admin `/settings/cloud` para ver cuánto espacio usan la base de datos y el almacenamiento de archivos. tsc/lint/tests en verde; **sin probar en navegador** (en local no hay R2, muestra "sin R2 configurado"). Sin migración.

- **Archivos (R2):** `getFileUsage` (`src/lib/cloud-usage.ts`) lista el bucket completo (`ListObjectsV2` paginado, a demanda) y suma bytes/cantidad por tipo según la clave (`categorizeKey`: fotos, daños, videos, firmas, documentos, actas, WhatsApp). Barra contra los 10 GB del plan gratuito de R2 (`R2_FREE_TIER_BYTES`).
- **Base de datos:** `getDatabaseUsage` con `pg_database_size` + las 8 tablas más pesadas (`pg_total_relation_size`, filas estimadas). Sin barra: Railway factura por uso, no hay tope fijo.
- Ítem "Nube" en `/settings`.

## v56 — Limpiar archivos de la nube (descargar, comprimir, eliminar)

Herramienta admin en **Configuración → Nube → "Limpiar archivos"** (`/settings/cloud/cleanup`) para liberar espacio de R2 por rango de fechas y categoría. Construida y **verificada de punta a punta en navegador (375px) contra la base y el storage locales** con datos sembrados (casos elegibles y no elegibles); build/lint/tsc/tests en verde (+40 tests). Migración `add_storage_cleanup` **aplicada solo en local, sin desplegar todavía** (el Pre-Deploy de Railway la corre sola). **Falta:** probar en prod con archivos reales — el ahorro de compresión medido en local usó imágenes de ruido sintético (muy comprimibles); con fotos reales va a ser bastante menor.

- **Flujo**: el admin elige **desde/hasta** (obligatorias) y categorías → "Buscar archivos" muestra, por acción, cuántos archivos y cuánto pesan → **Descargar** (ZIP por partes de hasta 250 MB, carpeta por reserva/conversación, streaming con `fflate`), **Comprimir** y **Eliminar**. Historial de corridas (quién, cuándo, cuánto liberó) con "Continuar" si una quedó a medias.
- **Inventario desde la base, no por prefijo** (`src/lib/storage-cleanup.ts`): parte de `InspectionMedia`/`Damage`/`RentalDocument`/`WhatsAppMedia`/firmas/actas y lo cruza con el listado real del bucket (`Storage.list()`, nuevo junto a `delete()`; R2 y disco local). Categorías y reglas puras en `storage-cleanup-rules.ts` (testeadas).
- **Reglas de seguridad de eliminar** (evidencia): solo alquileres **finalizados**, inspección con evidencia **completa**, **acta guardada** en el bucket y **más de 180 días** (`MIN_AGE_DAYS`); fotos de daños solo si el daño ya se **reparó** (y hace >180 días). **Firmas y actas NUNCA se eliminan** (ni son categorías de esa acción). **WhatsApp** (fotos/videos/audios/documentos) sin antigüedad mínima; el mensaje queda y el adjunto se muestra como "🗑 Adjunto eliminado" (`WhatsAppMedia.deletedAt`).
- **Respaldo obligatorio y verificado del lado del servidor**: eliminar exige haber descargado **todas las partes del mismo conjunto exacto de archivos** (`StorageExport.planHash`, `completedAt` solo si se leyeron todos los archivos de la parte). Además hay que escribir ELIMINAR. Nota honesta: "descargada" = el servidor terminó de enviar el stream, no que el navegador lo haya guardado.
- **Ejecución por tandas** (`storage-cleanup-run.ts`): el plan se congela en `StorageCleanupRun.plan` y `doneCount` es el cursor; cada tanda reclama su tramo con un update condicional (dos pestañas no procesan lo mismo) y una corrida cortada se retoma. Eliminar: 100 por tanda; comprimir: 8.
- **Lo eliminado se ve bien**: `DeletedFile` (clave, categoría, bytes) → `/api/media` devuelve un SVG "Archivo eliminado" en vez de un 404 roto (fotos de daños, documentos); las filas que referenciaban el archivo quedan intactas.
- **Compresión sin perder contenido** (`src/lib/file-compress.ts`, `sharp` + `pdf-lib`, nuevas dependencias directas): **fotos** → máx. 1600 px JPEG q72; **firmas** → PNG recomprimido sin pérdida visible (mismos píxeles y transparencia; el optimizador solo cambia el color RGB de píxeles 100% transparentes); **actas** → NO se regeneran (podrían cambiar de contenido: etiquetas, condiciones, daños de otros alquileres): se reabre el PDF y solo se **reducen las fotos JPEG embebidas** (validado con un PDF real de `@react-pdf/renderer`: 794 KB → 155 KB), verificando que el resultado reabra con las mismas páginas. Solo se reemplaza si baja ≥15%; ante cualquier falla el original queda igual. Comprimir solo toca lo de más de 30 días. Videos/audios no se comprimen (haría falta ffmpeg).
- **Las actas nuevas ya se generan comprimidas**: `renderActaBuffer` aplica `compressPdfImages` al final (acta guardada y adjunta al email más liviana; si falla o no hay ahorro, sale el PDF original).
- **Fuera de alcance**: archivos huérfanos (subidas de borradores nunca guardados), videos/audios, y `WhatsAppBotDocument`/foto de vehículo (no se tocan).

## v57 — Paleta de comandos (Ctrl/⌘ + K)

Buscador para saltar a cualquier sección sin recorrer la barra. Construida y probada en local (tsc/lint/644 tests en verde; verificado por navegador con Playwright en desktop y 375px, admin y empleado). Sin migración ni dependencias nuevas. **Sin desplegar todavía.**

- **Atajo y botones**: Ctrl/⌘ + K abre/cierra (listener global en `AppNav`); además hay una lupa en el header de desktop y de mobile (`CommandPaletteButton`). Flechas para moverse, Enter para ir, Esc para cerrar.
- **Catálogo** en `src/lib/command-palette.ts` (puro, testeado): destinos "Ir a" (barra principal + Perfil/Sincronización/GPS/Competencia), "Crear" (nueva reserva, vehículo, usuario, hoja de QR) y "Configuración" (cada sub-pantalla). Los de admin (`adminOnly`) no se ofrecen a un empleado — la guarda real sigue en cada página. **Si se agrega una pantalla nueva, sumarla a `COMMANDS`.**
- **Búsqueda**: sin tildes ni mayúsculas, con sinónimos (`keywords`: "plata" → Caja, "chakra" → Cuenta de WhatsApp); todos los términos tienen que matchear y el título pesa más que un sinónimo.
- **Alcance a propósito**: solo navegación a pantallas fijas. No busca reservas/clientes/vehículos puntuales (eso lo cubre el buscador del Home) ni abre pestañas internas de Caja (son estado de cliente, no URL).

## v86 — Selector de tema (Automático / Claro / Oscuro) en Perfil

El modo oscuro ya existía pero solo seguía al sistema (`prefers-color-scheme`). Ahora en **Perfil → Apariencia** (`theme-selector.tsx`) cada uno elige Automático / Claro / Oscuro. **Se guarda por dispositivo** (`localStorage` `andes-theme`, no en la base). tsc/lint/tests en verde; verificado con Playwright a 375px (los 3 modos, persistencia al recargar, y Automático siguiendo un cambio del sistema en vivo).

- **El tema efectivo es un atributo** `data-theme="light|dark"` en `<html>`, fijado antes del primer pintado por `THEME_INIT_SCRIPT` (`src/lib/theme.ts`, inline en `src/app/layout.tsx` — sin parpadeo; el CSP ya permitía `unsafe-inline`). En Automático escucha los cambios del sistema.
- `globals.css`: los bloques `@media (prefers-color-scheme: dark)` pasaron a `[data-theme="dark"]`, y la variante `dark:` de Tailwind se redefinió con `@custom-variant dark` sobre ese atributo — las clases `dark:` existentes funcionan sin tocarlas. **Si se agregan colores de modo oscuro nuevos, usar `[data-theme="dark"]`, no la media query.** Se sumó `color-scheme: dark` (inputs/scrollbars nativos oscuros).

## v94 — Reorganización de la navegación: GPS a Vehículos, Horarios/Accesos a Tareas, Competencia oculta

Pedido del dueño sobre el menú de cuenta, que se había ido llenando de ítems sueltos. tsc/lint/build/898 tests en verde; **verificado de punta a punta con Playwright real contra la base local** (admin y empleado, desktop 1280px y 375px): menú de cuenta sin los ítems movidos/ocultos, pestaña GPS dentro de Vehículos, pestañas Horarios/Accesos dentro de Tareas, resaltado de la barra principal correcto en cada caso, `/competitor-prices` sigue respondiendo por URL directa (solo se ocultó de la navegación), paleta de comandos actualizada.

- **GPS pasa a ser una pestaña más de `FleetTabs`** (`src/components/rooms/fleet-tabs.tsx`: Vehículos | Terceros | Permisos | **GPS** | Habitaciones), con `<FleetTabs active="gps" />` agregado en `src/app/(app)/gps/page.tsx`. Se saca del menú de cuenta.
- **Horarios y Accesos pasan a vivir dentro de Tareas**, mismo patrón: `TeamTabs` nuevo (`src/components/tasks/team-tabs.tsx`: Tareas | Horarios | Accesos), agregado en `/tasks`, `/horarios` y `/access`. Se sacan del menú de cuenta.
- **"Competencia" se oculta** del menú de cuenta y de la paleta de comandos — **no se bloquea la ruta**: `/competitor-prices` sigue respondiendo por URL directa a quien ya la tenía guardada, a propósito (es solo una cuestión de "no se logró dejarla bien todavía", no de restringir acceso). Si en algún momento hay que bloquearla de verdad, falta un guard en `src/app/(app)/competitor-prices/page.tsx`.
- **`menuItems`** (`src/components/app-nav.tsx`) queda reducido a Perfil, Sincronización y (admin) Configuración.
- **Fix real encontrado al verificar** (no estaba en el pedido, lo encontró el propio test E2E): la barra principal de **desktop** no resaltaba "Vehículos" al entrar a `/third-party-vehicles`, `/rooms` o `/permits` (ni iba a resaltar "Vehículos"/"Tareas" para GPS/Horarios/Accesos) — `NavLink` (usado solo por `mainItems` en desktop) calculaba su propio estado activo con `usePathname()` en vez de usar la `isActive` compartida que ya usaban el menú de cuenta y **mobile** (`MobileNav` sí la usaba, por eso ahí nunca se notó). `NavLink` pasa a recibir `active` como prop desde `DesktopNav` (misma `isActive` de siempre, con `/third-party-vehicles`/`/permits`/`/gps`/`/rooms` agrupados bajo `/vehicles` y `/horarios`/`/access` bajo `/tasks`) — una sola fuente de verdad para los tres lugares (dropdown, mobile, barra de desktop) en vez de dos lógicas paralelas.
- Sin migración, sin cambios de datos.

## v120 — Configuración → Correos: quién recibe qué, destinatarios del informe mensual y envío de actas

Pedido del dueño. tsc/lint/build/1071 tests en verde (+6 en `monthly-report-recipients.test.ts`); verificado con Playwright a 375px y 1280px contra la base local (destinatarios en vivo, vista previa, guardado de roles/textos/actas, y que guardar "Condiciones y checklist" ya no toca el envío de actas; datos de prueba borrados). Migración `add_monthly_report_recipients` **aplicada solo en local, sin desplegar todavía**.

- **Página rediseñada** (`/settings/emails`): arriba un resumen **"Quién recibe qué"** (actas, informe mensual, resumen diario, contrato de cesión) con lo guardado; después Casillas, Actas al cliente, Informe mensual y el texto del correo de las actas, con un solo "Guardar cambios" fijo abajo.
- **Casilla de administración en solo lectura**: muestra `ADMIN_EMAIL` (o un aviso rojo si falta) y qué recibe. Se sigue cambiando solo en Railway.
- **Envío de actas al cliente** se movió acá desde "Condiciones y checklist" (ahí queda un link). Los campos siguen en `ConditionSettings.sendHandoverActa/sendReturnActa` y los cambios siguen en su historial; `saveConditions` ya no los escribe (sin las casillas en ese form, los habría apagado).
- **Destinatarios del informe mensual** (`EmailSettings.monthlyReportRoles` UserRole[] default `[observador]` + `monthlyReportToOwner` default true): casillas por rol (Empleado/Administrador/Finanzas/Socio) + Propietario, con la lista real de destinatarios recalculada en vivo. **El informe ya no va a `ADMIN_EMAIL`.** Lógica pura en `src/lib/email/monthly-report-recipients.ts`; lectura en `getMonthlyReportRecipients` (`src/lib/email/settings.ts`). Quien no ve las cuentas "Solo Finanzas" recibe un informe calculado sin ellas (`getReports(period, false)`), así que con destinatarios de los dos tipos se generan dos informes (dos llamadas a Claude). Sin destinatarios, el botón de Reportes avisa. El informe ahora usa el remitente de Configuración (`resolveFromAddress`), como las actas.
- **Texto del correo**: pestañas Español/Inglés (las dos montadas, para que se guarden ambas), bloques Entrega/Devolución/Partes comunes y **vista previa en vivo** (`EmailTextsEditor`).
