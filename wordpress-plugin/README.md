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

1. Subí `andes-sync.php` a `wp-content/mu-plugins/andes-sync.php`.
   - Si la carpeta `mu-plugins/` no existe, creala. Los *must-use plugins* se
     activan solos y no se pueden desactivar por accidente desde el panel.
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
| GET | `/wp-json/andes/v1/cars` | `{ cars: RawCar[] }` |

Ambos requieren el header `X-Andes-Token` (o `?token=`). `from`/`to` son la
ventana en Unix segundos; Andes la calcula sola (hoy−2d … hoy+60d por defecto).

La forma de `RawBooking` / `RawCar` está en `src/lib/sync/types.ts`. El SQL del
plugin espeja el del adaptador MySQL (`src/lib/sync/mysql-source.ts`).

## Seguridad

- **Solo lectura:** el plugin únicamente hace `SELECT` sobre `wp_vikrentcar_*`.
- **Token:** compara con `hash_equals` (tiempo constante). Sin token definido no
  expone nada (503).
- Serví siempre por HTTPS. Rotá el token cambiándolo en los dos lados a la vez.
