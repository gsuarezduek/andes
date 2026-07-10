# Mapeo VikRentCar → Andes

> **Estado: BORRADOR — PENDIENTE DE VERIFICACIÓN.**
> Este documento describe el esquema **esperado** de VikRentCar según la
> especificación (PROYECTO-ANDES.md §5) y la documentación pública del plugin.
> **Todavía no fue verificado contra la instalación real** de MDZ Rent a Car
> porque falta el acceso de solo lectura a la base de WordPress (o un dump).
> Ver [§ Verificación pendiente](#verificación-pendiente-fase-0). No programar el
> worker de sincronización (Fase 5) hasta cerrar esta verificación.

## Acceso

- **Mecanismo preferido:** usuario MySQL **de solo lectura** creado en el hPanel
  de Hostinger, con **"Remote MySQL"** habilitado para la IP saliente de Railway.
- **Prefijo de tablas:** típicamente `wp_` → `wp_vikrentcar_*`. **Verificar** el
  prefijo real (puede no ser `wp_`).
- **Regla dura (CLAUDE.md):** contra WordPress, **solo `SELECT`**. Jamás escribir,
  jamás importar el esquema de WP a Prisma.
- **Plan B:** si el acceso remoto de Hostinger complica, mini plugin de WordPress
  que exponga las órdenes por REST protegido con API key.

## Tablas relevantes (esquema esperado)

### `wp_vikrentcar_orders` — la reserva

| Columna esperada | Tipo esperado | Significado | Uso en Andes |
|---|---|---|---|
| `id` | int | ID de la orden | `rentals.wp_booking_id` |
| `status` | varchar | `confirmed` / `standby` / `cancelled` | Importar solo `confirmed` (`standby` configurable) |
| `idcar` | int | modelo/vehículo del plugin | mapeo → `vehicles.wp_car_id` |
| `carindex` | int | nº de unidad cuando el modelo tiene varias | mapeo → `vehicles.wp_car_index` |
| `ritiro` | int (Unix) | fecha/hora de **retiro** (pickup) | `rentals.start_at` (UTC) |
| `consegna` | int (Unix) | fecha/hora de **devolución** (drop-off) | `rentals.end_at` (UTC) |
| `idplace` | int | lugar de retiro | referencia (`places`) |
| `idreturnplace` | int | lugar de devolución | referencia (`places`) |
| `days` | int | cantidad de días | informativo |
| `order_total` | decimal | total de la orden | informativo (fuera de v1: cobros) |
| `totpaid` | decimal | total pagado | informativo |
| `custmail` | varchar | email del cliente | fallback si no hay `customers` |
| `custdata` | text | datos crudos del cliente | **evitar**: preferir `customers` |
| `phone` | varchar | teléfono | fallback |
| `lang` | varchar | idioma con que reservó (`es`/`en`/...) | preselecciona `rentals.language` |
| `ts` | int (Unix) | fecha de creación | informativo |
| `sid` | varchar | identificador de sesión/orden | informativo |

> ⚠️ Nombres derivados del italiano: `ritiro` = retiro/pickup,
> `consegna` = devolución/drop-off. **Ambos son timestamps Unix (segundos)** →
> usar `fromUnixSeconds()` de `src/lib/datetime.ts`.

### `wp_vikrentcar_customers` y `wp_vikrentcar_customers_orders`

Datos estructurados del cliente (nombre, apellido, email, teléfono, país) y su
vínculo con cada orden. **Preferir estos datos sobre el campo crudo `custdata`.**
Verificar los nombres de columnas (`first_name`/`last_name`/`email`/`phone`/
`country` u otros) y la columna de join en `customers_orders`
(`idorder` ↔ `idcustomer`, a confirmar).

### `wp_vikrentcar_cars` — vehículos/modelos del plugin

Modelos cargados en VikRentCar, con cantidad de unidades. Sirve para el **seed
inicial** de nuestra tabla `vehicles` (Fase 5). Verificar columnas: `id`, `name`,
`units`/`avail`, `img`, etc. Si hay **daños ya cargados** en el plugin, se migran
una única vez en el seed inicial.

### Referencia (solo lectura, uso menor)

- `wp_vikrentcar_places` — lugares de retiro/devolución.
- `wp_vikrentcar_categories` — categorías de vehículos.
- `wp_vikrentcar_busy` — ocupación (referencia).

## Mapeo de vehículo (idcar, carindex) → `vehicles`

Un vehículo físico nuestro se identifica en VikRentCar por el par
(`idcar`, `carindex`). `vehicles` guarda ambos como **opcionales**
(`wp_car_id`, `wp_car_index`). Si una orden llega sin unidad asignada, el
alquiler queda como **"reserva sin vehículo asignado"** y aparece en las alertas
del dashboard para asignarla a mano.

## Reglas de sincronización (Fase 5)

- Worker en Railway cada **5–10 min**: importa órdenes nuevas o modificadas.
- Solo `confirmed` (importar `standby` como "pendientes" es configurable).
- Cancelaciones / cambios de fecha actualizan el registro local **solo si el
  alquiler todavía no tiene entrega registrada**.
- `lang` de la orden preselecciona `rentals.language` (es/en); el empleado puede
  cambiarlo antes de firmar.
- Cada corrida se registra en `sync_logs` (importadas / actualizadas / errores).
- Las funciones de daños y PDF de check-in de VikRentCar **no se usan**: Andes es
  la fuente de verdad del estado físico desde la puesta en marcha.

## Verificación pendiente (Fase 0)

Una vez con acceso a la base real, confirmar y actualizar este documento:

- [ ] Prefijo real de tablas (¿`wp_`?).
- [ ] Versión de VikRentCar instalada (free / Pro) y nombre exacto de cada tabla.
- [ ] Columnas exactas de `orders` (nombres, tipos, y que `ritiro`/`consegna`/`ts`
      sean Unix en segundos y no milisegundos ni `DATETIME`).
- [ ] Valores reales del enum `status` (`confirmed`/`standby`/`cancelled`/otros).
- [ ] Estructura de `customers` y `customers_orders` y la columna de join.
- [ ] Columnas de `cars` para el seed de `vehicles` y cantidad de unidades.
- [ ] ¿Hay daños/check-ins cargados hoy en el plugin que haya que migrar?
- [ ] Zona horaria con que el plugin interpreta los timestamps.
- [ ] IP saliente de Railway a habilitar en "Remote MySQL", o decisión de Plan B.

## Cómo inspeccionar (cuando haya acceso)

```sql
-- listar tablas del plugin (ajustar prefijo)
SHOW TABLES LIKE '%vikrentcar%';

-- esquema de una tabla
DESCRIBE wp_vikrentcar_orders;

-- muestra de datos (sin exponer PII innecesaria)
SELECT id, status, idcar, carindex, ritiro, consegna, lang, ts
FROM wp_vikrentcar_orders
ORDER BY ts DESC
LIMIT 20;
```
