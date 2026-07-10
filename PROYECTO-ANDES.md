# Proyecto Andes — Sistema de entregas y devoluciones de MDZ Rent a Car

**Dominio:** https://andes.mdzrentacar.com
**Estado:** Especificación v1 — lista para desarrollo
**Fecha:** Julio 2026

---

## 1. Contexto y objetivo

MDZ Rent a Car es una empresa de alquiler de autos en Mendoza, Argentina. Las reservas se registran en el sitio principal (WordPress en Hostinger, con un plugin de reservas). Las entregas y devoluciones de vehículos se hacen en el aeropuerto o en la calle, y hoy no hay registro digital estructurado del estado del auto en cada movimiento.

**Andes** es una aplicación web interna que digitaliza ese proceso:

1. El empleado registra la **entrega** del auto con un checklist desde su celular: estado del vehículo, kilometraje, nivel de nafta, daños existentes, fotos/video opcionales.
2. El **cliente firma en la pantalla** del dispositivo aceptando el estado del vehículo.
3. El sistema genera un **acta en PDF** y la envía por email al cliente y al administrador.
4. En la **devolución** se repite el proceso, y el sistema **compara automáticamente** contra la entrega: kilómetros recorridos, diferencia de nafta y daños nuevos.
5. Un **dashboard interno** muestra la flota (alquilados, disponibles, movimientos del día) y cada auto tiene un **perfil** con su historial completo.
6. El sistema lee las **reservas del WordPress** para asociarlas a las entregas y devoluciones.

### Objetivos de la v1

- Que una entrega o devolución completa tome **menos de 5 minutos** en el lugar.
- Evidencia sólida ante disputas por daños (checklist + fotos con fecha/hora + firma).
- Visibilidad total de la flota y del historial de cada auto.

---

## 2. Decisiones ya tomadas

| Tema | Decisión |
|---|---|
| Hosting de la app | **Railway** (app + PostgreSQL). El sitio WordPress sigue en Hostinger. |
| Subdominio | `andes.mdzrentacar.com` vía registro CNAME en el DNS de Hostinger apuntando a Railway. |
| Fotos/video en checklist | **Opcionales** (fotos o video corto). Se recomiendan pero no bloquean el flujo. |
| Aceptación del cliente | **Firma manuscrita en pantalla** (canvas), guardada como imagen e incluida en el acta PDF. |
| Origen de reservas | **VikRentCar** (plugin de VikWP/E4J) en el WordPress de Hostinger. |
| Integración con WP | **Sincronización periódica** hacia la base propia (no consultas en vivo). |
| Idioma | App en **español por defecto**. Contenido para el cliente (acta PDF, emails, pantalla de firma) **conmutable a inglés** por alquiler; se preselecciona según el idioma de la reserva en VikRentCar. |

### Pendientes a confirmar con el dueño

- [ ] Cantidad de autos en la flota y cantidad de empleados que usarán el sistema.
- [ ] Casilla de email remitente (sugerido: `entregas@mdzrentacar.com`) — requiere verificar el dominio en Resend.
- [ ] Política de nafta (¿se cobra diferencia? por ahora solo se registra, no se cobra).
- [ ] Registro de depósitos en garantía / pagos: **fuera de la v1** salvo indicación contraria.
- [ ] Versión de VikRentCar instalada (free o Pro) y si hoy usan sus funciones de daños/check-in PDF, para migrar esos datos si hace falta.

---

## 3. Usuarios y roles

| Rol | Permisos |
|---|---|
| **Administrador** | Todo: dashboard, perfiles de autos, gestión de vehículos y usuarios, edición de alquileres, configuración, reportes. Recibe copia de todas las actas. |
| **Empleado** | Realizar entregas y devoluciones, ver el listado de movimientos del día, consultar (solo lectura) el perfil de un auto. |

Autenticación con email y contraseña. Sesiones largas en dispositivos de trabajo (los empleados no deben loguearse en cada entrega).

---

## 4. Flujos principales

### 4.1 Flujo de entrega

1. **Iniciar entrega:** el empleado elige la reserva desde la lista de entregas del día, o busca por patente/nombre del cliente. (Futuro: escanear QR pegado en el auto.)
2. **Confirmar datos:** cliente (nombre, email, teléfono), vehículo, fechas del alquiler. Si la reserva vino de WordPress, los datos ya están precargados. Si no existe reserva, se puede crear un alquiler manual en el momento.
3. **Estado del vehículo:**
   - Kilometraje actual (numérico, teclado numérico en móvil).
   - Nivel de nafta en octavos (selector visual 0/8 a 8/8).
   - Checklist de ítems: luces, cubiertas, rueda de auxilio, gato, llave de rueda, matafuegos, balizas, documentación (cédula, seguro, VTV), limpieza interior/exterior, funcionamiento de aire acondicionado. La lista de ítems debe ser configurable por el admin.
