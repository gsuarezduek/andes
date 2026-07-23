<?php
/**
 * Plugin Name: Andes Sync (VikRentCar → Andes)
 * Description: Expone las reservas de VikRentCar por REST, de solo lectura y con token, para que la app Andes las sincronice sin abrir el MySQL a internet.
 * Version: 1.6.0
 * Author: MDZ Rent a Car
 *
 * v1.6.0: /cars agrega `avail` (toggle de disponibilidad del modelo). Andes lo
 *         usa para **reactivar automáticamente** unidades archivadas cuando el
 *         modelo vuelve a estar disponible al correr "Importar flota". Nunca
 *         archiva solo (eso sigue siendo 100% manual).
 * v1.5.0: /bookings agrega `paymentMethod` (nombre del método de pago, de
 *         orders.idpayment; SIN el paymentlog con datos de tarjeta). Grupo Económico.
 * v1.4.0: /bookings agrega `optionals` (opcionales elegidos, "id:cant;") y se
 *         agrega /optionals (catálogo: packs de km, mejora de seguro). Andes los
 *         mapea a accesorios + franquicia. Grupo Económico.
 * v1.3.0: /bookings agrega `country` (país del cliente, grupo Cliente) y
 *         `totpaid` (pagado/anticipo de la reserva, grupo Económico → precarga
 *         la "Seña" en la entrega de Andes).
 * v1.2.0: pantalla de ajustes (Ajustes → Andes Sync) con toggles agrupados para
 *         elegir qué datos se comparten (cliente/PII, económico, texto libre,
 *         extras de la reserva y tarifa/temporadas). Los campos estructurales
 *         (clave del upsert, mapeo de unidad y fechas) van siempre.
 * v1.1.0: /cars agrega baseDailyRate (dispcost days=1) y se agrega /seasons
 *         (ajustes de tarifa por temporada) para la tarifa por día en la ficha.
 *
 * INSTALACIÓN
 * -----------
 * Podés instalarlo como plugin normal (recomendado si querés usar los toggles) o
 * como mu-plugin. Como plugin normal aparece en Ajustes → Andes Sync.
 *
 * 1a. Plugin normal: subí este archivo (o su .zip) a wp-content/plugins/ y
 *     activalo desde Plugins. Vas a ver el menú Ajustes → Andes Sync.
 * 1b. mu-plugin: subilo a wp-content/mu-plugins/andes-sync.php (si la carpeta no
 *     existe, creala). Los "must-use plugins" se activan solos y no se pueden
 *     desactivar por error desde el panel (la pantalla de ajustes igual aparece).
 * 2. Definí el token en wp-config.php (arriba de "That's all, stop editing"):
 *
 *        define('ANDES_SYNC_TOKEN', 'un-secreto-largo-y-aleatorio');
 *
 *    Usá el mismo valor en Andes como WP_REST_TOKEN.
 * 3. Probá:
 *        curl -H "X-Andes-Token: TU_TOKEN" \
 *             "https://mdzrentacar.com/wp-json/andes/v1/cars"
 *
 * SEGURIDAD
 * ---------
 * - Solo lectura: únicamente ejecuta SELECT sobre las tablas wp_vikrentcar_*.
 * - Requiere el header X-Andes-Token (o ?token=) igual a ANDES_SYNC_TOKEN.
 * - No expone datos si el token no está definido.
 * - Con esto podés CERRAR el "Remote MySQL" de Hostinger (dejarlo en localhost).
 */

if (!defined('ABSPATH')) {
    exit;
}

/* ---------------------------------------------------------------------------
 * Ajustes: qué datos se comparten (toggles agrupados)
 * -------------------------------------------------------------------------*/

define('ANDES_SYNC_OPTION', 'andes_sync_options');

/** Grupos apagables (los estructurales no están: van siempre). Todo ON por defecto. */
function andes_sync_default_opts()
{
    return [
        'share_client'        => 1, // clientName, clientEmail, clientPhone, clientDocNumber
        'share_financial'     => 1, // orderTotal, carCost
        'share_custdata'      => 1, // custData (texto libre de la reserva)
        'share_booking_extra' => 1, // createdUnix, days, lang, carName, pickupPlace, returnPlace
        'share_rates'         => 1, // baseDailyRate (/cars) y endpoint /seasons
    ];
}

