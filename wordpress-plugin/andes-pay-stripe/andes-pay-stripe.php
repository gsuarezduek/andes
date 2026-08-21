<?php
/**
 * Plugin Name: Andes Pay Stripe (VikRentCar)
 * Description: Agrega "Andes Pay Stripe" como método de pago de VikRentCar Pro. Cobra el total de la reserva con tarjeta usando Stripe Checkout (redirección alojada por Stripe, PCI mínimo). Verifica el pago contra la API de Stripe en el retorno, igual que la pasarela oficial de PayPal Checkout.
 * Version: 1.2.0
 * Author: MDZ Rent a Car
 * License: GPL-2.0-or-later
 *
 * v1.2.0: webhook de respaldo (checkout.session.completed). Si el cliente paga
 *         y cierra la pestaña antes de volver, Stripe avisa server-to-server;
 *         el handler dispara internamente el mismo notify_url que VikRentCar
 *         procesaría si el cliente hubiese vuelto (reusa su lógica real de
 *         "marcar pagado" en vez de tocar su base a mano). Requiere cargar el
 *         Webhook Signing Secret en Ajustes → Andes Pay Stripe.
 * v1.1.0: registro local de cada intento de cobro (tabla wp_andes_pay_stripe_log)
 *         + pantalla nueva Ajustes → Pagos (Stripe) para auditar pagos sin salir
 *         de WP: sesión iniciada, resultado de la validación, avisos de
 *         referencia no coincidente y errores — con link directo al Dashboard
 *         de Stripe por cada registro.
 *
 * CÓMO FUNCIONA
 * -------------
 * VikRentCar descubre las pasarelas por dos hooks de WordPress. Este plugin se
 * engancha a ellos SIN tocar la carpeta del plugin VikRentCar (que se pisa en
 * cada actualización): la pasarela vive acá y sobrevive a los updates.
 *
 *  - get_supported_payments_vikrentcar : agrega el archivo de la pasarela a la
 *    lista de métodos disponibles (aparece en VikRentCar → Pagos).
 *  - load_payment_gateway_vikrentcar   : cuando VikRentCar instancia el método
 *    "andes_pay_stripe", carga la clase VikRentCarAndesPayStripePayment.
 *
 * La clase de la pasarela (payments/andes_pay_stripe.php) extiende JPayment, la
 * clase base del framework de pagos de VikRentCar. Ese archivo se carga sólo
 * cuando VikRentCar dispara el hook, momento en el que JPayment ya existe.
 *
 * INSTALACIÓN Y CONFIGURACIÓN: ver README.md.
 */

if (!defined('ABSPATH')) {
    exit;
}

define('ANDES_PAY_STRIPE_DIR', __DIR__);
define('ANDES_PAY_STRIPE_GATEWAY', 'andes_pay_stripe');
define('ANDES_PAY_STRIPE_FILE', ANDES_PAY_STRIPE_DIR . '/payments/andes_pay_stripe.php');
define('ANDES_PAY_STRIPE_CLASS', 'VikRentCarAndesPayStripePayment');

// Nombre de la opción de WordPress donde se guardan las claves cargadas desde el panel.
define('ANDES_PAY_STRIPE_OPTION', 'andes_pay_stripe_options');

/**
 * Monedas de Stripe sin decimales: el importe se envía/recibe como entero
 * "tal cual" (no ×100). Única fuente: la usan tanto la pasarela (payments/
 * andes_pay_stripe.php) como el handler del webhook acá abajo.
 *
 * @see https://docs.stripe.com/currencies#zero-decimal
 */
define('ANDES_PAY_STRIPE_ZERO_DECIMAL', [
    'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
    'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
]);

/* -------------------------------------------------------------------------
 * Log de pagos (tabla propia)
 *
 * Registro local de cada intento de cobro: sesión de Checkout creada y
 * resultado de la validación (pagado, pagado con aviso de referencia, no
 * pagado, error). Existe para poder auditar pagos dudosos sin tener que
 * cruzar a mano el Dashboard de Stripe contra las órdenes de VikRentCar.
 * ---------------------------------------------------------------------- */

define('ANDES_PAY_STRIPE_LOG_DB_VERSION', '1.1');
define('ANDES_PAY_STRIPE_LOG_DB_VERSION_OPTION', 'andes_pay_stripe_log_db_version');

/** Nombre completo de la tabla del log (con el prefijo de WordPress). */
function andes_pay_stripe_log_table()
{
    global $wpdb;
    return $wpdb->prefix . 'andes_pay_stripe_log';
}

