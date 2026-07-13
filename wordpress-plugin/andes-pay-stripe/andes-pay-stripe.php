<?php
/**
 * Plugin Name: Andes Pay Stripe (VikRentCar)
 * Description: Agrega "Andes Pay Stripe" como método de pago de VikRentCar Pro. Cobra el total de la reserva con tarjeta usando Stripe Checkout (redirección alojada por Stripe, PCI mínimo). Verifica el pago contra la API de Stripe en el retorno, igual que la pasarela oficial de PayPal Checkout.
 * Version: 1.0.0
 * Author: MDZ Rent a Car
 * License: GPL-2.0-or-later
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

// Página de ajustes (solo en el admin).
add_action('admin_menu', function () {
    add_options_page(
        'Andes Pay Stripe',
        'Andes Pay Stripe',
        'manage_options',
        'andes-pay-stripe',
        'andes_pay_stripe_render_settings_page'
    );
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
    foreach (['secret_key', 'secret_key_test'] as $key) {
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