function andes_sync_opts()
{
    $saved = get_option(ANDES_SYNC_OPTION, []);
    if (!is_array($saved)) {
        $saved = [];
    }
    return array_merge(andes_sync_default_opts(), $saved);
}

/** ¿Está habilitado compartir este grupo? */
function andes_sync_share($key)
{
    $o = andes_sync_opts();
    return !empty($o[$key]);
}

function andes_sync_sanitize_opts($input)
{
    $out = [];
    foreach (array_keys(andes_sync_default_opts()) as $k) {
        $out[$k] = empty($input[$k]) ? 0 : 1;
    }
    return $out;
}

add_action('admin_init', function () {
    register_setting('andes_sync', ANDES_SYNC_OPTION, [
        'type'              => 'array',
        'sanitize_callback' => 'andes_sync_sanitize_opts',
        'default'           => andes_sync_default_opts(),
    ]);
});

add_action('admin_menu', function () {
    add_options_page(
        'Andes Sync',
        'Andes Sync',
        'manage_options',
        'andes-sync',
        'andes_sync_settings_page'
    );
});

/** Link "Configuración" en la fila del plugin (Plugins → Andes Sync). */
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    $url  = admin_url('options-general.php?page=andes-sync');
    $link = '<a href="' . esc_url($url) . '">Configuración</a>';
    array_unshift($links, $link);
    return $links;
});

/** Grupos con su etiqueta y los campos que incluyen (para mostrarlos en el panel). */
function andes_sync_groups()
{
    return [
        'share_client'        => ['Cliente (datos personales)', 'clientName, clientEmail, clientPhone, clientDocNumber, clientCountry'],
        'share_financial'     => ['Económico', 'orderTotal, totpaid (pagado), carCost, optionals (+ catálogo /optionals), paymentMethod'],
        'share_custdata'      => ['Texto libre de la reserva', 'custData (la "Info de la reserva")'],
        'share_booking_extra' => ['Extras de la reserva', 'createdUnix, days, lang, carName, pickupPlace, returnPlace'],
        'share_rates'         => ['Tarifa y temporadas', 'baseDailyRate en /cars y el endpoint /seasons'],
    ];
}

function andes_sync_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    $opts       = andes_sync_opts();
    $token_set  = defined('ANDES_SYNC_TOKEN') && ANDES_SYNC_TOKEN !== '';
    ?>
    <div class="wrap">
        <h1>Andes Sync</h1>
        <p>Elegí qué datos comparte el plugin con la app Andes. Los campos
           <strong>estructurales</strong> se envían siempre porque el sync no
           funciona sin ellos.</p>

        <p>
            Token:
            <?php if ($token_set): ?>
                <strong style="color:#1a7f37">definido</strong> en <code>wp-config.php</code> ✓
            <?php else: ?>
                <strong style="color:#b32d2e">no definido</strong> — agregá
                <code>define('ANDES_SYNC_TOKEN', '…');</code> en <code>wp-config.php</code>.
            <?php endif; ?>
        </p>

        <h2>Siempre se comparten (estructural)</h2>
        <p><code>wpBookingId, status, idcar, carindex, startUnix, endUnix</code> —
           clave del upsert, mapeo de unidad y fechas.</p>

        <form method="post" action="options.php">
            <?php settings_fields('andes_sync'); ?>
            <h2>Opcionales</h2>
            <table class="form-table" role="presentation">
                <tbody>
                <?php foreach (andes_sync_groups() as $key => $g): ?>
                    <tr>
                        <th scope="row"><?php echo esc_html($g[0]); ?></th>
                        <td>
                            <label>
                                <input type="checkbox"
                                       name="<?php echo esc_attr(ANDES_SYNC_OPTION . '[' . $key . ']'); ?>"
                                       value="1" <?php checked(!empty($opts[$key])); ?> />
                                Compartir
                            </label>
                            <p class="description"><code><?php echo esc_html($g[1]); ?></code></p>
                        </td>
                    </tr>
                <?php endforeach; ?>
                </tbody>
            </table>
            <p class="description">Un campo apagado se envía como <code>null</code>
               (o, para tarifa/temporadas, el endpoint queda vacío y la ficha del
               auto muestra "—"). Andes tolera todos estos como nulos.</p>
            <?php submit_button('Guardar cambios'); ?>
        </form>
    </div>
    <?php
}