/** Crea/actualiza la tabla del log. dbDelta es idempotente: no hace nada si el esquema ya coincide. */
function andes_pay_stripe_install_log_table()
{
    global $wpdb;

    $table   = andes_pay_stripe_log_table();
    $charset = $wpdb->get_charset_collate();

    $sql = "CREATE TABLE {$table} (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        created_at DATETIME NOT NULL,
        status VARCHAR(20) NOT NULL,
        environment VARCHAR(10) NOT NULL DEFAULT '',
        order_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
        session_id VARCHAR(120) NOT NULL DEFAULT '',
        payment_intent_id VARCHAR(120) NOT NULL DEFAULT '',
        currency VARCHAR(10) NOT NULL DEFAULT '',
        amount DECIMAL(14,2) NULL DEFAULT NULL,
        message TEXT NULL,
        notify_url TEXT NULL,
        PRIMARY KEY  (id),
        KEY order_id (order_id),
        KEY status (status),
        KEY created_at (created_at)
    ) {$charset};";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta($sql);

    update_option(ANDES_PAY_STRIPE_LOG_DB_VERSION_OPTION, ANDES_PAY_STRIPE_LOG_DB_VERSION);
}
register_activation_hook(__FILE__, 'andes_pay_stripe_install_log_table');

/**
 * Red de seguridad: este plugin se actualiza subiendo archivos a mano (sin
 * desactivar/reactivar), así que el hook de activación no siempre corre tras
 * un cambio de versión. Chequeo barato (una lectura de option) en cada carga
 * del admin; dbDelta sólo hace trabajo real si el esquema cambió.
 */
add_action('admin_init', function () {
    if (get_option(ANDES_PAY_STRIPE_LOG_DB_VERSION_OPTION) !== ANDES_PAY_STRIPE_LOG_DB_VERSION) {
        andes_pay_stripe_install_log_table();
    }
});

/**
 * Registra un evento de pago. Nunca lanza: un fallo de logging no debe
 * interrumpir un cobro real (best-effort, igual que el resto del plugin).
 *
 * @param array $data status,environment,order_id,session_id,payment_intent_id,currency,amount,message,notify_url
 */
function andes_pay_stripe_log_event(array $data)
{
    global $wpdb;
    try {
        $wpdb->insert(andes_pay_stripe_log_table(), [
            'created_at'        => current_time('mysql'),
            'status'            => substr((string) ($data['status'] ?? ''), 0, 20),
            'environment'       => substr((string) ($data['environment'] ?? ''), 0, 10),
            'order_id'          => (int) ($data['order_id'] ?? 0),
            'session_id'        => substr((string) ($data['session_id'] ?? ''), 0, 120),
            'payment_intent_id' => substr((string) ($data['payment_intent_id'] ?? ''), 0, 120),
            'currency'          => substr((string) ($data['currency'] ?? ''), 0, 10),
            'amount'            => isset($data['amount']) ? (float) $data['amount'] : null,
            'message'           => isset($data['message']) ? (string) $data['message'] : null,
            'notify_url'        => isset($data['notify_url']) ? (string) $data['notify_url'] : null,
        ], ['%s', '%s', '%s', '%d', '%s', '%s', '%s', '%f', '%s', '%s']);
    } catch (Exception $e) {
        // best-effort: nunca romper el flujo de pago por un error de log.
    }
}

/**
 * ¿Esta sesión ya quedó resuelta como pagada (por el retorno del cliente o
 * por un webhook anterior)? La usa el handler del webhook para no disparar
 * dos veces la confirmación de la misma reserva.
 */
function andes_pay_stripe_log_already_settled($sessionId)
{
    global $wpdb;
    $table = andes_pay_stripe_log_table();
    $count = (int) $wpdb->get_var($wpdb->prepare(
        "SELECT COUNT(*) FROM {$table} WHERE session_id = %s AND status IN ('paid','paid_mismatch','webhook_completed')",
        $sessionId
    ));
    return $count > 0;
}

/**
 * Recupera el notify_url guardado cuando se creó la sesión de Checkout, para
 * que el webhook pueda disparar internamente la misma confirmación que
 * VikRentCar procesaría si el cliente hubiese vuelto por su cuenta.
 *
 * @return string|null
 */
function andes_pay_stripe_log_notify_url_for_session($sessionId)
{
    global $wpdb;
    $table = andes_pay_stripe_log_table();
    $url = $wpdb->get_var($wpdb->prepare(
        "SELECT notify_url FROM {$table} WHERE session_id = %s AND status = 'created' AND notify_url IS NOT NULL AND notify_url != '' ORDER BY id DESC LIMIT 1",
        $sessionId
    ));
    return ($url && is_string($url)) ? $url : null;
}

/**
 * Lista paginada de eventos del log, con filtros opcionales.
 *
 * @param  array  $filters  status,environment,order_id,search (session_id o payment_intent_id)
 * @param  int    $page
 * @param  int    $perPage
 * @return array{rows: array, total: int}
 */
