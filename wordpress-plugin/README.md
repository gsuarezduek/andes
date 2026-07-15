# Andes Sync — mu-plugin de WordPress (Fase 5)

Expone las reservas de VikRentCar por REST (solo lectura, con token) para que
la app **Andes** las sincronice **sin abrir el MySQL a internet**. Este es el
"Plan B" recomendado en `docs/wordpress-mapping.md`.

## Por qué

Durante el descubrimiento (Fase 0) se abrió el "Remote MySQL" de Hostinger a
cualquier IP (`%`), lo que expone la base de WordPress (con datos personales de
clientes) a internet. Con este plugin, Andes habla con WordPress por **HTTPS +
token** y el puerto MySQL (3306) puede volver a estar **cerrado**.

## Instalación

Se puede instalar de dos formas. Como **plugin normal** aparece en
**Ajustes → Andes Sync** (recomendado si querés usar los toggles de datos
compartidos, v1.2.0). Como **mu-plugin** no se puede desactivar por accidente.

1. Elegí una:
   - **Plugin normal:** subí `andes-sync.php` (o el `.zip`) a
     `wp-content/plugins/` y activalo desde **Plugins**. Vas a ver el menú
     **Ajustes → Andes Sync**.
   - **mu-plugin:** subí `andes-sync.php` a `wp-content/mu-plugins/andes-sync.php`.
     Si la carpeta `mu-plugins/` no existe, creala. Los *must-use plugins* se
     activan solos y no se pueden desactivar desde el panel (la pantalla de
     ajustes igual aparece).
2. Definí el token en `wp-config.php` (antes de `/* That's all, stop editing! */`):

   ```php
   define('ANDES_SYNC_TOKEN', 'pegá-acá-un-secreto-largo-y-aleatorio');
   ```

3. Probá que responde (reemplazá el dominio y el token):

   ```bash
   curl -H "X-Andes-Token: TU_TOKEN" \
        "https://mdzrentacar.com/wp-json/andes/v1/cars"
   ```

   Debe devolver `{"cars":[...]}`. Si devuelve 401 el token no coincide; si 503
   falta definir `ANDES_SYNC_TOKEN`.

4. En Andes (Railway), configurá:

   ```
   WP_REST_URL   = https://mdzrentacar.com/wp-json/andes/v1
   WP_REST_TOKEN = el mismo valor que ANDES_SYNC_TOKEN
   ```

   Con `WP_REST_URL` seteado, Andes usa REST y **deja de usar** el MySQL directo.

5. **Cerrá el "Remote MySQL"** en hPanel de Hostinger (quitá el `%`, dejá solo
   `localhost`). El plugin sigue funcionando porque corre dentro de WordPress.

## Endpoints

| Método | Ruta | Devuelve |
|---|---|---|
| GET | `/wp-json/andes/v1/bookings?from=<unix>&to=<unix>&include_standby=0` | `{ bookings: RawBooking[] }` |
| GET | `/wp-json/andes/v1/cars` | `{ cars: RawCar[] }` (incluye `baseDailyRate`, v1.1.0) |
| GET | `/wp-json/andes/v1/seasons` | `{ seasons: RawSeason[] }` (v1.1.0, ajustes de tarifa por temporada) |

Todos requieren el header `X-Andes-Token` (o `?token=`). `from`/`to` son la
ventana en Unix segundos; Andes la calcula sola (hoy−2d … hoy+60d por defecto).

**v1.1.0** agrega la tarifa por día del auto: `/cars` trae `baseDailyRate`
(precio de 1 día de `wp_vikrentcar_dispcost`) y `/seasons` expone las temporadas
de porcentaje (`wp_vikrentcar_seasons`). Andes calcula la tarifa vigente. Si tu
mu-plugin es v1.0.0, Andes lo tolera (la ficha muestra "—" hasta redesplegar).

La forma de `RawBooking` / `RawCar` está en `src/lib/sync/types.ts`. El SQL del
plugin espeja el del adaptador MySQL (`src/lib/sync/mysql-source.ts`).

## Qué datos se comparten (toggles, v1.2.0)

En **Ajustes → Andes Sync** podés elegir qué grupos de datos comparte el plugin.
Los **estructurales** van siempre (sin ellos el sync no funciona):
`wpBookingId, status, idcar, carindex, startUnix, endUnix`.

Grupos apagables (todos ON por defecto):

| Grupo | Campos |
|---|---|
| Cliente (datos personales) | `clientName, clientEmail, clientPhone, clientDocNumber, clientCountry` |
| Económico | `orderTotal, totpaid (pagado), carCost` |
| Texto libre de la reserva | `custData` |
| Extras de la reserva | `createdUnix, days, lang, carName, pickupPlace, returnPlace` |
| Tarifa y temporadas | `baseDailyRate` en `/cars` y el endpoint `/seasons` |

Un grupo apagado se envía como `null` (o, para tarifa/temporadas, el endpoint
queda vacío y la ficha del auto muestra "—"). Andes tolera todos estos como
nulos; si apagás **Cliente**, usa el placeholder "Sin nombre" para el contrato.

## Seguridad

- **Solo lectura:** el plugin únicamente hace `SELECT` sobre `wp_vikrentcar_*`.
- **Token:** compara con `hash_equals` (tiempo constante). Sin token definido no
  expone nada (503).
- Serví siempre por HTTPS. Rotá el token cambiándolo en los dos lados a la vez.