4. **Daños existentes:** croquis del auto (vista superior) donde el empleado toca para marcar rayones/golpes, con descripción corta y foto opcional por daño. Los daños ya registrados del vehículo aparecen premarcados.
5. **Fotos/video (opcional):** captura rápida desde la cámara — sugerido frente, atrás y laterales. Compresión en el cliente antes de subir. Cada archivo guarda fecha y hora.
6. **Observaciones libres** (texto opcional).
7. **Firma del cliente:** pantalla de firma en canvas, con nombre y aclaración. Texto legal breve: "Acepto el estado del vehículo descripto en este documento".
8. **Confirmación:** resumen final → guardar. El alquiler pasa a estado **activo** y el auto a **alquilado**.
9. **Post-guardado (asíncrono):** generación del acta PDF y envío de emails a cliente y admin. Si el email falla, se reintenta; el acta queda siempre descargable desde el sistema.

### 4.2 Flujo de devolución

1. **Iniciar devolución:** lista de devoluciones esperadas del día o búsqueda por patente/cliente entre alquileres activos.
2. **Estado del vehículo:** kilometraje, nafta, mismo checklist y croquis de daños que en la entrega.
3. **Comparación automática** (pantalla propia antes de firmar):
   - Kilómetros recorridos (km devolución − km entrega).
   - Diferencia de nivel de nafta.
   - **Daños nuevos**: todo daño marcado que no estaba en la entrega se resalta claramente.
4. **Firma del cliente** aceptando la comparación.
5. **Cierre:** el alquiler pasa a **finalizado**, el auto vuelve a **disponible**, se actualiza su kilometraje, los daños nuevos quedan en el historial del vehículo. Acta PDF de devolución (incluye la comparación) → emails a cliente y admin.

### 4.3 Dashboard (admin)

- **Hoy:** entregas y devoluciones programadas, con estado (pendiente / completada / demorada).
- **Flota:** autos alquilados ahora (con cliente y fecha de devolución esperada), autos disponibles, autos fuera de servicio.
- **Alertas:** devoluciones vencidas sin registrar, services próximos por kilometraje, reservas de WordPress sin vehículo asignado.

### 4.4 Perfil del vehículo

- Datos: patente, marca, modelo, año, color, foto principal, kilometraje actual, estado (disponible / alquilado / fuera de servicio).
- Historial de alquileres con fechas, cliente, km recorridos.
- Historial de inspecciones (entregas y devoluciones) con acceso a cada acta.
- **Registro de mantenimiento:** anotaciones de service, arreglos y gastos con fecha, kilometraje, costo y descripción libre. Campo "próximo service a los X km" que alimenta las alertas.
- Daños activos del vehículo sobre el croquis.
- Gráfico simple de evolución del kilometraje.

### 4.5 Alquiler manual

No todas las reservas vienen de WordPress (teléfono, WhatsApp, mostrador). El admin o empleado puede crear un alquiler manualmente con datos del cliente, vehículo y fechas. El flujo de entrega/devolución es idéntico.

---

## 5. Integración con WordPress (VikRentCar)

El sitio usa el plugin **VikRentCar** (VikWP/E4J). **Estrategia: sincronización periódica, nunca consulta en vivo.** La app debe funcionar aunque el WordPress esté caído o lento.

### Estructura esperada de VikRentCar (verificar en Fase 0 contra la instalación real)

VikRentCar nació como software para Joomla y muchos nombres de columnas derivan del italiano. Las tablas llevan el prefijo de WordPress (típicamente `wp_vikrentcar_*`):

- **`wp_vikrentcar_orders`** — la reserva. Campos clave esperados: `id`, `status` (`confirmed` / `standby` / `cancelled`), `idcar` (vehículo/modelo), `carindex` (número de unidad cuando el modelo tiene varias), `ritiro` (fecha/hora de retiro, timestamp Unix), `consegna` (fecha/hora de devolución, timestamp Unix), `idplace` / `idreturnplace` (lugares de retiro y devolución), `days`, `order_total`, `totpaid`, `custmail`, `custdata`, `phone`, `lang` (idioma con el que reservó el cliente), `ts` (fecha de creación), `sid`.
- **`wp_vikrentcar_customers`** y **`wp_vikrentcar_customers_orders`** — datos estructurados del cliente (nombre, apellido, email, teléfono, país) y su vínculo con cada orden. Preferir estos datos sobre el campo crudo `custdata`.
- **`wp_vikrentcar_cars`** — los vehículos/modelos cargados en el plugin, con cantidad de unidades. Sirve para el **seed inicial** de nuestra tabla `vehicles`.
- **`wp_vikrentcar_places`**, **`wp_vikrentcar_categories`**, **`wp_vikrentcar_busy`** — lugares, categorías y ocupación (referencia).