function andes_pay_stripe_log_query(array $filters = [], $page = 1, $perPage = 30)
{
    global $wpdb;
    $table = andes_pay_stripe_log_table();

    $where  = [];
    $params = [];

    if (!empty($filters['status'])) {
        $where[]  = 'status = %s';
        $params[] = $filters['status'];
    }
    if (!empty($filters['environment'])) {
        $where[]  = 'environment = %s';
        $params[] = $filters['environment'];
    }
    if (!empty($filters['order_id'])) {
        $where[]  = 'order_id = %d';
        $params[] = (int) $filters['order_id'];
    }
    if (!empty($filters['search'])) {
        $like     = '%' . $wpdb->esc_like($filters['search']) . '%';
        $where[]  = '(session_id LIKE %s OR payment_intent_id LIKE %s)';
        $params[] = $like;
        $params[] = $like;
    }

    $whereSql = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

    $perPage = max(1, min(200, (int) $perPage));
    $page    = max(1, (int) $page);
    $offset  = ($page - 1) * $perPage;

    $countSql = "SELECT COUNT(*) FROM {$table} {$whereSql}";
    $total    = $params
        ? (int) $wpdb->get_var($wpdb->prepare($countSql, $params))
        : (int) $wpdb->get_var($countSql);

    $listSql    = "SELECT * FROM {$table} {$whereSql} ORDER BY id DESC LIMIT %d OFFSET %d";
    $listParams = array_merge($params, [$perPage, $offset]);
    $rows       = $wpdb->get_results($wpdb->prepare($listSql, $listParams));

    return ['rows' => $rows ?: [], 'total' => $total];
}

/**
 * 1) Publicar la pasarela en la lista de métodos de VikRentCar.
 *
 * El framework espera rutas completas a archivos .php; luego usa basename() para
 * derivar el "nombre" del método (acá: andes_pay_stripe).
 */
add_filter('get_supported_payments_vikrentcar', function ($drivers) {
    $drivers[] = ANDES_PAY_STRIPE_FILE;
    return $drivers;
});

/**
 * 2) Cargar la clase cuando VikRentCar instancia nuestra pasarela.
 *
 * El nombre de la clase debe empujarse dentro de $drivers (por referencia). El
 * dispatcher toma el último de la lista, así que sólo lo agregamos cuando el
 * método pedido es el nuestro.
 */
add_action('load_payment_gateway_vikrentcar', function (&$drivers, $payment) {
    if ($payment !== ANDES_PAY_STRIPE_GATEWAY) {
        return;
    }

    if (!class_exists(ANDES_PAY_STRIPE_CLASS)) {
        require_once ANDES_PAY_STRIPE_FILE;
    }

    $drivers[] = ANDES_PAY_STRIPE_CLASS;
}, 10, 2);

/**
 * 3) Logo del método en la pantalla de confirmación/pago.
 *
 * VikRentCar busca <nombre>.png en SU carpeta de pagos; como nuestro archivo
 * vive en otro lado, apuntamos el logo a este plugin si existe el png. Es
 * opcional: sin png, VikRentCar muestra el método igual, sólo sin imagen.
 */
add_filter('vikrentcar_oconfirm_payment_logo', function ($logo) {
    if (!is_array($logo) || !isset($logo['name']) || $logo['name'] !== ANDES_PAY_STRIPE_GATEWAY) {
        return $logo;
    }

    $png = ANDES_PAY_STRIPE_DIR . '/assets/andes_pay_stripe.png';
    if (file_exists($png)) {
        $logo['path'] = $png;
        $logo['uri']  = plugins_url('assets/andes_pay_stripe.png', __FILE__);
    }

    return $logo;
});

/* -------------------------------------------------------------------------
 * Claves cargadas desde el panel de WordPress
 *
 * La pasarela (payments/andes_pay_stripe.php) usa estos helpers como fuente de
 * las claves cuando el campo equivalente del método en VikRentCar está vacío.
 * Así se pueden cargar las claves de Stripe desde una pantalla propia del admin
 * de WordPress (Ajustes → Andes Pay Stripe), sin depender de la config de
 * VikRentCar. Precedencia final (en la pasarela): campo de VikRentCar → panel.
 * ---------------------------------------------------------------------- */

/**
 * Devuelve un valor de la configuración guardada en el panel de WordPress.
 *
 * @param  string  $key      Clave (environment|secret_key|secret_key_test|statement_descriptor)
 * @param  string  $default  Valor por defecto si no está seteada.
 * @return string
 */
function andes_pay_stripe_option($key, $default = '')
{
    $opts = get_option(ANDES_PAY_STRIPE_OPTION, []);
    if (is_array($opts) && isset($opts[$key]) && is_string($opts[$key]) && trim($opts[$key]) !== '') {
        return trim($opts[$key]);
    }
    return $default;
}

// Páginas de admin: Ajustes (claves) y Pagos (log de cobros).
add_action('admin_menu', function () {
    add_options_page(
        'Andes Pay Stripe',
        'Andes Pay Stripe',
        'manage_options',
        'andes-pay-stripe',
        'andes_pay_stripe_render_settings_page'
    );
    add_options_page(
        'Andes Pay Stripe — Pagos',
        'Pagos (Stripe)',
        'manage_options',
        'andes-pay-stripe-payments',
        'andes_pay_stripe_render_payments_page'
    );
});