add_action('rest_api_init', function () {
    register_rest_route('andes/v1', '/bookings', [
        'methods'             => 'GET',
        'callback'            => 'andes_sync_bookings',
        'permission_callback' => 'andes_sync_authorized',
        'args'                => [
            'from'            => ['sanitize_callback' => 'absint'],
            'to'              => ['sanitize_callback' => 'absint'],
            'include_standby' => ['sanitize_callback' => 'absint'],
        ],
    ]);

    register_rest_route('andes/v1', '/cars', [
        'methods'             => 'GET',
        'callback'            => 'andes_sync_cars',
        'permission_callback' => 'andes_sync_authorized',
    ]);

    register_rest_route('andes/v1', '/seasons', [
        'methods'             => 'GET',
        'callback'            => 'andes_sync_seasons',
        'permission_callback' => 'andes_sync_authorized',
    ]);

    register_rest_route('andes/v1', '/optionals', [
        'methods'             => 'GET',
        'callback'            => 'andes_sync_optionals',
        'permission_callback' => 'andes_sync_authorized',
    ]);
});

/** Autenticación por token compartido (header X-Andes-Token o ?token=). */
function andes_sync_authorized(WP_REST_Request $request)
{
    if (!defined('ANDES_SYNC_TOKEN') || ANDES_SYNC_TOKEN === '') {
        return new WP_Error('andes_no_token', 'ANDES_SYNC_TOKEN no está definido en wp-config.php', ['status' => 503]);
    }
    $provided = $request->get_header('x-andes-token');
    if (!$provided) {
        $provided = $request->get_param('token');
    }
    if (!is_string($provided) || !hash_equals(ANDES_SYNC_TOKEN, $provided)) {
        return new WP_Error('andes_forbidden', 'Token inválido', ['status' => 401]);
    }
    return true;
}

/**
 * Reservas cuyo retiro (ritiro) o devolución (consegna) cae dentro de la ventana.
 * Espeja el SQL del adaptador MySQL de Andes (src/lib/sync/mysql-source.ts).
 */
function andes_sync_bookings(WP_REST_Request $request)
{
    global $wpdb;
    $p = $wpdb->prefix . 'vikrentcar_';

    $from = (int) $request->get_param('from');
    $to   = (int) $request->get_param('to');
    if ($from <= 0 || $to <= 0 || $to < $from) {
        return new WP_Error('andes_bad_window', 'Parámetros from/to inválidos', ['status' => 400]);
    }
    $include_standby = (int) $request->get_param('include_standby') === 1;

    $statuses = $include_standby
        ? "'confirmed','cancelled','standby'"
        : "'confirmed','cancelled'";

    // Nombres de tabla no pueden ir como placeholders → se interpolan desde el
    // prefijo de WordPress (confiable). Los valores sí van parametrizados.
    $sql = $wpdb->prepare(
        "SELECT o.id, o.status, o.idcar, o.carindex, o.ritiro, o.consegna, o.ts,
                o.days, o.lang, o.nominative, o.custmail, o.phone,
                o.custdata, o.country, o.order_total, o.totpaid, o.car_cost, o.optionals, o.idpayment,
                car.name AS car_name, pp.name AS pickup_place, rp.name AS return_place,
                c.first_name AS c_first, c.last_name AS c_last,
                c.email AS c_email, c.phone AS c_phone, c.docnum AS c_docnum
         FROM {$p}orders o
         LEFT JOIN {$p}customers_orders co ON co.idorder = o.id
         LEFT JOIN {$p}customers c ON c.id = co.idcustomer
         LEFT JOIN {$p}cars car ON car.id = o.idcar
         LEFT JOIN {$p}places pp ON pp.id = o.idplace
         LEFT JOIN {$p}places rp ON rp.id = o.idreturnplace
         WHERE o.status IN ({$statuses})
           AND ((o.ritiro BETWEEN %d AND %d) OR (o.consegna BETWEEN %d AND %d))
         GROUP BY o.id
         ORDER BY o.id DESC",
        $from, $to, $from, $to
    );

    $rows = $wpdb->get_results($sql, ARRAY_A);
    if ($rows === null) {
        return new WP_Error('andes_db', 'Error de base de datos', ['status' => 500]);
    }

    $opts     = andes_sync_opts();
    $bookings = array_map(function ($r) use ($opts) {
        return andes_sync_normalize_order($r, $opts);
    }, $rows);
    return new WP_REST_Response(['bookings' => $bookings], 200);
}

