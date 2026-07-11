<?php
/**
 * Plugin Name: Andes Sync (VikRentCar → Andes)
 * Description: Expone las reservas de VikRentCar por REST, de solo lectura y con token, para que la app Andes las sincronice sin abrir el MySQL a internet.
 * Version: 1.0.0
 * Author: MDZ Rent a Car
 *
 * INSTALACIÓN
 * -----------
 * 1. Subí este archivo a  wp-content/mu-plugins/andes-sync.php
 *    (si la carpeta mu-plugins no existe, creala). Los "must-use plugins" se
 *    activan solos y no se pueden desactivar por error desde el panel.
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
                o.custdata, o.order_total, o.car_cost,
                c.first_name AS c_first, c.last_name AS c_last,
                c.email AS c_email, c.phone AS c_phone, c.docnum AS c_docnum
         FROM {$p}orders o
         LEFT JOIN {$p}customers_orders co ON co.idorder = o.id
         LEFT JOIN {$p}customers c ON c.id = co.idcustomer
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

    $bookings = array_map('andes_sync_normalize_order', $rows);
    return new WP_REST_Response(['bookings' => $bookings], 200);
}

/** Modelos de la flota para el seed inicial de vehículos. */
function andes_sync_cars(WP_REST_Request $request)
{
    global $wpdb;
    $p = $wpdb->prefix . 'vikrentcar_';

    $rows = $wpdb->get_results("SELECT id, name, units FROM {$p}cars ORDER BY id", ARRAY_A);
    if ($rows === null) {
        return new WP_Error('andes_db', 'Error de base de datos', ['status' => 500]);
    }

    $cars = array_map(function ($r) {
        return [
            'id'    => (int) $r['id'],
            'name'  => andes_sync_clean($r['name']) ?: ('Modelo ' . (int) $r['id']),
            'units' => max(1, (int) $r['units']),
        ];
    }, $rows);

    return new WP_REST_Response(['cars' => $cars], 200);
}

/** Normaliza una fila de orden a la forma RawBooking que espera Andes. */
function andes_sync_normalize_order($r)
{
    $full  = trim(trim((string) $r['c_first']) . ' ' . trim((string) $r['c_last']));
    $name  = andes_sync_clean($full);
    if ($name === null) {
        $name = andes_sync_clean($r['nominative']);
    }
    if ($name === null) {
        $name = 'Sin nombre';
    }

    return [
        'wpBookingId'     => (int) $r['id'],
        'status'          => strtolower((string) $r['status']),
        'idcar'           => andes_sync_int_or_null($r['idcar']),
        'carindex'        => andes_sync_int_or_null($r['carindex']),
        'startUnix'       => (int) $r['ritiro'],
        'endUnix'         => (int) $r['consegna'],
        'createdUnix'     => andes_sync_int_or_null($r['ts']),
        'days'            => andes_sync_int_or_null($r['days']),
        'lang'            => andes_sync_clean($r['lang']),
        'clientName'      => $name,
        'clientEmail'     => andes_sync_clean($r['c_email']) ?: andes_sync_clean($r['custmail']),
        'clientPhone'     => andes_sync_clean($r['c_phone']) ?: andes_sync_clean($r['phone']),
        'clientDocNumber' => andes_sync_clean($r['c_docnum']),
        'custData'        => andes_sync_clean($r['custdata']),
        'orderTotal'      => andes_sync_float_or_null($r['order_total']),
        'carCost'         => andes_sync_float_or_null($r['car_cost']),
    ];
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