/** Links "Pagos"/"Ajustes" en la fila del plugin (Plugins → Andes Pay Stripe). */
add_filter('plugin_action_links_' . plugin_basename(__FILE__), function ($links) {
    $payments = admin_url('options-general.php?page=andes-pay-stripe-payments');
    $settings = admin_url('options-general.php?page=andes-pay-stripe');
    array_unshift(
        $links,
        '<a href="' . esc_url($payments) . '">Pagos</a>',
        '<a href="' . esc_url($settings) . '">Ajustes</a>'
    );
    return $links;
});

add_action('admin_init', function () {
    register_setting('andes_pay_stripe', ANDES_PAY_STRIPE_OPTION, [
        'type'              => 'array',
        'sanitize_callback' => 'andes_pay_stripe_sanitize_options',
        'default'           => [],
    ]);

    add_settings_section(
        'andes_pay_stripe_main',
        'Claves de Stripe',
        function () {
            echo '<p>Cargá acá tus claves de Stripe. Empezá en <strong>Test</strong> con la clave <code>sk_test_…</code> '
                . 'y pasá a <strong>Live</strong> cuando esté probado. '
                . 'Estos valores se usan salvo que el método de pago en VikRentCar tenga su propio campo cargado.</p>';
        },
        'andes-pay-stripe'
    );

    add_settings_field('environment', 'Entorno', 'andes_pay_stripe_field_environment', 'andes-pay-stripe', 'andes_pay_stripe_main');
    add_settings_field('secret_key', 'Secret Key (Live)', 'andes_pay_stripe_field_secret_live', 'andes-pay-stripe', 'andes_pay_stripe_main');
    add_settings_field('secret_key_test', 'Secret Key (Test)', 'andes_pay_stripe_field_secret_test', 'andes-pay-stripe', 'andes_pay_stripe_main');
    add_settings_field('statement_descriptor', 'Descriptor en el resumen', 'andes_pay_stripe_field_descriptor', 'andes-pay-stripe', 'andes_pay_stripe_main');

    add_settings_section(
        'andes_pay_stripe_webhook',
        'Webhook de respaldo',
        function () {
            $url = esc_url(rest_url('andes-pay-stripe/v1/webhook'));
            echo '<p>Cierra el caso "el cliente paga y cierra la pestaña antes de volver": Stripe te avisa '
                . 'directamente (sin depender del navegador) y esto completa la reserva sola.</p>'
                . '<p>En el panel de Stripe → <strong>Developers → Webhooks → Add endpoint</strong>, cargá esta URL '
                . 'y suscribila al evento <code>checkout.session.completed</code>:</p>'
                . '<p><input type="text" class="regular-text" style="width:420px" readonly onclick="this.select()" value="' . $url . '" /></p>'
                . '<p class="description">Hacé esto una vez en modo <strong>Test</strong> y otra en <strong>Live</strong> '
                . '(son pantallas separadas en Stripe) — cada una te da un "Signing secret" (<code>whsec_…</code>) distinto, '
                . 'que va en los campos de abajo. Sin el secreto correspondiente cargado, los webhooks de ese entorno '
                . 'se ignoran (no rompe nada, simplemente no hacen efecto).</p>';
        },
        'andes-pay-stripe'
    );
    add_settings_field('webhook_secret', 'Webhook Signing Secret (Live)', 'andes_pay_stripe_field_webhook_secret_live', 'andes-pay-stripe', 'andes_pay_stripe_webhook');
    add_settings_field('webhook_secret_test', 'Webhook Signing Secret (Test)', 'andes_pay_stripe_field_webhook_secret_test', 'andes-pay-stripe', 'andes_pay_stripe_webhook');
});

/**
 * Sanitiza y valida los valores del formulario. Las claves usan el patrón
 * "dejar en blanco para conservar la actual": así el secreto no se imprime en
 * el HTML de la página y no se pisa por accidente al guardar.
 *
 * @param  mixed  $input
 * @return array
 */
function andes_pay_stripe_sanitize_options($input)
{
    $current = get_option(ANDES_PAY_STRIPE_OPTION, []);
    if (!is_array($current)) {
        $current = [];
    }
    if (!is_array($input)) {
        $input = [];
    }

    $out = [];

    // Entorno: lista blanca.
    $env = isset($input['environment']) ? (string) $input['environment'] : 'test';
    $out['environment'] = ($env === 'live') ? 'live' : 'test';

    // Claves: si el campo llega vacío, se conserva la guardada.
    foreach (['secret_key', 'secret_key_test', 'webhook_secret', 'webhook_secret_test'] as $key) {
        $submitted = isset($input[$key]) ? trim((string) $input[$key]) : '';
        if ($submitted !== '') {
            $out[$key] = sanitize_text_field($submitted);
        } elseif (isset($current[$key])) {
            $out[$key] = $current[$key];
        }
    }

    // Descriptor: máx. 22 caracteres.
    $desc = isset($input['statement_descriptor']) ? trim((string) $input['statement_descriptor']) : '';
    if ($desc !== '') {
        $out['statement_descriptor'] = substr(sanitize_text_field($desc), 0, 22);
    }

    return $out;
}

