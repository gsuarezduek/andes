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
| `totpaid` | decimal(12,2) | sí | pagado/anticipo → `rentals.booking_paid`. **Precarga la "Seña" en la entrega.** Cobertura baja hoy (~8% en ventana) pero crece con el cobro online (Andes Pay Stripe). Sin cobro en Andes. |
| `country` | varchar(5) | sí | país del cliente → `rentals.client_country` (se muestra en el acta). Cobertura ~24%. |
| `idpayment` | varchar(128) | sí | método de pago, formato `"id=Nombre"` (ej. `"8=Stripe"`) → `rentals.booking_payment_method` (solo el nombre; se muestra en el detalle). ~25% cobertura. **`paymentlog` NO se importa** (datos de tarjeta). |
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

### Tarifa por día del auto (ficha del auto) — `dispcost` + `seasons`

A diferencia del precio por reserva (arriba), la **tarifa del modelo** sí está estructurada:

- **`wp_vikrentcar_dispcost`** (`idcar`, `days`, `idprice`, `cost`): costo total por cantidad de
  días. El **precio de 1 día** = `cost` con `days = 1`. Hay **un solo plan** de precios
  (`wp_vikrentcar_prices` id=1, "Alquiler 200km x día"), así que no hay ambigüedad. Ej.: idcar 5 =
  $70.000, idcar 20 = $110.000, idcar 15 = $10.000.
- **`wp_vikrentcar_seasons`**: ajustes por temporada. Las que usa MDZ son todas de **porcentaje**
  (`type = 1`, `val_pcent = 2`); `diffcost` = % a sumar. `from`/`to` son **segundos dentro del año**
  (`(díaDelAño − 1) × 86400`; verificado: 18-jul → `17107200`). `year` fija el año o es `NULL`
  (recurrente cada año). `idcars` = `-8-,-5-,` (modelos a los que aplica).
- **Fórmula (Andes)**: `tarifa_hoy = base(1 día) × ∏(1 + diffcost/100)` de las temporadas activas
  hoy que incluyan el modelo. Lógica pura en `src/lib/sync/rates.ts` (`computeDailyRate`), testeada.
- **Sync**: `syncCarRates` (en `src/lib/sync/engine.ts`) corre en cada `runBookingSync`, calcula la
  tarifa vigente por `idcar` y hace `updateMany` de los `vehicles` con ese `wpCarId`
  (`dailyRate` + `dailyRateUpdatedAt`). Se muestra en la ficha del auto. Solo actualiza, no crea.
- **Transportes**: el mu-plugin expone `baseDailyRate` en `/cars` y un endpoint `/seasons`
  (crudo); el motor JS hace el cálculo (única fuente de verdad). v1 solo soporta temporadas de
  porcentaje; otros modos se ignoran (quedan en base).

### Timestamps — confirmado

`ritiro`/`consegna`/`ts` son **Unix en segundos**, pero **NO son epoch UTC
absolutos**: WordPress está en `gmt_offset = -3` (Mendoza) con `timezone_string`
vacío, y VikRentCar guarda la **hora de pared local** como Unix segundos sin
convertir a UTC. Ej. `ritiro = 1791543600` "como UTC" da `2026-10-09T11:00:00Z`,
pero esas **11:00 son la hora cargada en WordPress** (no las 08:00 de Mendoza).
Por eso `ritiro`/`consegna` deben pasar por **`vikRentCarUnixToUtc()`**
(`src/lib/datetime.ts`), que reinterpreta los componentes como hora de pared de
Mendoza y devuelve el instante UTC real (11:00 → `14:00Z`). Usar
`fromUnixSeconds()` (epoch crudo) daría 3h de menos al mostrar (12:00 → 09:00).
`ts` (fecha de creación) es referencial y no se muestra al cliente, así que
mantiene `fromUnixSeconds`.

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
  - ⚠️ **`drivers_data` está prácticamente sin uso** (verificado 2026-07): de 559
    filas, 1 sola no vacía y su valor es `[]`. **No** sirve para precargar
    conductores adicionales en Andes. Descartado.
