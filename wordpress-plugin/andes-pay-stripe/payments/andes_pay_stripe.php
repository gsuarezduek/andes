<?php
/**
 * Andes Pay Stripe — pasarela de pago para VikRentCar (Stripe Checkout).
 *
 * Cobra el TOTAL de la reserva con tarjeta usando Stripe Checkout: el cliente es
 * redirigido a una página alojada por Stripe (PCI mínimo, sin datos de tarjeta
 * en el sitio) y al volver se verifica el pago consultando la API de Stripe.
 * No confía en el navegador: el estado "pagado" se confirma server-side.
 *
 * Se apoya en el framework de pagos de VikRentCar (clase base JPayment). Este
 * archivo lo carga andes-pay-stripe.php cuando VikRentCar dispara el hook
 * load_payment_gateway_vikrentcar, momento en el que JPayment ya está disponible.
 *
 * @package  andes-pay-stripe
 */

defined('ABSPATH') or die('No script kiddies please!');

JLoader::import('adapter.payment.payment');

/**
 * @see JPayment (libraries/adapter/payment/payment.php)
 */
class VikRentCarAndesPayStripePayment extends JPayment
{
    /**
     * Base de la API REST de Stripe. El modo test/live no cambia la URL: se
     * distingue por la clave secreta (sk_test_… vs sk_live_…).
     */
    const STRIPE_API = 'https://api.stripe.com';

    /**
     * Monedas de Stripe sin decimales: el importe se envía como entero "tal cual"
     * (no ×100). El resto va en la unidad mínima (centavos).
     *
     * @see https://docs.stripe.com/currencies#zero-decimal
     */
    const ZERO_DECIMAL = [
        'bif', 'clp', 'djf', 'gnf', 'jpy', 'kmf', 'krw', 'mga',
        'pyg', 'rwf', 'ugx', 'vnd', 'vuv', 'xaf', 'xof', 'xpf',
    ];

    /**
     * @override
     */
    public function __construct($alias, $order, $params = [])
    {
        parent::__construct($alias, $order, $params);
    }

    /**
     * @override
     * Formulario de configuración del método en el admin de VikRentCar.
     * La moneda no se configura acá: se toma de la moneda global de VikRentCar.
     */
    protected function buildAdminParameters()
    {
        return [
            'intro' => [
                'type'  => 'custom',
                'label' => '',
                'html'  => '<p>Cobra el total de la reserva con tarjeta vía <strong>Stripe Checkout</strong>. '
                    . 'Podés cargar las claves acá <em>o</em> en <strong>Ajustes → Andes Pay Stripe</strong> del panel de WordPress. '
                    . 'Si dejás un campo vacío acá, se usa el valor del panel. Empezá siempre en modo <em>Test</em> con claves <code>sk_test_…</code>.</p>',
            ],
            'environment' => [
                'type'    => 'select',
                'label'   => 'Entorno',
                'help'    => 'Dejá "Usar el del panel de WordPress" para tomar el entorno configurado en Ajustes → Andes Pay Stripe.',
                'default' => '',
                'options' => [
                    ''     => 'Usar el del panel de WordPress',
                    'live' => 'Live (cobros reales)',
                    'test' => 'Test (sandbox)',
                ],
            ],
            'secret_key' => [
                'type'  => 'password',
                'label' => 'Secret Key (Live)',
                'help'  => 'Opcional si ya la cargaste en el panel de WordPress. Clave sk_live_… de Stripe.',
            ],
            'secret_key_test' => [
                'type'  => 'password',
                'label' => 'Secret Key (Test)',
                'help'  => 'Opcional si ya la cargaste en el panel de WordPress. Clave sk_test_… de Stripe.',
            ],
            'statement_descriptor' => [
                'type'  => 'text',
                'label' => 'Descriptor en el resumen',
                'help'  => 'Texto corto que ve el cliente en su resumen de tarjeta (máx. 22 caracteres). Opcional.',
            ],
        ];
    }