/** Render de la página de ajustes. */
function andes_pay_stripe_render_settings_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }
    ?>
    <div class="wrap">
        <h1>Andes Pay Stripe</h1>
        <p>Método de pago con tarjeta (Stripe Checkout) para VikRentCar. Para que aparezca en el
            checkout, además de cargar las claves acá tenés que habilitar el método
            <strong>Andes Pay Stripe</strong> en <em>VikRentCar → Pagos</em>.</p>
        <form action="options.php" method="post">
            <?php
            settings_fields('andes_pay_stripe');
            do_settings_sections('andes-pay-stripe');
            submit_button('Guardar claves');
            ?>
        </form>
    </div>
    <?php
}

/** Campo: entorno. */
function andes_pay_stripe_field_environment()
{
    $env = andes_pay_stripe_option('environment', 'test');
    ?>
    <select name="<?php echo esc_attr(ANDES_PAY_STRIPE_OPTION); ?>[environment]">
        <option value="test" <?php selected($env, 'test'); ?>>Test (sandbox, sin cobros reales)</option>
        <option value="live" <?php selected($env, 'live'); ?>>Live (cobros reales)</option>
    </select>
    <?php
}

/** Render de un campo de clave secreta con el patrón "dejar en blanco para conservar". */
function andes_pay_stripe_secret_field($key, $describedby)
{
    $saved = andes_pay_stripe_option($key, '') !== '';
    $placeholder = $saved ? '•••••••••••• (guardada — dejá en blanco para conservarla)' : 'sk_…';
    printf(
        '<input type="password" autocomplete="new-password" class="regular-text" name="%1$s[%2$s]" value="" placeholder="%3$s" aria-describedby="%4$s" />',
        esc_attr(ANDES_PAY_STRIPE_OPTION),
        esc_attr($key),
        esc_attr($placeholder),
        esc_attr($describedby)
    );
}

/** Campo: secret key live. */
function andes_pay_stripe_field_secret_live()
{
    andes_pay_stripe_secret_field('secret_key', 'andes-pay-stripe-live-desc');
    echo '<p class="description" id="andes-pay-stripe-live-desc">Clave <code>sk_live_…</code> de producción. Panel de Stripe → Developers → API keys.</p>';
}

/** Campo: secret key test. */
function andes_pay_stripe_field_secret_test()
{
    andes_pay_stripe_secret_field('secret_key_test', 'andes-pay-stripe-test-desc');
    echo '<p class="description" id="andes-pay-stripe-test-desc">Clave <code>sk_test_…</code> de prueba. Se usa cuando el Entorno está en Test.</p>';
}

/** Campo: webhook signing secret (live). */
function andes_pay_stripe_field_webhook_secret_live()
{
    andes_pay_stripe_secret_field('webhook_secret', 'andes-pay-stripe-webhook-live-desc');
    echo '<p class="description" id="andes-pay-stripe-webhook-live-desc">El <code>whsec_…</code> que te da Stripe al crear el endpoint en modo Live.</p>';
}

/** Campo: webhook signing secret (test). */
function andes_pay_stripe_field_webhook_secret_test()
{
    andes_pay_stripe_secret_field('webhook_secret_test', 'andes-pay-stripe-webhook-test-desc');
    echo '<p class="description" id="andes-pay-stripe-webhook-test-desc">El <code>whsec_…</code> que te da Stripe al crear el endpoint en modo Test.</p>';
}

/** Campo: descriptor del resumen de tarjeta. */
function andes_pay_stripe_field_descriptor()
{
    $val = andes_pay_stripe_option('statement_descriptor', '');
    printf(
        '<input type="text" class="regular-text" maxlength="22" name="%1$s[statement_descriptor]" value="%2$s" placeholder="MDZ RENT A CAR" />',
        esc_attr(ANDES_PAY_STRIPE_OPTION),
        esc_attr($val)
    );
    echo '<p class="description">Texto corto que ve el cliente en su resumen de tarjeta (máx. 22 caracteres). Opcional.</p>';
}

/* -------------------------------------------------------------------------
 * Página "Pagos": lista del log local con filtros y link al Dashboard de Stripe.
 * ---------------------------------------------------------------------- */

