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
- ✅ **Resuelto en Fase 5 (Plan B REST):** se implementó el mu-plugin
  `wordpress-plugin/andes-sync.php`, que expone las órdenes por REST (HTTPS +
  token, solo lectura). Andes lo consume vía `WP_REST_URL`/`WP_REST_TOKEN`
  (`src/lib/sync/rest-source.ts`). **Con esto el "Remote MySQL" se puede cerrar**
  (quitar el `%`, dejar solo `localhost`). El adaptador MySQL directo
  (`mysql-source.ts`) queda solo para pruebas locales contra datos reales.
  - ⚠️ **Acción pendiente del dueño:** instalar el mu-plugin, definir
    `ANDES_SYNC_TOKEN` en `wp-config.php`, setear las variables en Railway y
    **cerrar el Remote MySQL**. Instrucciones en `wordpress-plugin/README.md`.

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
| `custdata` | text | sí | **info de la reserva (texto libre del staff)** → `rentals.booking_note`. Ver abajo. |
| `idplace` | int(10) | sí | lugar de retiro → `places` |
| `idreturnplace` | int(10) | sí | lugar de devolución → `places` |
| `idbusy` | int(10) | sí | vínculo a `busy` (ocupación) |
| `country` | varchar(5) | sí | país |
| `car_cost` | decimal(12,2) | sí | tarifa del auto (sin extras). `car_cost/days` → `rentals.booking_price_per_day`. **Cobertura ~24%.** |
| `order_total` | decimal(12,2) | sí | total con extras → `rentals.booking_total` (referencia). Cobertura ~95%. |
| `totpaid` | decimal(12,2) | sí | pagado (informativo; cobros fuera de v1) |
| `idtar` | int(10) | sí | id de tarifa aplicada (no usado) |
| `adminnotes` | text | sí | notas del admin en el plugin |

### Datos económicos → precarga de condiciones (Fase 6)

Verificado sobre la **ventana de sync** (hoy−2d…hoy+60d, ~21 órdenes confirmadas):

| Dato | Columna | Cobertura | → Andes |
|---|---|---:|---|
| Cantidad de días | `days` | **100%** | `rentals.booking_days` |
| Info de la reserva | `custdata` | **100%** | `rentals.booking_note` (se muestra al empleado en la entrega) |
| Total de la reserva | `order_total` | ~95% | `rentals.booking_total` (referencia; incluye extras) |
| Precio por día limpio | `car_cost / days` | **~24%** | `rentals.booking_price_per_day` (precarga `dailyRate` cuando existe) |

- **`custdata` es texto libre heterogéneo**, no parseable de forma confiable: a veces es el
  formulario del cliente (`Nombre:/Apellido:/Telefono:/…`), a veces notas operativas del staff
  con hora de retiro, precio pactado y forma de pago (ej.
  `"9hs Araceli x 5 dias a $75.000 + mejora de seguro a $20.000 x dia"`). Se trae **crudo** y se
  muestra al empleado en el paso "Datos" de la entrega; **no** va al acta del cliente.
- **No existe una tarifa diaria estructurada y confiable** para la mayoría de las reservas: `car_cost`
  está cargado en ~24%. Cuando falta, el empleado completa el precio por día leyendo el `custdata`.
- El sync **nunca pisa** `rentals.pricing` (condiciones del contrato que carga el empleado). Solo
  escribe los campos `booking_*` (hechos de la reserva). La "hora extra" del contrato se expresa como
  **% de la tarifa diaria** (`ConditionSettings.extraHourPercent`), configurable en Configuración.

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
- **Sync incremental — decisión (Fase 5): ventana móvil.** `orders` no tiene
  columna de modificación (solo `ts` de creación). Se optó por re-escanear en
  cada corrida las órdenes cuyo `ritiro`/`consegna` caiga en
  \[hoy − `SYNC_WINDOW_DAYS_BACK` (2), hoy + `SYNC_WINDOW_DAYS_FORWARD` (60)],
  comparando contra el estado local (upsert idempotente). Más simple y robusto
  que `orderhistory` para el volumen actual (~2k órdenes; ~25 en ventana típica).
  El upsert **nunca pisa** reservas que ya tienen inspección o dejaron de estar
  en `reserved` (la orden de VikRentCar deja de ser la verdad una vez que Andes
  registró el estado físico). Verificado idempotente contra datos reales.
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
- [x] **Plan B REST implementado** (Fase 5): mu-plugin + adaptador REST. Falta que
      el dueño lo instale y cierre el `%`. Ver `wordpress-plugin/README.md`.

## Cómo reinspeccionar

```bash
# Credenciales en .env (gitignored). Script de descubrimiento en scratchpad.
node --env-file=.env wp-discovery.mjs
```
