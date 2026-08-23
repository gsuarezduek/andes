# Andes Pay Stripe — método de pago para VikRentCar

Agrega **"Andes Pay Stripe"** como forma de pago de VikRentCar Pro. Cobra el
**total de la reserva** con tarjeta usando **Stripe Checkout**: el cliente es
redirigido a una página alojada por Stripe (no se ingresan datos de tarjeta en
el sitio → PCI mínimo) y, al volver, el pago se **verifica contra la API de
Stripe** antes de confirmar la reserva. Es el mismo patrón que la pasarela
oficial de PayPal Checkout de VikWP.

## Por qué es un plugin aparte (y no un archivo dentro de VikRentCar)

VikRentCar descubre las pasarelas por dos hooks de WordPress. Este plugin se
engancha a ellos, así que la pasarela **sobrevive a las actualizaciones** de
VikRentCar (la carpeta `admin/payments/` del plugin se pisa en cada update; acá
no tocamos nada de eso).

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
5. Habilitá ese método de pago en el flujo de reserva de VikRentCar (según cómo
   tengas configurados los pagos/depósitos). El cobro es por el importe que
   VikRentCar define como "total a pagar ahora" — configurado para el **total**.

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
   - **4242 4242 4242 4242**, fecha futura cualquiera, CVC cualquiera.
3. Al pagar, Stripe te devuelve al sitio y la reserva queda **confirmada/pagada**
   en VikRentCar. Verificá en el panel de Stripe (Test mode) que figure el pago.

Cuando esté todo OK, cambiá el **Entorno a Live** y cargá la `sk_live_…`.

## Cómo verifica el pago (seguridad)

- El monto, la moneda y la orden se validan **server-side** consultando la
  Checkout Session en la API de Stripe (`payment_status = paid`, moneda esperada,
  `amount_total ≥ total`, y `client_reference_id` = id de la reserva). No se
  confía en nada que venga del navegador.
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
esta vía aparece como **"Pagado (webhook, sin retorno)"** — vale la pena
revisar esas reservas igual, ya que la confirmación automática no compara el
monto contra el total esperado (mismo criterio que la validación normal).

## Pantalla de admin (Ajustes → Andes Pay Stripe)

Una sola entrada de menú, con dos pestañas:

- **Pagos** (la que abre por defecto): registro local de cada intento de
  cobro, para poder revisar sin salir de WordPress qué pasó con un pago
  puntual. Estados posibles:
  - **Iniciado**: se creó la sesión de Checkout y se está esperando a que el
    cliente pague (o vuelva).
  - **Pagado**: Stripe confirmó `payment_status = paid` y VikRentCar marcó la
    reserva como pagada.
  - **Pagado (con aviso)**: pagado, pero el `client_reference_id` de la sesión
    no coincide con el pedido — vale la pena revisarlo a mano.
  - **Pagado (webhook, sin retorno)**: el cliente no volvió del checkout;
    Stripe avisó por webhook y se completó la reserva sola.
  - **No pagado**: el cliente volvió, pero Stripe todavía no reporta el pago
    como completado.
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

- **No toca la base de datos** ni el esquema de WordPress: VikRentCar marca la
  reserva como pagada a través de su propio framework de pagos.
- La pasarela es inmutable respecto de VikRentCar: sólo se registra vía hooks.
- El logo (`assets/andes_pay_stripe.png`) es opcional; sin él, el método aparece
  igual, sólo sin imagen.