/** Etiqueta y colores por estado, para la tabla de Pagos. */
function andes_pay_stripe_status_meta($status)
{
    $map = [
        'created'           => ['Iniciado',                  '#374151', '#f3f4f6'],
        'paid'              => ['Pagado',                     '#166534', '#dcfce7'],
        'paid_mismatch'     => ['Pagado (con aviso)',         '#92400e', '#fef3c7'],
        'webhook_completed' => ['Pagado (webhook, sin retorno)', '#075985', '#e0f2fe'],
        'failed'            => ['No pagado',                  '#991b1b', '#fee2e2'],
        'error'             => ['Error',                      '#991b1b', '#fee2e2'],
    ];
    return isset($map[$status]) ? $map[$status] : [$status, '#374151', '#f3f4f6'];
}

/** Link al Dashboard de Stripe para el registro (payment_intent si existe, si no la sesión de Checkout). */
function andes_pay_stripe_dashboard_link($row)
{
    $base = 'https://dashboard.stripe.com/' . ($row->environment === 'test' ? 'test/' : '');
    if (!empty($row->payment_intent_id)) {
        return $base . 'payments/' . rawurlencode($row->payment_intent_id);
    }
    if (!empty($row->session_id)) {
        return $base . 'checkout/sessions/' . rawurlencode($row->session_id);
    }
    return null;
}

/** Render de la página "Pagos" (log local de cobros). */
function andes_pay_stripe_render_payments_page()
{
    if (!current_user_can('manage_options')) {
        return;
    }

    $filters = [
        'status'      => isset($_GET['status']) ? sanitize_text_field(wp_unslash($_GET['status'])) : '',
        'environment' => isset($_GET['environment']) ? sanitize_text_field(wp_unslash($_GET['environment'])) : '',
        'order_id'    => isset($_GET['order_id']) ? (int) $_GET['order_id'] : 0,
        'search'      => isset($_GET['s']) ? sanitize_text_field(wp_unslash($_GET['s'])) : '',
    ];
    $paged   = isset($_GET['paged']) ? max(1, (int) $_GET['paged']) : 1;
    $perPage = 30;

    $result = andes_pay_stripe_log_query($filters, $paged, $perPage);
    $rows   = $result['rows'];
    $total  = $result['total'];
    $pages  = (int) ceil($total / $perPage);

    $baseUrl = admin_url('options-general.php?page=andes-pay-stripe-payments');
    ?>
    <div class="wrap">
        <h1>Andes Pay Stripe — Pagos</h1>
        <p>Registro local de cada intento de cobro: sesión de Checkout iniciada y
            resultado de la verificación contra Stripe. Sirve para revisar acá, sin
            salir de WordPress, qué pasó con un pago puntual — incluidos los avisos
            de referencia no coincidente y los errores, que hoy sólo quedan en el
            log interno de VikRentCar.</p>

        <form method="get" style="margin: 16px 0; display:flex; gap:10px; flex-wrap:wrap; align-items:end;">
            <input type="hidden" name="page" value="andes-pay-stripe-payments" />
            <label>Estado<br/>
                <select name="status">
                    <option value="">Todos</option>
                    <?php foreach (['created' => 'Iniciado', 'paid' => 'Pagado', 'paid_mismatch' => 'Pagado (con aviso)', 'webhook_completed' => 'Pagado (webhook, sin retorno)', 'failed' => 'No pagado', 'error' => 'Error'] as $val => $label): ?>
                        <option value="<?php echo esc_attr($val); ?>" <?php selected($filters['status'], $val); ?>><?php echo esc_html($label); ?></option>
                    <?php endforeach; ?>
                </select>
            </label>
            <label>Entorno<br/>
                <select name="environment">
                    <option value="">Todos</option>
                    <option value="live" <?php selected($filters['environment'], 'live'); ?>>Live</option>
                    <option value="test" <?php selected($filters['environment'], 'test'); ?>>Test</option>
                </select>
            </label>
            <label>Nº de reserva<br/>
                <input type="number" name="order_id" value="<?php echo $filters['order_id'] ? esc_attr($filters['order_id']) : ''; ?>" style="width:100px" />
            </label>
            <label>Buscar (session/payment id)<br/>
                <input type="text" name="s" value="<?php echo esc_attr($filters['search']); ?>" style="width:220px" />
            </label>
            <?php submit_button('Filtrar', 'secondary', '', false); ?>
            <a href="<?php echo esc_url($baseUrl); ?>" class="button">Limpiar</a>
        </form>

        <table class="widefat striped">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Entorno</th>
                    <th>Reserva</th>
                    <th>Monto</th>
                    <th>IDs / Stripe</th>
                    <th>Detalle</th>
                </tr>
            </thead>
            <tbody>
            <?php if (!$rows): ?>
                <tr><td colspan="7">Sin registros todavía. Los pagos que se intenten a partir de ahora van a aparecer acá.</td></tr>
            <?php endif; ?>
            <?php foreach ($rows as $row): ?>
                <?php
                list($label, $fg, $bg) = andes_pay_stripe_status_meta($row->status);
                $link = andes_pay_stripe_dashboard_link($row);
                ?>
                <tr>
                    <td><?php echo esc_html(mysql2date('d/m/Y H:i', $row->created_at)); ?></td>
                    <td>
                        <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600;color:<?php echo esc_attr($fg); ?>;background:<?php echo esc_attr($bg); ?>;">
                            <?php echo esc_html($label); ?>
                        </span>
                    </td>
                    <td><?php echo esc_html($row->environment !== '' ? ucfirst($row->environment) : '—'); ?></td>
                    <td><?php echo $row->order_id ? esc_html('#' . $row->order_id) : '—'; ?></td>
                    <td><?php echo ($row->amount !== null && $row->amount !== '') ? esc_html(number_format((float) $row->amount, 2) . ' ' . strtoupper($row->currency)) : '—'; ?></td>
                    <td style="font-size:12px;color:#6b7280;">
                        <?php if ($row->session_id): ?>cs: <?php echo esc_html(substr($row->session_id, 0, 24)); ?>…<br/><?php endif; ?>
                        <?php if ($row->payment_intent_id): ?>pi: <?php echo esc_html($row->payment_intent_id); ?><br/><?php endif; ?>
                        <?php if ($link): ?><a href="<?php echo esc_url($link); ?>" target="_blank" rel="noopener noreferrer">Ver en Stripe →</a><?php endif; ?>
                    </td>
                    <td style="font-size:12px;max-width:320px;"><?php echo esc_html($row->message ?: '—'); ?></td>
                </tr>
            <?php endforeach; ?>
            </tbody>
        </table>

        <?php if ($pages > 1): ?>
            <div style="margin-top:14px;">
                <?php
                $queryArgs = array_filter([
                    'page'        => 'andes-pay-stripe-payments',
                    'status'      => $filters['status'],
                    'environment' => $filters['environment'],
                    'order_id'    => $filters['order_id'] ?: '',
                    's'           => $filters['search'],
                ]);
                $paginationBase = add_query_arg($queryArgs, admin_url('options-general.php'));
                echo paginate_links([
                    'base'    => add_query_arg('paged', '%#%', $paginationBase),
                    'format'  => '',
                    'current' => $paged,
                    'total'   => $pages,
                ]);
                ?>
            </div>
        <?php endif; ?>
    </div>
    <?php
}

