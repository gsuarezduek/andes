# Andes Pay Stripe — método de pago para VikRentCar

Agrega **"Andes Pay Stripe"** como forma de pago de VikRentCar. Cobra con
tarjeta el **total** o la **seña** de la reserva (lo que elija el cliente)
usando **Stripe Checkout**: el cliente es
redirigido a una página alojada por Stripe (no se ingresan datos de tarjeta en
el sitio → PCI mínimo) y, al volver, el pago se **verifica contra la API de
Stripe** antes de confirmar la reserva. Es el mismo patrón que la pasarela
oficial de PayPal Checkout de VikWP.

## Por qué es un plugin aparte (y no un archivo dentro de VikRentCar)

VikRentCar descubre las pasarelas por dos hooks de WordPress. Este plugin se
engancha a ellos, así que la pasarela **sobrevive a las actualizaciones** de
VikRentCar (la carpeta `admin/payments/` del plugin se pisa en cada update; acá
no tocamos nada de eso).

**Si se modifica el código de VikRentCar** (lo mantenemos nosotros): el plugin
depende de los hooks `get_supported_payments_vikrentcar` y
`load_payment_gateway_vikrentcar`, de la clase `JPayment` y de que la vista de
la orden le pase `total_to_pay`, `leave_deposit`, `notify_url`, `sid` y `ts`.
Si algo de eso cambia, el método de pago deja de aparecer o de cobrar bien.

## Instalación

1. Subí la carpeta `andes-pay-stripe/` a `wp-content/plugins/andes-pay-stripe/`.
   - Estructura mínima:
     ```
     wp-content/plugins/andes-pay-stripe/
       ├── andes-pay-stripe.php        (plugin principal + registro de hooks)
       ├── payments/andes_pay_stripe.php  (la pasarela)
       └── assets/andes_pay_stripe.png    (logo opcional, 200×~60px)
     ```
2. En **WP Admin → Plugins**, activá **"Andes Pay Stripe (VikRentCar)"**.
3. Cargá las claves de Stripe (ver **Dónde cargar las claves** abajo).
4. En **VikRentCar → Global Config → Payments** (o "Nuevo método de pago"),
   agregá un método y elegí **Andes Pay Stripe** de la lista para que aparezca
   en el checkout.
5. Habilitá ese método de pago en el flujo de reserva de VikRentCar. El cobro
   es por el importe que VikRentCar define como "total a pagar ahora"
   (`total_to_pay`): el total o la seña, ver **Seña o total** abajo.

## Seña o total

El cliente elige en el checkout de VikRentCar si paga el total o la seña.
VikRentCar calcula el monto y se lo pasa al plugin en `total_to_pay`; el plugin
cobra exactamente eso (nunca `order_total`). Configuración en VikRentCar
(**afecta a todos los métodos de pago**, no sólo a Stripe):

| Opción | Valor |
|---|---|
| Pagar monto total | **OFF** |
| Elección del cliente (seña o total) | **ON** |
| Seña | **30%** |
| Permitir pagos múltiples | **OFF** |

**El saldo se cobra al retirar el auto** y se carga a mano en Andes (Caja /
entrega), no por Stripe. Por eso "Pagos múltiples" va apagado: si estuviera
prendido, la página de la orden le ofrecería al cliente pagar el saldo online,
y como Andes no escribe en WordPress, un saldo cobrado en el local no se vería
en VikRentCar → el cliente podría pagarlo dos veces.

Cuando el cliente paga la seña:
- La página de Stripe muestra "Seña – …" y el botón dice "Pagar la seña con tarjeta".
- En el Dashboard de Stripe el pago figura como "Seña reserva #N" (y `metadata.payment_kind = deposit`).
- En la pestaña **Pagos** el monto lleva la etiqueta **Seña**.
- VikRentCar suma el pago a `totpaid` y confirma la reserva; Andes lo importa a
  Caja en el próximo sync y el saldo queda pendiente hasta que se cargue el
  resto al entregar.

## Dónde cargar las claves

Hay **dos lugares** y podés usar cualquiera de los dos:

1. **Config del método en VikRentCar** (`VikRentCar → Pagos → Andes Pay Stripe`):
   entorno (Test/Live), Secret Key Live, Secret Key Test y descriptor.
2. **Panel de WordPress → Ajustes → Andes Pay Stripe → pestaña Configuración**
   (global): los mismos campos. Las claves se guardan como password; para
   conservar una ya guardada, dejá el campo en blanco (no se reimprime en la
   página por seguridad).

