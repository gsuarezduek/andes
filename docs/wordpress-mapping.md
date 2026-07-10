# Mapeo VikRentCar → Andes

> **Estado: VERIFICADO contra la instalación real** (Fase 0, 2026-07).
> Base: **MariaDB 11.8.8**, host `srv552.hstgr.io`, esquema `u868531572_id8bM`.
> Prefijo de tablas: **`wp_vikrentcar_`**. Acceso usado: usuario MySQL de solo
> lectura vía "Remote MySQL" de Hostinger.
>
> Este documento es la fuente de verdad del mapeo para el worker de sync (Fase 5).

## Acceso y seguridad

- **Verificación (Fase 0):** hecha con usuario **read-only** de Hostinger.
- **Regla dura (CLAUDE.md):** contra WordPress, **solo `SELECT`**. Nunca escribir,
  nunca importar el esquema de WP a Prisma.
- ⚠️ **Pendiente de seguridad para producción:** durante el descubrimiento el
  "Remote MySQL" quedó abierto a **cualquier IP (`%`)**. Eso expone la base de WP
  (con PII de clientes) a internet. **Antes de Fase 5, decidir:**
  - **(a)** *Static egress IP* de Railway (feature pago) + whitelist puntual, o
  - **(b, recomendado)** **Plan B**: mini plugin de WordPress que exponga las
    órdenes por REST con API key, sin abrir el MySQL. Ver `PROYECTO-ANDES.md §5`.
  - Mientras tanto, cerrar el `%` y dejar solo la IP del entorno de trabajo.

## Tablas presentes

Existen 35 tablas `wp_vikrentcar_*`. Relevantes para Andes:

| Tabla | Filas | Uso |
|---|---:|---|
| `wp_vikrentcar_orders` | 2204 | La reserva → `rentals` |
| `wp_vikrentcar_customers` | 857 | Datos estructurados del cliente |
| `wp_vikrentcar_customers_orders` | 556 | Join orden↔cliente |
| `wp_vikrentcar_cars` | 14 | Modelos → seed de `vehicles` |
| `wp_vikrentcar_categories` | 5 | Categorías (referencia) |
| `wp_vikrentcar_places` | 7 | Lugares de retiro/devolución |
| `wp_vikrentcar_busy` | 2062 | Ocupación; `realback` = devolución real |
| `wp_vikrentcar_orderhistory` | 3223 | Eventos de la orden → sync incremental |

## `wp_vikrentcar_orders` (esquema real)

Columnas verificadas (las relevantes; hay más de pagos/impuestos que no usamos):

| Columna | Tipo real | Nullable | → Andes / notas |
|---|---|---|---|
| `id` | int unsigned | no | `rentals.wp_booking_id` |
| `status` | varchar(128) | sí | Valores reales: **`confirmed` / `cancelled` / `standby`** |
| `idcar` | int(10) | sí | mapeo → `vehicles.wp_car_id` |
| `carindex` | int(5) | sí | mapeo → `vehicles.wp_car_index`. **NULL frecuente** (ver abajo) |
| `ritiro` | int(10) | sí | **Unix segundos** → `rentals.start_at` (UTC) |
| `consegna` | int(10) | sí | **Unix segundos** → `rentals.end_at` (UTC) |
| `ts` | int(11) | sí | **Unix segundos**, fecha de creación. **No hay columna de "modificado".** |
| `days` | int(10) | sí | días de alquiler |
| `lang` | varchar(16) | sí | preselecciona idioma. Valores: `null`, `es-AR`, `es-ES`, `en-US` |
| `nominative` | varchar(64) | sí | **nombre del cliente** — fallback cuando no hay `customers` |
| `custmail` | varchar(128) | sí | email — fallback |
| `phone` | varchar(32) | sí | teléfono — fallback |
| `custdata` | text | sí | datos crudos — último recurso (evitar parsear si hay alternativa) |
| `idplace` | int(10) | sí | lugar de retiro → `places` |
| `idreturnplace` | int(10) | sí | lugar de devolución → `places` |
| `idbusy` | int(10) | sí | vínculo a `busy` (ocupación) |
| `country` | varchar(5) | sí | país |
| `order_total` / `totpaid` | decimal(12,2) | sí | informativo (cobros fuera de v1) |
| `adminnotes` | text | sí | notas del admin en el plugin |

### Timestamps — confirmado

`ritiro`/`consegna`/`ts` son **Unix en segundos**. Ej. verificado: `ritiro` max
`1791543600` = `2026-10-09T11:00:00Z`. Usar `fromUnixSeconds()`
(`src/lib/datetime.ts`). La sesión MySQL reporta `time_zone = SYSTEM`; los valores
son epoch absolutos, así que la conversión a Mendoza se hace en Andes al mostrar.

### `lang` → `rentals.language` (es/en)

| `lang` en VikRentCar | conteo | → `rentals.language` |
|---|---:|---|
| `null` | 1659 | `es` (default) |
| `es-AR` | 422 | `es` |
| `es-ES` | 101 | `es` |
| `en-US` | 22 | `en` |