### Reglas de sincronización

- **Mecanismo preferido:** usuario MySQL **de solo lectura** creado en hPanel de Hostinger con "Remote MySQL" habilitado. Un worker en Railway sincroniza cada 5–10 minutos las órdenes nuevas o modificadas hacia la tabla propia `rentals`, guardando el `id` de VikRentCar como `wp_booking_id`.
- **Plan B** (si Hostinger complica el acceso remoto o la IP saliente de Railway es un problema): mini plugin de WordPress que expone las órdenes por REST protegido con API key.
- Se importan las órdenes con estado `confirmed` (importar `standby` como "pendientes" es configurable). Cancelaciones y cambios de fecha en VikRentCar actualizan el registro local si el alquiler todavía no tiene entrega registrada.
- **Mapeo de vehículo:** un vehículo físico nuestro se identifica en VikRentCar por el par (`idcar`, `carindex`). La tabla `vehicles` guarda ambos como campos opcionales. Si una orden llega sin unidad asignada, queda como "reserva sin vehículo asignado" y aparece en las alertas del dashboard para asignarla a mano.
- **Idioma:** el campo `lang` de la orden preselecciona el idioma del acta y del email (es/en). El empleado puede cambiarlo en el momento de la entrega.
- Cada sincronización se registra en `sync_logs` (visible para el admin) con conteo de importadas, actualizadas y errores.
- VikRentCar tiene sus propias funciones de registro de daños y PDF de check-in; **no se usan**: desde la puesta en marcha, Andes es la fuente de verdad del estado físico de los autos. Si hoy hay daños cargados en VikRentCar, se migran una única vez en el seed inicial.
- **Fase 0 (descubrimiento):** conectarse a la base MySQL (o a un dump provisto por el dueño), confirmar nombres exactos de tablas y columnas según la versión instalada, y documentar el mapeo definitivo en `docs/wordpress-mapping.md` antes de programar el worker.

---

## 6. Arquitectura y stack

| Capa | Elección | Motivo |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Full-stack en un solo deploy, SSR rápido en móvil. |
| Base de datos | **PostgreSQL en Railway** + **Prisma** | Migraciones ordenadas, tipado fuerte. |
| UI | **Tailwind CSS**, mobile-first | Interfaz rápida y consistente en celular/tablet. |
| PWA | Manifest + service worker | Instalable en el celular del empleado, assets cacheados. |
| Almacenamiento de archivos | **Cloudflare R2** (S3-compatible) | Fotos, videos, firmas y PDFs. Tier gratuito generoso; no cargar archivos pesados en Railway. |
| Firma en pantalla | Canvas (ej. `signature_pad`) | Exporta PNG que se embebe en el acta. |
| PDF | `@react-pdf/renderer` (o similar) | Acta de entrega/devolución con logo, datos, checklist, daños, fotos en miniatura y firma. |
| Email | **Resend** (dominio verificado `mdzrentacar.com`) | Emails transaccionales con el acta adjunta. |
| Sync WP | Worker/cron en Railway + `mysql2` (solo lectura) | Ver sección 5. |
| Auth | Auth.js (credenciales email+contraseña) con roles | Simple y suficiente para uso interno. |

### Modelo de datos (orientativo)

- `users` — nombre, email, hash de contraseña, rol (admin/empleado), activo.
- `vehicles` — patente, marca, modelo, año, color, km actual, estado, próximo service (km), foto, notas, `wp_car_id` y `wp_car_index` nullable (mapeo a la unidad de VikRentCar).
- `rentals` — vehículo, cliente (nombre, email, teléfono, nro. de documento opcional), fechas desde/hasta, origen (vikrentcar/manual), `wp_booking_id` nullable, idioma del cliente (`es`/`en`, default `es`), estado (reservado/activo/finalizado/cancelado).
- `inspections` — tipo (entrega/devolución), rental, vehicle, user, km, nivel de nafta (0–8), respuestas del checklist (JSON), observaciones, firma (URL), nombre del firmante, timestamp, geolocalización opcional.
- `inspection_media` — inspección, tipo (foto/video), URL, timestamp de captura.
- `damages` — vehículo, inspección donde se detectó, posición en croquis (x, y, vista), descripción, foto opcional, activo/reparado.
- `maintenance_logs` — vehículo, tipo (service/arreglo/gasto/nota), fecha, km, costo opcional, descripción.
- `checklist_items` — ítems configurables del checklist (etiqueta, orden, activo).
- `sync_logs` — fecha, resultado, reservas importadas, errores.

