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

- [~] **Fase 0 — Fundaciones y descubrimiento WP** (casi cerrada)
  - Hecho: proyecto Next.js 16 (App Router) + TypeScript estricto + Tailwind v4 + ESLint; Prisma 6 con datasource PostgreSQL (sin modelos aún, van en Fase 1) y cliente singleton; PWA (manifest + service worker conservador + registro); i18n es/en desde día 1 (`src/lib/i18n`); helpers de zona horaria Mendoza (`src/lib/datetime.ts`); acceso tipado a env (`src/lib/env.ts`); `.env.example`. Build y lint en verde. Repo en GitHub (`gsuarezduek/andes`), Railway deploya de ahí.
  - **Descubrimiento VikRentCar: HECHO y verificado** contra la instalación real (MariaDB 11.8.8, prefijo `wp_vikrentcar_`). Ver `docs/wordpress-mapping.md`. Hallazgos clave: `status` = confirmed/cancelled/standby; `ritiro`/`consegna`/`ts` = Unix segundos; `lang` mayormente NULL (→es); `carindex` NULL frecuente (688) → "sin unidad asignada" es caso común; **77% de las confirmed sin `customers_orders`** → fallback a `nominative`/`custmail`/`phone` obligatorio; flota ≈ **18 unidades / 14 modelos**; `orders` **sin columna de "modificado"** → sync incremental vía `orderhistory` o ventana móvil.
  - **Nota Prisma:** se fijó Prisma **6** a propósito. Prisma 7 sacó el `url` del schema y exige driver adapters + `prisma.config.ts`; se mantiene el flujo clásico (`migrate dev`, `studio`, cliente sin adapter) que asume el brief.
  - Pendiente para cerrar la fase: (1) propagación DNS de `andes.mdzrentacar.com` → Railway + SSL (CNAME cargado, a la espera); (2) verificar deploy en Railway y cargar variables de entorno.
- [ ] Fase 1 — Datos y autenticación
- [ ] Fase 2 — Flujo de entrega
- [ ] Fase 3 — Flujo de devolución
- [ ] Fase 4 — Dashboard y perfil de vehículo
- [ ] Fase 5 — Sync VikRentCar
- [ ] Fase 6 — Refinamientos

## Pendientes que dependen del dueño

- ~~Acceso read-only a WordPress para Fase 0~~ ✅ provisto y descubrimiento hecho.
- **Seguridad WP MySQL:** el "Remote MySQL" quedó abierto a cualquier IP (`%`) para el descubrimiento. Cerrarlo antes de Fase 5 → decidir Plan B REST (recomendado) o egress IP fija de Railway. Ver `docs/wordpress-mapping.md`.
- Casilla remitente de emails y verificación del dominio en Resend.
- ~~Tamaño de flota~~ ≈ 18 unidades / 14 modelos (de `wp_vikrentcar_cars`). Falta cantidad de empleados.
- Política de nafta (por ahora solo se registra la diferencia, no se cobra).
- ~~Versión VikRentCar / daños en el plugin~~ free, sin daños cargados para migrar (reconfirmar).