`resolveLocale()` (`src/lib/i18n/config.ts`) ya cubre esto: toma las 2 primeras
letras y cae a `es` por default. El empleado puede cambiarlo antes de firmar.

### `carindex` — el "sin unidad asignada" es frecuente

De 2204 órdenes: **688 con `carindex` NULL**, resto entre 1 y 3. Muchas reservas
confirmadas (típicamente de modelos con varias unidades, ej. `idcar=21` Kwid con 4
unidades) llegan **sin unidad concreta**. → Estas entran como **"reserva sin
vehículo asignado"** y aparecen en las alertas del dashboard para asignarlas a mano.
No es un caso borde: hay que diseñar el flujo asumiéndolo.

## Cliente: `customers` + `customers_orders` (con fallback obligatorio)

- **`customers_orders`**: `id`, `idcustomer` (→ `customers.id`), `idorder`
  (→ `orders.id`), `drivers_data` (text). Join directo por `idorder`.
- **`customers`** (857 filas) es rico: `first_name`, `last_name`, `email`, `phone`,
  `country`, `address`, `city`, `zip`, **`doctype`**, **`docnum`** (tipo y nº de
  documento → alimenta el nro. de documento opcional de `rentals`), `company`,
  `vat`, `notes`, etc.
- ⚠️ **Hallazgo clave:** de **2062 órdenes `confirmed`, 1588 (77%) NO tienen fila
  en `customers_orders`.** El vínculo estructurado es la **minoría** (órdenes
  recientes). → El worker de sync debe:
  1. Intentar el join `customers_orders` → `customers` (preferido).
  2. Si no existe, **caer a los campos de la propia orden**: `nominative`
     (nombre), `custmail`, `phone`. `custdata` como último recurso.

## `cars` → seed de `vehicles` (Fase 5)

- 14 modelos, **`SUM(units) = 18` unidades físicas** → la flota real ronda los 18 autos.
- Columnas útiles: `id` (→ `wp_car_id`), `name`, `units` (cantidad de unidades),
  `avail`, `img` (nombre de archivo de la foto principal), `idcat` (categorías,
  formato `"4;7;"` separado por `;`), `alias`.
- **Seed:** por cada `car` con `units = N`, crear N filas en `vehicles` con
  `wp_car_id = car.id` y `wp_car_index = 1..N`. Patente/año/color no están en el
  plugin → se completan a mano en el ABM (Fase 1). Ej. reales: "Fiat Cronos Full"
  (2 u.), "Renault Kwid Iconic 1.0" (4 u.), "Jeep Renegade" (1 u.).
- No se detectaron tablas de daños/check-in propias del plugin en uso (VikRentCar
  free); **nada que migrar** en el seed inicial. (Reconfirmar con el dueño si
  alguna vez cargaron daños manualmente.)

## Reglas de sincronización (Fase 5)

- Importar solo `status = 'confirmed'`. `standby` → "pendientes" (configurable, 17
  hoy). `cancelled` → cancelar el `rental` local **solo si aún no tiene entrega**.
- **Sync incremental — cuidado:** `orders` no tiene columna de modificación (solo
  `ts` de creación). Opciones:
  - Usar `wp_vikrentcar_orderhistory` (`idorder`, `dt` datetime, `type` char(2),
    `data`) para detectar órdenes cambiadas desde la última corrida, **o**
  - Re-escanear en cada corrida una **ventana móvil** de órdenes cuyo `ritiro`/
    `consegna` caiga en, p. ej., \[hoy − 2 días, hoy + 60 días], comparando contra
    el estado local. Más simple y robusto para el volumen actual (~2k órdenes).
- Mapeo de vehículo por par (`idcar`, `carindex`). `carindex` NULL → alerta.
- `lang` → `rentals.language` según la tabla de arriba.
- Registrar cada corrida en `sync_logs` (importadas / actualizadas / errores).
- Andes es la fuente de verdad del estado físico; las funciones de daños/PDF del
  plugin no se usan.

## Reconfirmado / cerrado en Fase 0

- [x] Prefijo real: `wp_vikrentcar_`.
- [x] Versión: MariaDB 11.8.8; VikRentCar free (sin tablas de daños/check-in en uso).
- [x] Columnas de `orders` (nombres, tipos) y que `ritiro`/`consegna`/`ts` son Unix segundos.
- [x] Valores reales de `status`: confirmed / cancelled / standby.
- [x] Estructura de `customers` / `customers_orders` y columna de join (`idorder`).
- [x] `cars` para el seed y total de unidades (18).
- [x] No hay daños cargados en el plugin para migrar (a reconfirmar con el dueño).
- [x] Sin columna de "modificado" en `orders` → estrategia de sync definida arriba.
- [ ] **Producción:** cerrar el acceso remoto abierto (`%`) → Plan B REST o egress IP fija.

## Cómo reinspeccionar

```bash
# Credenciales en .env (gitignored). Script de descubrimiento en scratchpad.
node --env-file=.env wp-discovery.mjs
```