/* -------------------------------------------------------------------------
 * Webhook de respaldo (checkout.session.completed)
 *
 * Cierra el caso "el cliente paga y cierra la pestaña antes de volver": ese
 * pago existe en Stripe pero, sin esto, la reserva de VikRentCar nunca se
 * entera. En vez de escribir directamente en la base de VikRentCar (no
 * tenemos su código fuente acá para saber con certeza su esquema interno de
 * "orden pagada"), este handler dispara internamente el mismo notify_url que
 * VikRentCar procesaría si el cliente hubiese vuelto por su cuenta — reusa su
 * lógica real en vez de duplicarla a mano.
 * ---------------------------------------------------------------------- */

add_action('rest_api_init', function () {
    register_rest_route('andes-pay-stripe/v1', '/webhook', [
        'methods'             => 'POST',
        'callback'            => 'andes_pay_stripe_handle_webhook',
        // Sin autenticación de WP: la única verificación es la firma de Stripe
        // (estándar para webhooks — así funciona también la pasarela oficial).
        'permission_callback' => '__return_true',
    ]);
});

/**
 * Verifica la firma de un webhook de Stripe a mano (este plugin no usa el SDK
 * oficial de PHP, sólo llamadas HTTP directas). Prueba el secreto Live y
 * después el Test: el que valide determina el entorno del evento.
 *
 * @see https://docs.stripe.com/webhooks#verify-manually
 * @return array{0:string,1:object}|null  [entorno, evento decodificado] o null si no valida.
 */
function andes_pay_stripe_verify_webhook($payload, $sigHeader)
{
    if (!is_string($sigHeader) || $sigHeader === '' || !is_string($payload) || $payload === '') {
        return null;
    }

    $timestamp  = null;
    $signatures = [];
    foreach (explode(',', $sigHeader) as $part) {
        $pair = explode('=', $part, 2);
        if (count($pair) !== 2) {
            continue;
        }
        if ($pair[0] === 't') {
            $timestamp = (int) $pair[1];
        } elseif ($pair[0] === 'v1') {
            $signatures[] = $pair[1];
        }
    }

    if (!$timestamp || !$signatures) {
        return null;
    }

    // Tolerancia de 5 minutos contra replay attacks (mismo criterio que la librería oficial de Stripe).
    if (abs(time() - $timestamp) > 300) {
        return null;
    }

    $signedPayload = $timestamp . '.' . $payload;

    $secrets = [
        'live' => andes_pay_stripe_option('webhook_secret', ''),
        'test' => andes_pay_stripe_option('webhook_secret_test', ''),
    ];

    foreach ($secrets as $env => $secret) {
        if ($secret === '') {
            continue;
        }
        $expected = hash_hmac('sha256', $signedPayload, $secret);
        foreach ($signatures as $sig) {
            if (hash_equals($expected, $sig)) {
                $event = json_decode($payload);
                return is_object($event) ? [$env, $event] : null;
            }
        }
    }

    return null;
}