**Precedencia: gana VikRentCar.** Si un campo está cargado en el método de
VikRentCar, se usa ese — el panel de WordPress **se ignora por completo** para
ese campo, aunque tenga algo cargado. Si el sitio ya viene funcionando de
antes, lo más probable es que la clave esté en el lugar 1 y el panel nunca se
haya usado (va a mostrar los valores por defecto sin que eso signifique nada).
Antes de tocar el panel para diagnosticar un problema de cobros, confirmá
primero la config del método en VikRentCar — ahí está la que realmente se usa.

## Claves de Stripe

Panel de Stripe → **Developers → API keys**:

- **Secret key** (`sk_live_…`) para producción.
- En modo test, activá "Viewing test data" y copiá la `sk_test_…`.

Sólo se usa la **secret key** (Checkout por redirección no necesita la
publishable). La clave se guarda en la configuración de VikRentCar (base de
WordPress). **Serví siempre por HTTPS.**

## Probar (modo Test)

1. Con el **Entorno = Test**, hacé una reserva y elegí *Andes Pay Stripe*.
2. Serás redirigido a Stripe. Usá una tarjeta de prueba:
   - **4000 0566 5566 5556** (débito), fecha futura cualquiera, CVC cualquiera.
   - La 4242 4242 4242 4242 (crédito US) se rechaza con nuestra cuenta de EE. UU.
     cobrando en ARS ("try a debit card"): es esperado.
3. Al pagar, Stripe te devuelve al sitio y la reserva queda **confirmada/pagada**
   en VikRentCar. Verificá en el panel de Stripe (Test mode) que figure el pago.

Checklist de seña/total:
1. Reservar eligiendo **seña** → Stripe cobra el 30%; en VikRentCar `totpaid` =
   seña y la reserva queda confirmada; en Pagos, "Pagado" con etiqueta **Seña**.
2. Reservar eligiendo **total** → cobra el total; etiqueta **Total**.
3. Después de pagar, **recargar** la página de vuelta de Stripe → `totpaid` no
   cambia. VikRentCar ve la orden ya confirmada y corta antes de llamar al
   plugin, así que esto no deja registro en Pagos.
4. Pagar y llamar al `notify_url` dos veces a la vez (o el retorno y el webhook
   juntos, antes de que la orden se confirme) → uno queda "Pagado" y el otro
   "Repetido (ignorado)", sin mail de "pago no verificado" al admin.

Cuando esté todo OK, cambiá el **Entorno a Live** y cargá la `sk_live_…`.

## Cómo verifica el pago (seguridad)

- El pago se valida **server-side** consultando la Checkout Session en la API
  de Stripe (`payment_status = paid`). No se confía en nada que venga del
  navegador.
- El monto que se le informa a VikRentCar es el que Stripe dice que cobró
  (`amount_total`). No se compara contra el total: en la validación VikRentCar
  no pasa `total_to_pay`, y la seña sería menor que el total igual.
- La sesión tiene que ser de **esa** reserva (`client_reference_id`, y `sid`/`ts`
  en el metadata): si no coincide, se rechaza.
- **Cada sesión se aplica una sola vez** (tabla `wp_andes_pay_stripe_claims`,
  clave única por sesión). Si el retorno y el webhook llegan a la vez, antes
  de que la orden quede confirmada, el segundo no suma el pago de nuevo. Una
  recarga posterior ni llega al plugin: VikRentCar corta antes porque la orden
  ya está confirmada.
- En la validación (task `notifypayment`) VikRentCar no pasa la orden en
  `order`: los datos llegan "planos" (`get('id')`, `get('sid')`, `get('ts')`).
  El plugin lee los dos formatos.
- El `session_id` viaja en la URL de retorno; aunque alguien la manipule, la
  verificación contra Stripe falla si el pago no existe o no corresponde.

## Moneda

Se usa la **moneda global de VikRentCar** (no se configura en la pasarela). Tu
cuenta de Stripe debe soportar esa moneda. Los importes se envían en la unidad
mínima (centavos; o entero para monedas sin decimales como JPY/CLP). Si operás
en **ARS**, confirmá que tu cuenta de Stripe admite cobros en pesos; si no,
configurá VikRentCar en una moneda soportada (p. ej. USD).

## Modelo de retorno + webhook de respaldo