- **Opcionales** ✅ (sincronizados, v6): `orders.optionals` = `"id:cantidad;"`
  (ej. `"4:1;5:1;"`); catálogo en `wp_vikrentcar_optionals` (`id, name, cost,
  perday, hmany`). Verificado: solo 3 opcionales (200km camionetas $23.000,
  200km autos $20.000, **Mejora de Seguro** $20.000/día), ~6% de cobertura.
  **Mapeo (Andes, `src/lib/sync/optionals.ts`):** la "Mejora de Seguro" (nombre con
  "seguro") es un **flag** que baja la franquicia (`bookingInsuranceUpgrade`); el
  resto son **accesorios** → `bookingAccessories` (desc) + `bookingAccessoriesAmount`
  (importe = `cost × (perday?días:1) × cantidad`). Precargan las condiciones de la
  entrega; el sync nunca pisa `pricing`. El transporte expone `/optionals` (catálogo
  crudo) y `optionals` por reserva; el cálculo vive solo en JS. **`extracosts` está
  muerto** (0 filas) → ignorado.
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
  3. **Nombre desde la nota** (`src/lib/sync/client-name.ts`): si aun así la
     reserva vendría "Sin nombre", se toma la **1ª línea del `custdata`** como
     nombre — convención del staff (línea 1 = nombre, línea 2 = hora de retiro).
     Solo si esa línea **parece un nombre** (sin dígitos ni "$": las notas
     operativas viejas arrancan con la hora/precio y se descartan). El sync
     **actualiza solo** las reservas ya importadas como "Sin nombre" en la
     próxima corrida. Ej. orden 2883 → "DIEGO ALEJANDRO SOTO".

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

- Importar `status = 'confirmed'` **y `standby`** (sin confirmar). `standby` entra
  con `rentals.booking_confirmed = false` y se muestra en **naranja** (calendario,
  listado, detalle, dashboard); el sync la pasa a `true` si el dueño la confirma.
  Por defecto se traen (`SYNC_INCLUDE_STANDBY` default true; poner `"false"` para
  excluirlas). `cancelled` → cancelar el `rental` local **solo si aún no tiene
  entrega**. (Nota: hoy las 17 standby históricas tienen retiro pasado, así que no
  aparecen en la ventana; la función se enciende con nuevas standby a futuro.)
- **Sync incremental — decisión (Fase 5): ventana móvil.** `orders` no tiene
  columna de modificación (solo `ts` de creación). Se optó por re-escanear en
  cada corrida las órdenes cuyo `ritiro`/`consegna` caiga en
  \[hoy − `SYNC_WINDOW_DAYS_BACK` (2), hoy + `SYNC_WINDOW_DAYS_FORWARD` (120)],
  comparando contra el estado local (upsert idempotente). Más simple y robusto
  que `orderhistory` para el volumen actual (~2k órdenes; ~25 en ventana típica).
  El upsert **nunca pisa** reservas que ya tienen inspección o dejaron de estar
  en `reserved` (la orden de VikRentCar deja de ser la verdad una vez que Andes
  registró el estado físico). Verificado idempotente contra datos reales.
- **Reserva editada a mano:** si el empleado edita el detalle del alquiler
  (nombre/email/teléfono/documento **y el vehículo asignado**), se marca
  `clientEditedAt` y el sync **deja de pisar** esos campos (aunque la reserva siga
  en `reserved`). Sin la marca, el sync los refresca desde VikRentCar en cada
  corrida. Además, el sync **nunca limpia el vehículo a null**: como muchas órdenes
  vienen sin unidad (`carindex` null → sin vehículo), pisar con null borraría una
  asignación manual, así que el vehículo solo se actualiza cuando VikRentCar trae
  una unidad concreta.
- **Extensión de la devolución:** si en VikRentCar cambia la fecha de devolución
  (`consegna`) de una reserva, el sync trae la nueva fecha — **también para
  reservas activas** (ya entregadas, sin devolución), donde solo actualiza esa
  fecha y nada más. Se trae solo si **difiere** de la actual y **no** se editó la
  devolución a mano en Andes (`returnEditedAt`, seteada por `updateReturnDetails`);
  si se editó a mano, esa gana.
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