/**
 * Handler del endpoint REST. Siempre responde 200 salvo firma inválida —
 * eventos que no nos interesan simplemente se ignoran (Stripe reintenta si no
 * recibe 2xx, y no queremos reintentos infinitos por eventos ajenos).
 */
function andes_pay_stripe_handle_webhook(WP_REST_Request $request)
{
    $verification = andes_pay_stripe_verify_webhook($request->get_body(), $request->get_header('stripe-signature'));
    if (!$verification) {
        return new WP_REST_Response(['error' => 'Firma inválida o secreto no configurado.'], 400);
    }
    [$env, $event] = $verification;

    if (!isset($event->type) || $event->type !== 'checkout.session.completed') {
        return new WP_REST_Response(['ignored' => true], 200);
    }

    $session = isset($event->data->object) ? $event->data->object : null;
    if (!is_object($session) || !isset($session->id)) {
        return new WP_REST_Response(['ignored' => true], 200);
    }

    // Sólo procesamos sesiones creadas por esta pasarela: la cuenta de Stripe
    // puede tener otros cobros ajenos a VikRentCar.
    $source = isset($session->metadata->source) ? (string) $session->metadata->source : '';
    if ($source !== 'vikrentcar-andes') {
        return new WP_REST_Response(['ignored' => true], 200);
    }

    if (!isset($session->payment_status) || $session->payment_status !== 'paid') {
        return new WP_REST_Response(['ignored' => true], 200);
    }

    $sessionId = (string) $session->id;
    $orderId   = isset($session->metadata->order_id) ? (int) $session->metadata->order_id : 0;

    // Idempotencia: si el retorno normal del cliente (u otro webhook) ya
    // resolvió esta sesión, no hay nada más que hacer.
    if (andes_pay_stripe_log_already_settled($sessionId)) {
        return new WP_REST_Response(['already_settled' => true], 200);
    }

    $currency  = isset($session->currency) ? strtolower((string) $session->currency) : '';
    $paidMinor = isset($session->amount_total) ? (int) $session->amount_total : 0;
    $paid      = in_array($currency, ANDES_PAY_STRIPE_ZERO_DECIMAL, true) ? (float) $paidMinor : $paidMinor / 100;

    $notifyUrl = andes_pay_stripe_log_notify_url_for_session($sessionId);
    if (!$notifyUrl) {
        andes_pay_stripe_log_event([
            'status'      => 'error',
            'environment' => $env,
            'order_id'    => $orderId,
            'session_id'  => $sessionId,
            'currency'    => $currency,
            'amount'      => $paid,
            'message'     => 'Webhook: Stripe confirma el pago pero no se encontró el notify_url guardado (sesión creada antes de activar el webhook, o log incompleto). No se pudo completar la reserva sola — revisala a mano en VikRentCar.',
        ]);
        return new WP_REST_Response(['error' => 'notify_url no encontrado'], 200);
    }

    // Reconstruye la misma URL de retorno que Stripe le habría dado al
    // navegador del cliente, y la dispara server-to-server: VikRentCar la
    // procesa exactamente igual (vuelve a llamar a validateTransaction()).
    $glue        = (strpos($notifyUrl, '?') !== false) ? '&' : '?';
    $completeUrl = $notifyUrl . $glue . 'session_id=' . rawurlencode($sessionId);

    $response = wp_remote_get($completeUrl, [
        'timeout'     => 20,
        'redirection' => 0, // VikRentCar redirige al cliente al terminar; no nos interesa seguirlo.
    ]);

    if (is_wp_error($response)) {
        andes_pay_stripe_log_event([
            'status'      => 'error',
            'environment' => $env,
            'order_id'    => $orderId,
            'session_id'  => $sessionId,
            'currency'    => $currency,
            'amount'      => $paid,
            'message'     => 'Webhook: falló el request interno a VikRentCar para completar la reserva (' . $response->get_error_message() . ').',
        ]);
        return new WP_REST_Response(['error' => 'notify request failed'], 200);
    }

    $code = (int) wp_remote_retrieve_response_code($response);
    $ok   = ($code >= 200 && $code < 400);

    andes_pay_stripe_log_event([
        'status'      => $ok ? 'webhook_completed' : 'error',
        'environment' => $env,
        'order_id'    => $orderId,
        'session_id'  => $sessionId,
        'currency'    => $currency,
        'amount'      => $paid,
        'message'     => $ok
            ? 'El cliente no volvió del checkout — Stripe avisó por webhook y se disparó la confirmación en VikRentCar automáticamente. Conviene verificar la reserva.'
            : "Webhook: el request interno a VikRentCar respondió HTTP {$code} al intentar completar la reserva.",
    ]);

    return new WP_REST_Response(['ok' => $ok], 200);
}