La confirmación "normal" ocurre cuando el cliente **vuelve** de Stripe al
sitio (mismo modelo que PayPal Checkout de VikWP). Si el cliente cierra la
pestaña antes de volver, el pago existe en Stripe pero, sin nada más, la
reserva queda pendiente para siempre — esta es la causa más probable de "no
estoy seguro si se hizo".

Para cerrar ese hueco hay un **webhook de Stripe** (`checkout.session.completed`)
como respaldo: Stripe le avisa a WordPress directamente (server-to-server, sin
depender del navegador del cliente) apenas se completa el pago. El plugin
**no** escribe directamente en la base de VikRentCar (no tenemos su código
fuente para conocer su esquema interno con certeza) — en cambio, dispara
internamente la misma URL de confirmación que VikRentCar procesaría si el
cliente hubiese vuelto por su cuenta, reusando su lógica real.

**Activarlo (opcional, recomendado):**
1. En **Ajustes → Andes Pay Stripe → pestaña Configuración**, copiá la URL del
   webhook que aparece en la sección "Webhook de respaldo".
2. En el panel de Stripe → **Developers → Webhooks → Add endpoint**, pegá esa
   URL y suscribila al evento `checkout.session.completed`. Hacelo una vez en
   modo **Test** y otra en **Live** (pantallas separadas en Stripe).
3. Cada uno te da un **Signing secret** (`whsec_…`) distinto — cargalos en los
   campos correspondientes de Ajustes.

Sin el secreto de un entorno cargado, los webhooks de ese entorno se ignoran
(nada se rompe, simplemente no hacen efecto — el flujo normal por retorno
sigue funcionando igual). En la pestaña **Pagos**, un registro completado por
esta vía aparece como **"Pagado (webhook, sin retorno)"**. Si VikRentCar no
aplica el pago (aunque responda HTTP 200), queda un **Error** que lo dice: el
webhook confirma mirando si la sesión quedó aplicada, no el código HTTP.

## Pantalla de admin (Ajustes → Andes Pay Stripe)

Una sola entrada de menú, con dos pestañas:

- **Pagos** (la que abre por defecto): registro local de cada intento de
  cobro, para poder revisar sin salir de WordPress qué pasó con un pago
  puntual. Estados posibles:
  - **Iniciado**: se creó la sesión de Checkout y se está esperando a que el
    cliente pague (o vuelva).
  - **Pagado**: Stripe confirmó `payment_status = paid` y VikRentCar marcó la
    reserva como pagada.
  - **Pagado (con aviso)**: sólo en registros anteriores a v1.3.0 (pagado con
    una referencia que no coincidía). Desde v1.3.0 eso se rechaza como **No pagado**.
  - **Repetido (ignorado)**: llegó un segundo aviso de un pago ya aplicado
    (retorno + webhook a la vez). No se sumó dos veces ni se mandó el mail de
    "pago no verificado".
  - **Pagado (webhook, sin retorno)**: el cliente no volvió del checkout;
    Stripe avisó por webhook y se completó la reserva sola.
  - **No pagado**: el cliente volvió, pero Stripe todavía no reporta el pago
    como completado, o la sesión era de otra reserva.
  - **Error**: falta configuración, no se pudo hablar con la API de Stripe, o
    faltaban datos de la reserva. El mensaje incluye el **código HTTP y el
    error real que devolvió Stripe** (p. ej. clave inválida, moneda no
    soportada) — no un texto genérico.
- **Configuración**: claves de Stripe, descriptor y los secretos del webhook
  (ver "Dónde cargar las claves" arriba — ojo con la precedencia de VikRentCar).

Cada fila de Pagos tiene filtros (estado, entorno, Nº de reserva,
session/payment id) y un link directo **"Ver en Stripe"** al Dashboard (test o
live, según corresponda). Los datos se guardan en la tabla propia
`wp_andes_pay_stripe_log` — no reemplaza el historial de VikRentCar, es un
registro paralelo pensado para auditoría.

## Notas

- **No toca las tablas de VikRentCar**: VikRentCar marca la reserva como pagada
  a través de su propio framework de pagos. Sólo usa dos tablas propias
  (`wp_andes_pay_stripe_log` y `wp_andes_pay_stripe_claims`), que se crean solas
  al entrar al admin después de actualizar.
- La pasarela es inmutable respecto de VikRentCar: sólo se registra vía hooks.
- El logo (`assets/andes_pay_stripe.png`) es opcional; sin él, el método aparece
  igual, sólo sin imagen.