/** Modelos de la flota (seed de vehículos) + tarifa base 1 día (dispcost days=1). */
function andes_sync_cars(WP_REST_Request $request)
{
    global $wpdb;
    $p = $wpdb->prefix . 'vikrentcar_';

    $rows = $wpdb->get_results(
        "SELECT c.id, c.name, c.units, c.avail,
                (SELECT MIN(d.cost) FROM {$p}dispcost d WHERE d.idcar = c.id AND d.days = 1) AS base1
         FROM {$p}cars c ORDER BY c.id",
        ARRAY_A
    );
    if ($rows === null) {
        return new WP_Error('andes_db', 'Error de base de datos', ['status' => 500]);
    }

    $shareRates = andes_sync_share('share_rates');
    $cars = array_map(function ($r) use ($shareRates) {
        return [
            'id'            => (int) $r['id'],
            'name'          => andes_sync_clean($r['name']) ?: ('Modelo ' . (int) $r['id']),
            'units'         => max(1, (int) $r['units']),
            'baseDailyRate' => $shareRates ? andes_sync_float_or_null($r['base1']) : null,
            'avail'         => (int) $r['avail'] === 1,
        ];
    }, $rows);

    return new WP_REST_Response(['cars' => $cars], 200);
}

/**
 * Temporadas de ajuste de tarifa (solo porcentaje: type=1, val_pcent=2). `from`/
 * `to` son segundos dentro del año; `idcars` es "-8-,-5-,". Espeja el adaptador
 * MySQL de Andes (src/lib/sync/mysql-source.ts).
 */
function andes_sync_seasons(WP_REST_Request $request)
{
    // Si la tarifa está apagada, no tiene sentido devolver temporadas.
    if (!andes_sync_share('share_rates')) {
        return new WP_REST_Response(['seasons' => []], 200);
    }

    global $wpdb;
    $p = $wpdb->prefix . 'vikrentcar_';

    $rows = $wpdb->get_results(
        "SELECT `from`, `to`, year, diffcost, idcars
         FROM {$p}seasons WHERE type = 1 AND val_pcent = 2",
        ARRAY_A
    );
    if ($rows === null) {
        return new WP_Error('andes_db', 'Error de base de datos', ['status' => 500]);
    }

    $seasons = [];
    foreach ($rows as $r) {
        if ($r['from'] === null || $r['to'] === null) {
            continue;
        }
        $idcars = [];
        if (preg_match_all('/-(\d+)-/', (string) $r['idcars'], $m)) {
            $idcars = array_map('intval', $m[1]);
        }
        $seasons[] = [
            'from'        => (int) $r['from'],
            'to'          => (int) $r['to'],
            'year'        => andes_sync_int_or_null($r['year']),
            'diffPercent' => (float) $r['diffcost'],
            'idcars'      => $idcars,
        ];
    }

    return new WP_REST_Response(['seasons' => $seasons], 200);
}

/**
 * Catálogo de opcionales (`wp_vikrentcar_optionals`): packs de km, mejora de
 * seguro, etc. Andes los mapea a accesorios (importe) y franquicia (mejora de
 * seguro). Gateado por el grupo Económico (igual que `optionals` en /bookings).
 */