    /**
     * @override
     * Inicia la transacción: crea una Stripe Checkout Session por el total y
     * redirige al cliente a la página de pago de Stripe. Este output se ejecuta
     * dentro de un buffer, así que se puede imprimir directamente.
     */
    protected function beginTransaction()
    {
        $secret = $this->getSecretKey();
        if (!$secret) {
            echo $this->errorBox('El método de pago no está configurado (falta la Secret Key de Stripe). Avisá al establecimiento.');
            return true;
        }

        $booking  = (array) $this->get('order', []);
        $orderId  = isset($booking['id']) ? (int) $booking['id'] : 0;
        $currency = strtolower((string) $this->get('transaction_currency'));
        $total    = (float) $this->get('total_to_pay');
        $minor    = $this->toMinorUnits($total, $currency);

        if ($orderId <= 0 || $currency === '' || $minor <= 0) {
            echo $this->errorBox('No se pudo iniciar el pago: datos de la reserva incompletos.');
            return true;
        }

        // notify_url ya enruta al task de validación de VikRentCar para esta
        // orden/pago. Stripe reemplaza {CHECKOUT_SESSION_ID} por el id real al
        // redirigir tras el pago; así lo recuperamos en validateTransaction().
        $notifyUrl = (string) $this->get('notify_url');
        $glue      = (strpos($notifyUrl, '?') !== false) ? '&' : '?';
        $successUrl = $notifyUrl . $glue . 'session_id={CHECKOUT_SESSION_ID}';

        // Página de la orden como destino de cancelación (el cliente vuelve sin pagar).
        $cancelUrl = rtrim(JUri::root(), '/') . '/index.php?option=com_vikrentcar&view=order'
            . '&sid=' . rawurlencode((string) $this->get('sid'))
            . '&ts=' . rawurlencode((string) $this->get('ts'));

        // Nombre del ítem acotado a 250 chars (límite de product_data.name en Stripe).
        $itemName = (string) $this->get('transaction_name');
        if (function_exists('mb_substr')) {
            $itemName = mb_substr($itemName, 0, 250);
        } else {
            $itemName = substr($itemName, 0, 250);
        }

        $payload = [
            'mode'                                              => 'payment',
            'success_url'                                       => $successUrl,
            'cancel_url'                                        => $cancelUrl,
            'client_reference_id'                               => (string) $orderId,
            'metadata[source]'                                  => 'vikrentcar-andes',
            'metadata[order_id]'                                => (string) $orderId,
            'line_items[0][quantity]'                           => '1',
            'line_items[0][price_data][currency]'               => $currency,
            'line_items[0][price_data][unit_amount]'            => (string) $minor,
            'line_items[0][price_data][product_data][name]'     => $itemName !== '' ? $itemName : ('Reserva #' . $orderId),
        ];

        // Prellenar el email del cliente en Stripe cuando la reserva lo tiene.
        $email = $this->customerEmail($booking);
        if ($email) {
            $payload['customer_email'] = $email;
        }

        // Descriptor en el resumen de la tarjeta (opcional, máx. 22 chars).
        $descriptor = trim((string) $this->getParam('statement_descriptor', ''));
        if ($descriptor === '' && function_exists('andes_pay_stripe_option')) {
            $descriptor = andes_pay_stripe_option('statement_descriptor', '');
        }
        if ($descriptor !== '') {
            $payload['payment_intent_data[statement_descriptor]'] = substr($descriptor, 0, 22);
        }

        $session = $this->stripeRequest('POST', '/v1/checkout/sessions', $secret, $payload);

        if (!is_object($session) || empty($session->url)) {
            echo $this->errorBox('No se pudo iniciar el pago con tarjeta. Probá de nuevo en unos minutos.');
            return true;
        }

        // Aviso de depósito/seña si VikRentCar lo indica (mismo comportamiento que la pasarela oficial).
        if ($this->get('leave_deposit')) {
            echo '<p class="vrc-leave-deposit"><span>' . JText::_('VRLEAVEDEPOSIT') . '</span>'
                . $this->get('currency_symb') . ' ' . VikRentCar::numberFormat($this->get('total_to_pay')) . '</p><br/>';
        }

        // Notas del método de pago configuradas en VikRentCar.
        $info = $this->get('payment_info');
        if (is_array($info) && !empty($info['note'])) {
            echo VRCPlatformDetection::isWordPress() ? wpautop($info['note']) : $info['note'];
        }

        $stripeUrl = esc_url_raw($session->url);

        // Botón visible (fallback si el JS está deshabilitado) + redirección automática.
        ?>
        <div class="andes-pay-stripe">
            <a class="andes-pay-stripe-btn" href="<?php echo htmlspecialchars($stripeUrl, ENT_QUOTES); ?>">
                Pagar con tarjeta
            </a>
            <p class="andes-pay-stripe-hint">Hacé clic para pagar de forma segura con Stripe.</p>
        </div>
        <style>
            .andes-pay-stripe { text-align: center; margin: 16px 0; }
            .andes-pay-stripe-btn {
                display: inline-block; padding: 14px 28px; border-radius: 8px;
                background: #635bff; color: #fff; font-weight: 600; text-decoration: none;
                font-size: 16px;
            }
            .andes-pay-stripe-btn:hover { background: #4f46e5; color: #fff; }
            .andes-pay-stripe-hint { color: #6b7280; font-size: 13px; margin-top: 10px; }
        </style>
        <?php

        return true;
    }

    /**
     * @override
     * Valida el pago al volver de Stripe. Recupera la Checkout Session por su id
     * y confirma server-side que está pagada, con la moneda correcta, el monto
     * esperado y asociada a ESTA orden (evita replay entre reservas).
     */
    protected function validateTransaction(JPaymentStatus &$status)
    {
        $sessionId = JFactory::getApplication()->input->getString('session_id');
        if (!$sessionId) {
            $status->appendLog('Falta session_id en el request de retorno.');
            return false;
        }

        $secret = $this->getSecretKey();
        if (!$secret) {
            $status->appendLog('Secret Key de Stripe no configurada.');
            return false;
        }

        // Expandimos el payment_intent para registrar el id de la transacción.
        $session = $this->stripeRequest(
            'GET',
            '/v1/checkout/sessions/' . rawurlencode($sessionId) . '?expand[]=payment_intent',
            $secret
        );

        if (!is_object($session) || !isset($session->id)) {
            $status->appendLog('No se pudo recuperar la sesión de Stripe.');
            return false;
        }

        // Único requisito duro: Stripe confirma que la sesión está pagada.
        if (!isset($session->payment_status) || $session->payment_status !== 'paid') {
            $status->appendLog('El pago no figura como completado en Stripe (payment_status='
                . (isset($session->payment_status) ? $session->payment_status : 'desconocido') . ').');
            return false;
        }

        // Monto realmente cobrado, según Stripe (fuente de verdad del pago). No se
        // compara contra el total del pedido: en el contexto de validación esos
        // datos no siempre están disponibles y VikRentCar ya asocia el pago al
        // pedido correcto (mismo criterio que la pasarela oficial de PayPal).
        $currency  = isset($session->currency) ? strtolower((string) $session->currency) : '';
        $paidMinor = isset($session->amount_total) ? (int) $session->amount_total : 0;
        $paid      = $this->fromMinorUnits($paidMinor, $currency);

        // Chequeo blando: si tenemos el id del pedido, avisamos (sin bloquear) si
        // la referencia de la sesión no coincide.
        $booking = (array) $this->get('order', []);
        $orderId = isset($booking['id']) ? (int) $booking['id'] : 0;
        $ref     = isset($session->client_reference_id) ? (string) $session->client_reference_id : '';
        if ($orderId > 0 && $ref !== '' && $ref !== (string) $orderId) {
            $status->appendLog("Aviso: client_reference_id ({$ref}) distinto del pedido ({$orderId}).");
        }

        // Guardar el id de la transacción (payment_intent) para referencia/reembolsos.
        if (isset($session->payment_intent)) {
            $pi = is_object($session->payment_intent) ? $session->payment_intent->id : $session->payment_intent;
            $status->setData('transaction_id', $pi);
        }

        // Pago verificado. VikRentCar marca la orden como pagada/confirmada.
        $status->appendLog("Pago verificado por Stripe: {$paid} " . strtoupper($currency) . " (session {$session->id}).");
        $status->paid($paid);
        $status->verified();

        return true;
    }

    /**
     * @override
     * Finaliza: redirige al cliente a la página de su reserva con el resultado.
     */
    protected function complete($res)
    {
        $app    = JFactory::getApplication();
        $itemid = $this->getItemID();

        $url = 'index.php?option=com_vikrentcar&view=order&sid=' . $this->get('sid')
            . '&ts=' . $this->get('ts')
            . (!empty($itemid) ? '&Itemid=' . $itemid : '');

        if ($res < 1) {
            $app->enqueueMessage(JText::_('VRPAYMENTNOTVER'), 'error');
        } else {
            $app->enqueueMessage(JText::_('VRTHANKSONE'));
        }

        $app->redirect(JRoute::_($url, false));
        $app->close();
    }

    /**
     * Clave secreta según el entorno configurado (live/test).
     *
     * @return string|null
     */
    protected function getSecretKey()
    {
        $env = $this->resolveEnvironment();

        // 1) Campo del método en VikRentCar (override por método).
        $key = ($env === 'live')
            ? $this->getParam('secret_key', '')
            : $this->getParam('secret_key_test', '');
        $key = trim((string) $key);
        if ($key !== '') {
            return $key;
        }

        // 2) Panel de WordPress (Ajustes → Andes Pay Stripe).
        if (function_exists('andes_pay_stripe_option')) {
            $opt = ($env === 'live')
                ? andes_pay_stripe_option('secret_key', '')
                : andes_pay_stripe_option('secret_key_test', '');
            if ($opt !== '') {
                return $opt;
            }
        }

        return null;
    }

    /**
     * Resuelve el entorno (live/test): primero el campo del método en VikRentCar;
     * si quedó en "heredar" (vacío), el del panel de WordPress; por defecto test.
     *
     * @return string  'live' | 'test'
     */
    protected function resolveEnvironment()
    {
        $env = trim((string) $this->getParam('environment', ''));
        if ($env === '' && function_exists('andes_pay_stripe_option')) {
            $env = andes_pay_stripe_option('environment', 'test');
        }
        return $env === 'live' ? 'live' : 'test';
    }

    /**
     * Llama a la API de Stripe (form-encoded + Basic auth con la secret key).
     * Devuelve el objeto decodificado, o null ante error/HTTP != 200.
     *
     * @param  string  $method   GET|POST
     * @param  string  $path     Ruta de la API (empezando con /v1/…)
     * @param  string  $secret   Secret key de Stripe
     * @param  array   $body     Cuerpo para POST (form-encoded)
     * @return object|null
     */
    protected function stripeRequest($method, $path, $secret, array $body = [])
    {
        $http = new JHttp;

        $headers = [
            'Authorization' => 'Basic ' . base64_encode($secret . ':'),
            'Stripe-Version' => '2024-06-20',
        ];

        try {
            if (strtoupper($method) === 'POST') {
                $headers['Content-Type'] = 'application/x-www-form-urlencoded';
                $response = $http->post(self::STRIPE_API . $path, $body, $headers);
            } else {
                $response = $http->get(self::STRIPE_API . $path, $headers);
            }
        } catch (Exception $e) {
            return null;
        }

        if (!isset($response->code) || $response->code < 200 || $response->code >= 300) {
            return null;
        }

        $decoded = json_decode($response->body);
        return is_object($decoded) ? $decoded : null;
    }

    /**
     * Convierte un importe a la unidad mínima que espera Stripe (centavos, salvo
     * monedas sin decimales). Redondea al entero más cercano.
     *
     * @param  float   $amount
     * @param  string  $currency  ISO en minúsculas
     * @return int
     */
    protected function toMinorUnits($amount, $currency)
    {
        if (in_array($currency, self::ZERO_DECIMAL, true)) {
            return (int) round($amount);
        }
        return (int) round($amount * 100);
    }

    /**
     * Inverso de toMinorUnits(): de la unidad mínima al importe legible.
     *
     * @param  int     $minor
     * @param  string  $currency  ISO en minúsculas
     * @return float
     */
    protected function fromMinorUnits($minor, $currency)
    {
        if (in_array($currency, self::ZERO_DECIMAL, true)) {
            return (float) $minor;
        }
        return $minor / 100;
    }

    /**
     * Intenta obtener el email del cliente desde el registro de la reserva.
     *
     * @param  array  $booking
     * @return string|null
     */
    protected function customerEmail(array $booking)
    {
        foreach (['custmail', 'email', 'customer_email'] as $key) {
            if (!empty($booking[$key]) && is_string($booking[$key])) {
                $val = trim($booking[$key]);
                if ($val !== '' && strpos($val, '@') !== false) {
                    return $val;
                }
            }
        }
        return null;
    }

    /**
     * @wponly
     * Item ID de WordPress para armar la URL de retorno (igual que la pasarela oficial).
     *
     * @return int
     */
    protected function getItemID()
    {
        $app   = JFactory::getApplication();
        $input = $app->input;

        $itemid = $input->getInt('Itemid');

        if (!$itemid) {
            $model  = JModel::getInstance('vikrentcar', 'shortcodes', 'admin');
            $itemid = $model->all('post_id', $full = true);

            if (count($itemid)) {
                $itemid = $itemid[0]->post_id;
            }
        }

        return (int) $itemid;
    }

    /**
     * Cajita de error para mostrar dentro del flujo de pago.
     *
     * @param  string  $message
     * @return string
     */
    protected function errorBox($message)
    {
        return '<div class="andes-pay-stripe-error" style="padding:14px;border:1px solid #fca5a5;'
            . 'background:#fef2f2;color:#991b1b;border-radius:8px;">'
            . htmlspecialchars($message, ENT_QUOTES) . '</div>';
    }
}
