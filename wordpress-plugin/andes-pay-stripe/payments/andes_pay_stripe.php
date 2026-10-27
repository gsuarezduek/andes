<?php
/**
 * Andes Pay Stripe — pasarela de pago para VikRentCar (Stripe Checkout).
 *
 * Cobra lo que VikRentCar define como "total a pagar ahora" (`total_to_pay`):
 * el TOTAL de la reserva o la SEÑA, según lo que haya elegido el cliente en el
 * checkout (VikRentCar resuelve la elección y el cálculo; acá sólo se cobra ese
 * monto). Usa Stripe Checkout: el cliente es
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
     * Diagnóstico del último fallo de stripeRequest() (código HTTP + mensaje
     * de error de Stripe, o el mensaje de la excepción de red). Se usa para
     * loguear el motivo real en vez de solo "no se pudo" — antes se descartaba.
     *
     * @var string
     */
    protected $lastError = '';

    /**
     * Qué se está cobrando: 'deposit' (seña), 'full' (total) o '' si no se
     * sabe todavía. Lo setean beginTransaction() (desde leave_deposit) y
     * validateTransaction() (desde el metadata de la sesión); logEvent() lo
     * guarda en cada registro para que la pestaña Pagos muestre Seña/Total.
     *
     * @var string
     */
    protected $paymentKind = '';

    /**
     * True si validateTransaction() rechazó el aviso porque esa sesión ya se
     * había procesado (el cliente recargó la página de vuelta, o llegaron el
     * retorno y el webhook a la vez). complete() lo usa para mostrar el
     * mensaje de "gracias" en vez de "pago no verificado": el pago sí existe.
     *
     * @var bool
     */
    protected $alreadyProcessed = false;

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
                'html'  => '<p>Cobra con tarjeta vía <strong>Stripe Checkout</strong> el importe que VikRentCar define para pagar ahora: el <strong>total</strong> o la <strong>seña</strong>, según lo que elija el cliente (se configura en las opciones de seña de VikRentCar). '
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
     * Inicia la transacción: crea una Stripe Checkout Session por total_to_pay
     * (total o seña, ya resuelto por VikRentCar) y
     * redirige al cliente a la página de pago de Stripe. Este output se ejecuta
     * dentro de un buffer, así que se puede imprimir directamente.
     */
    protected function beginTransaction()
    {
        $booking = $this->orderRow();
        $orderId = (int) $this->orderValue('id');
        $env     = $this->resolveEnvironment();

        $secret = $this->getSecretKey();
        if (!$secret) {
            $this->logEvent('error', $env, $orderId, '', '', '', null, 'Falta configurar la Secret Key de Stripe.');
            echo $this->errorBox('El método de pago no está configurado (falta la Secret Key de Stripe). Avisá al establecimiento.');
            return true;
        }

        // total_to_pay ya viene con la seña aplicada (si el cliente la eligió) y
        // con el recargo/descuento del método de pago. NUNCA usar order_total
        // para cobrar: es el total de la reserva, no lo que se paga ahora.
        $currency = strtolower((string) $this->get('transaction_currency'));
        $total    = (float) $this->get('total_to_pay');
        $minor    = $this->toMinorUnits($total, $currency);

        $isDeposit         = !empty($this->get('leave_deposit'));
        $this->paymentKind = $isDeposit ? 'deposit' : 'full';

        if ($orderId <= 0 || $currency === '' || $minor <= 0) {
            $this->logEvent('error', $env, $orderId, '', '', $currency, $total, 'Datos de la reserva incompletos al iniciar el pago.');
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

        if ($itemName === '') {
            $itemName = 'Reserva #' . $orderId;
        }
        // En la página de Stripe el cliente ve si está pagando la seña.
        if ($isDeposit) {
            $itemName = function_exists('mb_substr')
                ? mb_substr('Seña – ' . $itemName, 0, 250)
                : substr('Seña – ' . $itemName, 0, 250);
        }

        $kindLabel = $isDeposit ? 'Seña' : 'Total';

        $payload = [
            'mode'                                              => 'payment',
            'success_url'                                       => $successUrl,
            'cancel_url'                                        => $cancelUrl,
            'client_reference_id'                               => (string) $orderId,
            'metadata[source]'                                  => 'vikrentcar-andes',
            'metadata[order_id]'                                => (string) $orderId,
            // sid/ts identifican la orden en VikRentCar (es lo que usa
            // notifypayment para buscarla); validateTransaction() los compara.
            'metadata[sid]'                                     => (string) $this->get('sid'),
            'metadata[ts]'                                      => (string) $this->get('ts'),
            'metadata[payment_kind]'                            => $this->paymentKind,
            'metadata[leave_deposit]'                           => $isDeposit ? '1' : '0',
            'metadata[amount_expected]'                         => (string) $total,
            // El mismo dato en el PaymentIntent, para verlo en la lista de
            // pagos del Dashboard de Stripe sin abrir la sesión de Checkout.
            'payment_intent_data[description]'                  => $kindLabel . ' reserva #' . $orderId,
            'payment_intent_data[metadata][source]'             => 'vikrentcar-andes',
            'payment_intent_data[metadata][order_id]'           => (string) $orderId,
            'payment_intent_data[metadata][payment_kind]'       => $this->paymentKind,
            'line_items[0][quantity]'                           => '1',
            'line_items[0][price_data][currency]'               => $currency,
            'line_items[0][price_data][unit_amount]'            => (string) $minor,
            'line_items[0][price_data][product_data][name]'     => $itemName,
        ];

        // Prellenar el email del cliente en Stripe cuando la reserva lo tiene.
        $email = $this->customerEmail(array_merge(['custmail' => $this->get('custmail')], $booking));
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
            $this->logEvent('error', $env, $orderId, '', '', $currency, $total, 'Stripe no devolvió una sesión de Checkout válida. ' . $this->lastError);
            echo $this->errorBox('No se pudo iniciar el pago con tarjeta. Probá de nuevo en unos minutos.');
            return true;
        }

        $this->logEvent('created', $env, $orderId, $session->id, '', $currency, $total, 'Sesión de Checkout creada (' . strtolower($kindLabel) . '), esperando a que el cliente pague.', $notifyUrl);

        // Aviso de depósito/seña si VikRentCar lo indica (mismo comportamiento que la pasarela oficial).
        if ($isDeposit) {
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
                <?php echo $isDeposit ? 'Pagar la seña con tarjeta' : 'Pagar con tarjeta'; ?>
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
     * Valida el pago al volver de Stripe (o cuando el webhook dispara el mismo
     * notify_url). Recupera la Checkout Session por su id y confirma
     * server-side que está pagada y que pertenece a ESTA orden. Cada sesión se
     * acepta una sola vez: un segundo aviso (recarga de la página, o retorno +
     * webhook a la vez) no vuelve a sumar el pago.
     */
    protected function validateTransaction(JPaymentStatus &$status)
    {
        // Acá (notifypayment) la orden NO viene en 'order': llega "plana"
        // (get('id'), get('sid'), get('ts')). orderValue() cubre los dos casos.
        $orderId = (int) $this->orderValue('id');
        $env     = $this->resolveEnvironment();

        $input     = JFactory::getApplication()->input;
        $sessionId = $input->getString('session_id');
        // El webhook agrega andes_via=webhook al notify_url. Sólo cambia cómo se
        // etiqueta el registro en Pagos; no da ningún permiso extra.
        $viaWebhook = ($input->getString('andes_via') === 'webhook');
        if (!$sessionId) {
            $status->appendLog('Falta session_id en el request de retorno.');
            $this->logEvent('error', $env, $orderId, '', '', '', null, 'Falta session_id en el request de retorno.');
            return false;
        }

        $secret = $this->getSecretKey();
        if (!$secret) {
            $status->appendLog('Secret Key de Stripe no configurada.');
            $this->logEvent('error', $env, $orderId, $sessionId, '', '', null, 'Secret Key de Stripe no configurada.');
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
            $this->logEvent('error', $env, $orderId, $sessionId, '', '', null, 'No se pudo recuperar la sesión de Stripe. ' . $this->lastError);
            return false;
        }

        // Único requisito duro: Stripe confirma que la sesión está pagada.
        if (!isset($session->payment_status) || $session->payment_status !== 'paid') {
            $paymentStatus = isset($session->payment_status) ? $session->payment_status : 'desconocido';
            $status->appendLog('El pago no figura como completado en Stripe (payment_status=' . $paymentStatus . ').');
            $this->logEvent('failed', $env, $orderId, $sessionId, '', '', null, 'payment_status=' . $paymentStatus);
            return false;
        }

        $meta = (isset($session->metadata) && is_object($session->metadata)) ? $session->metadata : new stdClass();
        if (isset($meta->payment_kind) && in_array($meta->payment_kind, ['deposit', 'full'], true)) {
            $this->paymentKind = $meta->payment_kind;
        }

        // La sesión tiene que ser de ESTA orden. Si no, alguien está usando un
        // pago de otra reserva en el notify_url de ésta: se rechaza. Sólo se
        // compara lo que esté disponible de los dos lados (sesiones viejas no
        // traen sid/ts en el metadata).
        $ref     = isset($session->client_reference_id) ? (string) $session->client_reference_id : '';
        $metaSid = isset($meta->sid) ? (string) $meta->sid : '';
        $metaTs  = isset($meta->ts) ? (string) $meta->ts : '';
        $sid     = (string) $this->orderValue('sid');
        $ts      = (string) $this->orderValue('ts');

        $mismatch = [];
        if ($orderId > 0 && $ref !== '' && $ref !== (string) $orderId) {
            $mismatch[] = "reserva #{$ref}";
        }
        if ($metaSid !== '' && $sid !== '' && $metaSid !== $sid) {
            $mismatch[] = 'sid distinto';
        }
        if ($metaTs !== '' && $ts !== '' && $metaTs !== $ts) {
            $mismatch[] = 'ts distinto';
        }
        if ($mismatch) {
            $msg = 'La sesión de Stripe pertenece a otra reserva (' . implode(', ', $mismatch) . "). Pago NO aplicado a la reserva #{$orderId}.";
            $status->appendLog($msg);
            $this->logEvent('failed', $env, $orderId, $sessionId, '', '', null, $msg);
            return false;
        }

        // Monto realmente cobrado, según Stripe (fuente de verdad del pago). No se
        // compara contra el total del pedido: en el contexto de validación esos
        // datos no siempre están disponibles y VikRentCar ya asocia el pago al
        // pedido correcto (mismo criterio que la pasarela oficial de PayPal).
        $currency  = isset($session->currency) ? strtolower((string) $session->currency) : '';
        $paidMinor = isset($session->amount_total) ? (int) $session->amount_total : 0;
        $paid      = $this->fromMinorUnits($paidMinor, $currency);

        $pi = '';
        if (isset($session->payment_intent)) {
            $pi = is_object($session->payment_intent) ? $session->payment_intent->id : $session->payment_intent;
        }

        // Una sola vez por sesión. La reserva se toma con un INSERT atómico
        // (tabla de claims con clave única): si dos avisos llegan a la vez,
        // sólo uno la gana. Sin esto, una recarga de la página de vuelta (o el
        // retorno y el webhook juntos) podría sumar el pago dos veces en
        // VikRentCar (totpaid).
        if (function_exists('andes_pay_stripe_claim_session')
            && !andes_pay_stripe_claim_session($sessionId, $orderId, $viaWebhook ? 'webhook' : 'return')) {
            $this->alreadyProcessed = true;
            // Sin esto VikRentCar le manda al admin el mail de "pago no
            // verificado" por el aviso repetido, aunque el pago sí entró.
            $status->setData('skip_email', 1);
            $status->appendLog("Sesión {$sessionId} ya procesada antes: no se vuelve a sumar el pago.");
            $this->logEvent('duplicate', $env, $orderId, $sessionId, $pi, $currency, $paid, 'Aviso repetido de un pago ya aplicado (recarga de la página o retorno + webhook). Ignorado, no se sumó dos veces.');
            return false;
        }

        // Guardar el id de la transacción (payment_intent) para referencia/reembolsos.
        if ($pi !== '') {
            $status->setData('transaction_id', $pi);
        }

        // Pago verificado. VikRentCar marca la orden como pagada/confirmada.
        $kindText = $this->paymentKind === 'deposit' ? ' (seña)' : ($this->paymentKind === 'full' ? ' (total)' : '');
        $status->appendLog("Pago verificado por Stripe{$kindText}: {$paid} " . strtoupper($currency) . " (session {$session->id}).");
        $this->logEvent(
            $viaWebhook ? 'webhook_completed' : 'paid',
            $env,
            $orderId,
            $sessionId,
            $pi,
            $currency,
            $paid,
            $viaWebhook
                ? 'El cliente no volvió del checkout: Stripe avisó por webhook y se confirmó la reserva automáticamente.'
                : 'Pago verificado por Stripe.'
        );
        $status->paid($paid);
        $status->verified();

        return true;
    }

    /**
     * Registra un evento en el log local (tabla wp_andes_pay_stripe_log) para
     * poder auditar pagos sin salir de WordPress. Silencioso si la función no
     * existe (por ejemplo, plugin principal no cargado en algún contexto raro).
     *
     * @param  string       $status
     * @param  string       $environment
     * @param  int          $orderId
     * @param  string       $sessionId
     * @param  string       $paymentIntentId
     * @param  string       $currency
     * @param  float|null   $amount
     * @param  string       $message
     * @param  string       $notifyUrl  Sólo se guarda al crear la sesión ('created'); el webhook lo usa para completar la reserva si el cliente no vuelve.
     */
    protected function logEvent($status, $environment, $orderId, $sessionId = '', $paymentIntentId = '', $currency = '', $amount = null, $message = '', $notifyUrl = '')
    {
        if (!function_exists('andes_pay_stripe_log_event')) {
            return;
        }
        andes_pay_stripe_log_event([
            'status'            => $status,
            'environment'       => $environment,
            'order_id'          => $orderId,
            'session_id'        => $sessionId,
            'payment_intent_id' => $paymentIntentId,
            'currency'          => $currency,
            'amount'            => $amount,
            'message'           => $message,
            'notify_url'        => $notifyUrl,
            'payment_kind'      => $this->paymentKind,
        ]);
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

        if ($res < 1 && !$this->alreadyProcessed) {
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
        $this->lastError = '';
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
            $this->lastError = 'Excepción al conectar con Stripe: ' . $e->getMessage();
            return null;
        }

        $code    = isset($response->code) ? (int) $response->code : 0;
        $decoded = isset($response->body) ? json_decode($response->body) : null;

        if ($code < 200 || $code >= 300) {
            $message = (is_object($decoded) && isset($decoded->error->message))
                ? $decoded->error->message
                : 'sin detalle en la respuesta';
            $this->lastError = "HTTP {$code}: {$message}";
            return null;
        }

        if (!is_object($decoded)) {
            $this->lastError = "HTTP {$code}: la respuesta no fue JSON válido.";
            return null;
        }

        return $decoded;
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
        if (in_array($currency, ANDES_PAY_STRIPE_ZERO_DECIMAL, true)) {
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
        if (in_array($currency, ANDES_PAY_STRIPE_ZERO_DECIMAL, true)) {
            return (float) $minor;
        }
        return $minor / 100;
    }

    /**
     * Fila de la orden. En beginTransaction() VikRentCar la pasa en 'order';
     * en validateTransaction() (task notifypayment) los datos llegan "planos"
     * y no hay 'order' (site/controller.php ~l.976). Se prueba 'order', después
     * getOrder() si existe; si nada, vacío y orderValue() lee el dato plano.
     *
     * @return array
     */
    protected function orderRow()
    {
        $row = $this->get('order', []);
        if (empty($row) && method_exists($this, 'getOrder')) {
            $row = $this->getOrder();
        }
        return (is_array($row) || is_object($row)) ? (array) $row : [];
    }

    /**
     * Un dato de la orden (id, sid, ts…), de la fila si está, si no del dato plano.
     *
     * @param  string  $key
     * @return mixed
     */
    protected function orderValue($key)
    {
        $row = $this->orderRow();
        if (isset($row[$key]) && $row[$key] !== '') {
            return $row[$key];
        }
        return $this->get($key);
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