function andes_sync_optionals(WP_REST_Request $request)
{
    if (!andes_sync_share('share_financial')) {
        return new WP_REST_Response(['optionals' => []], 200);
    }

    global $wpdb;
    $p = $wpdb->prefix . 'vikrentcar_';

    $rows = $wpdb->get_results(
        "SELECT id, name, cost, perday, hmany FROM {$p}optionals ORDER BY ordering, id",
        ARRAY_A
    );
    if ($rows === null) {
        return new WP_Error('andes_db', 'Error de base de datos', ['status' => 500]);
    }

    $optionals = array_map(function ($r) {
        return [
            'id'      => (int) $r['id'],
            'name'    => andes_sync_clean($r['name']) ?: ('Opcional ' . (int) $r['id']),
            'cost'    => andes_sync_float_or_null($r['cost']),
            'perDay'  => (int) $r['perday'] === 1,
            'hasMany' => (int) $r['hmany'] === 1,
        ];
    }, $rows);

    return new WP_REST_Response(['optionals' => $optionals], 200);
}

/**
 * Normaliza una fila de orden a la forma RawBooking que espera Andes.
 * $opts controla qué grupos opcionales se comparten (los apagados van null).
 */
function andes_sync_normalize_order($r, $opts = null)
{
    if ($opts === null) {
        $opts = andes_sync_default_opts();
    }
    $client  = !empty($opts['share_client']);
    $money   = !empty($opts['share_financial']);
    $note    = !empty($opts['share_custdata']);
    $extra   = !empty($opts['share_booking_extra']);

    $name = null;
    if ($client) {
        $full = trim(trim((string) $r['c_first']) . ' ' . trim((string) $r['c_last']));
        $name = andes_sync_clean($full);
        if ($name === null) {
            $name = andes_sync_clean($r['nominative']);
        }
        if ($name === null) {
            $name = 'Sin nombre';
        }
    }

    return [
        // Estructural (siempre)
        'wpBookingId'     => (int) $r['id'],
        'status'          => strtolower((string) $r['status']),
        'idcar'           => andes_sync_int_or_null($r['idcar']),
        'carindex'        => andes_sync_int_or_null($r['carindex']),
        'startUnix'       => (int) $r['ritiro'],
        'endUnix'         => (int) $r['consegna'],
        // Extras de la reserva
        'createdUnix'     => $extra ? andes_sync_int_or_null($r['ts']) : null,
        'days'            => $extra ? andes_sync_int_or_null($r['days']) : null,
        'lang'            => $extra ? andes_sync_clean($r['lang']) : null,
        'carName'         => $extra ? andes_sync_clean($r['car_name']) : null,
        'pickupPlace'     => $extra ? andes_sync_clean($r['pickup_place']) : null,
        'returnPlace'     => $extra ? andes_sync_clean($r['return_place']) : null,
        // Cliente (datos personales)
        'clientName'      => $name,
        'clientEmail'     => $client ? (andes_sync_clean($r['c_email']) ?: andes_sync_clean($r['custmail'])) : null,
        'clientPhone'     => $client ? (andes_sync_clean($r['c_phone']) ?: andes_sync_clean($r['phone'])) : null,
        'clientDocNumber' => $client ? andes_sync_clean($r['c_docnum']) : null,
        'clientCountry'   => $client ? andes_sync_clean($r['country']) : null,
        // Texto libre
        'custData'        => $note ? andes_sync_clean($r['custdata']) : null,
        // Económico
        'orderTotal'      => $money ? andes_sync_float_or_null($r['order_total']) : null,
        'paid'            => $money ? andes_sync_float_or_null($r['totpaid']) : null,
        'carCost'         => $money ? andes_sync_float_or_null($r['car_cost']) : null,
        'optionals'       => $money ? andes_sync_clean($r['optionals']) : null,
        'paymentMethod'   => $money ? andes_sync_payment_method($r['idpayment']) : null,
    ];
}

/** idpayment ("1=Transferencia de Banco") → "Transferencia de Banco". Sin el nombre → null. */
function andes_sync_payment_method($v)
{
    $t = andes_sync_clean($v);
    if ($t === null) {
        return null;
    }
    $eq = strpos($t, '=');
    $name = $eq !== false ? trim(substr($t, $eq + 1)) : $t;
    return $name === '' ? null : $name;
}

function andes_sync_clean($v)
{
    if ($v === null) {
        return null;
    }
    $t = trim((string) $v);
    return $t === '' ? null : $t;
}

function andes_sync_int_or_null($v)
{
    return ($v === null || $v === '') ? null : (int) $v;
}

function andes_sync_float_or_null($v)
{
    return ($v === null || $v === '') ? null : (float) $v;
}
