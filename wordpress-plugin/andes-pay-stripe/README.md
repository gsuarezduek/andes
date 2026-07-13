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

1. **Panel de WordPress → Ajustes → Andes Pay Stripe** (recomendado, global):
   entorno (Test/Live), Secret Key Live, Secret Key Test y descriptor. Las claves
   se guardan como password; para conservar una ya guardada, dejá el campo en
   blanco (no se reimprime en la página por seguridad).
2. **Config del método en VikRentCar** (override por método): los mismos campos.
   Dejá el **Entorno** en *"Usar el del panel de WordPress"* para heredar.

**Precedencia:** si un campo está cargado en el método de VikRentCar, gana ese;
si está vacío, se usa el del panel de WordPress. Así podés tener las claves una
sola vez en el panel y, si algún día lo necesitás, pisarlas por método.

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

## Modelo de retorno (y una limitación conocida)

La confirmación ocurre cuando el cliente **vuelve** de Stripe al sitio (mismo
modelo que PayPal Checkout de VikWP). Si el cliente cierra la pestaña antes de
volver, el pago existe en Stripe pero la reserva queda pendiente hasta que
regrese por el enlace. Para cerrar ese hueco se puede agregar más adelante un
**webhook de Stripe** (`checkout.session.completed`) como respaldo; no está en
esta primera versión para mantenerla simple y en paridad con la oficial.

## Notas

- **No toca la base de datos** ni el esquema de WordPress: VikRentCar marca la
  reserva como pagada a través de su propio framework de pagos.
- La pasarela es inmutable respecto de VikRentCar: sólo se registra vía hooks.
- El logo (`assets/andes_pay_stripe.png`) es opcional; sin él, el método aparece
  igual, sólo sin imagen.