---

## 7. Requisitos no funcionales

- **Mobile-first real:** todo el flujo de entrega/devolución se diseña para una mano y una pantalla de celular. Botones grandes, un paso por pantalla, teclado numérico donde corresponde. El dashboard puede asumir tablet/escritorio.
- **Rápido con mala señal:** carga inicial < 3 s en 4G. Formulario multipaso con **autoguardado local** (localStorage/IndexedDB): si se corta la señal o se cierra el navegador, no se pierde lo cargado. Las fotos se comprimen en el cliente antes de subir y se suben en segundo plano.
- **PDF y emails asíncronos:** nunca bloquean la confirmación del empleado en el lugar.
- **Idiomas:** UI de empleados en español (Argentina). Todo lo que ve el cliente (acta PDF, emails, pantalla de firma) sale en **español por defecto y puede cambiarse a inglés** por alquiler; si la reserva viene de VikRentCar, el idioma se preselecciona desde el campo `lang` de la orden y el empleado puede cambiarlo antes de firmar. Implementar los textos de cliente con diccionarios i18n (nada hardcodeado) para poder extender el inglés a toda la app en el futuro.
- **Zona horaria:** America/Argentina/Mendoza en toda la app.
- **Auditoría:** toda inspección guarda quién, cuándo y desde dónde (si el dispositivo da permiso de ubicación). Las inspecciones firmadas son inmutables: correcciones solo por nota del admin, nunca editando el registro.
- **Backups:** backups automáticos de PostgreSQL en Railway habilitados desde el día 1.

---

## 8. Plan de trabajo por fases

Cada fase termina con algo desplegado y usable. No avanzar de fase sin cerrar la anterior.

**Fase 0 — Fundaciones y descubrimiento (1ª sesión)**
Repo, Next.js + Prisma + Tailwind, deploy a Railway, subdominio `andes.mdzrentacar.com` con SSL funcionando. Inspección de las tablas de **VikRentCar** en la base de WordPress (o en un dump) para confirmar el esquema de la versión instalada y escribir `docs/wordpress-mapping.md`. Definición de variables de entorno.

**Fase 1 — Núcleo de datos y autenticación**
Modelo de datos completo con migraciones. Login con roles. ABM de vehículos y de usuarios. Creación de alquileres manuales. Seed de datos de prueba.

**Fase 2 — Flujo de entrega completo**
Formulario multipaso móvil con autoguardado, checklist configurable, croquis de daños, captura de fotos/video con compresión, firma en canvas, subida a R2, acta PDF y envío de emails **en el idioma del alquiler (es/en, default es)**. **Es la fase más importante: probar en un celular real.**

**Fase 3 — Flujo de devolución y comparación**
Reutiliza los componentes de la Fase 2 y agrega la pantalla de comparación (km, nafta, daños nuevos), cierre del alquiler y actualización del vehículo.

**Fase 4 — Dashboard y perfil del vehículo**
Vista "hoy", estado de flota, alertas. Perfil completo del auto con historiales y registro de mantenimiento.

**Fase 5 — Sincronización con VikRentCar**
Worker de sync según el mapeo de la Fase 0: importación de órdenes confirmadas, mapeo (`idcar`, `carindex`) → vehículo, preselección de idioma desde `lang`, manejo de cancelaciones, seed inicial de vehículos desde `wp_vikrentcar_cars`, log de sincronización y alerta de "reserva sin vehículo asignado".

**Fase 6 — Refinamientos**
QR por vehículo, alertas de service por km, mejoras de rendimiento y PWA offline más profunda.

---

## 9. Fuera de alcance de la v1

- Cobros, pagos, depósitos en garantía y facturación.
- Motor de reservas propio (las reservas siguen naciendo en WordPress o se cargan a mano).
- App nativa (la PWA cubre la necesidad).
- Multi-sucursal / multi-empresa.
- Portal de autogestión para el cliente (el cliente solo firma y recibe emails).

---

## 10. Variables de entorno previstas

```
DATABASE_URL=            # PostgreSQL en Railway
WP_MYSQL_HOST=           # MySQL de Hostinger (solo lectura)
WP_MYSQL_PORT=
WP_MYSQL_DATABASE=
WP_MYSQL_USER=
WP_MYSQL_PASSWORD=
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=andes-media
RESEND_API_KEY=
EMAIL_FROM=              # ej: entregas@mdzrentacar.com
ADMIN_EMAIL=             # recibe copia de todas las actas
AUTH_SECRET=
NEXT_PUBLIC_APP_URL=https://andes.mdzrentacar.com
```
