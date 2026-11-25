# Historial de funcionalidades

Detalle de cada versión de Andes, separado por área. `CLAUDE.md` tiene solo las reglas y un resumen; esto se lee cuando la tarea toca un área o cuando un comentario del código cita una versión ("ver v34").

## Áreas

| Archivo | Qué cubre |
|---|---|
| [fases-0-11.md](fases-0-11.md) | Estado de las fases del brief: fundaciones, datos/auth, entrega, devolución, dashboard, sync, refinamientos, tests, documentos, liquidación, firma remota, reportes. |
| [entrega-devolucion.md](entrega-devolucion.md) | Wizard de inspección, evidencia offline, km, liquidación, devolución tardía, firma remota en vivo, contrato/condiciones generales, acta. |
| [caja.md](caja.md) | Ingresos/egresos, garantías, pagos en USD, condonar saldo, facturación, exportar CSV, aprobación de cambios de empleados. |
| [caja-cuentas.md](caja-cuentas.md) | Proveedores/asociados, subcuentas, Saldos, traspasos, Caja fuerte, Billetera, USD de referencia, comisiones, fondos, Bitcoin, cuentas de Finanzas, compensaciones. |
| [whatsapp.md](whatsapp.md) | Inbox, webhook, ventana de 24 h, ecos de Coexistence, estados de triage, bot con tools, adjuntos, aviso de sonido. |
| [calendario.md](calendario.md) | Grilla de flota, ventana de 90 días, barras/horarios/lugares, presupuestos, precios por forma de pago, resaltados. |
| [vehiculos.md](vehiculos.md) | Ficha, apodo, camionetas, GPS, service y alertas, competencia, autos de terceros y contrato de cesión, permisos. |
| [reservas.md](reservas.md) | Notas de equipo, estados/colores, indicador de pago, ajustes de flujo, verificación, menciones. |
| [sync-vikrentcar.md](sync-vikrentcar.md) | Tarifas y temporadas, plugin andes-sync, standby, opcionales, cupones, cambios post-entrega, métodos de pago. |
| [stripe-plugin.md](stripe-plugin.md) | Pasarela de pago para VikRentCar: registro, validación, log, webhook, seña. |
| [usuarios-auth.md](usuarios-auth.md) | Logins, recuperar contraseña, borrar usuarios (nombre congelado), roles Finanzas/Socio/propietario, inactividad, "Ver como…". |
| [reportes.md](reportes.md) | Períodos, egresos por categoría, conversión y respuesta de WhatsApp, ocupación/rentabilidad, egresos vía cuentas corrientes. |
| [habitaciones.md](habitaciones.md) | Sync iCal, espejos entre canales, bloqueos, cobros en otra moneda, corrección de fechas. |
| [tareas-equipo.md](tareas-equipo.md) | Tareas, recurrentes, horarios del equipo, días especiales, agenda del Home. |
| [plataforma.md](plataforma.md) | Auditoría v12 (seguridad, UX, performance), nube y limpieza de archivos, paleta de comandos, tema, navegación, correos. |

## Índice por versión

En orden cronológico. Los números repetidos son secciones distintas.

| Versión | Archivo |
|---|---|
| Estado actual | [fases-0-11](fases-0-11.md) |
| v2 (mejoras post-fase-6) | [fases-0-11](fases-0-11.md) |
| v3 — Refinamientos de flota, entrega y acta (post-fase-11) | [entrega-devolucion](entrega-devolucion.md) |
| v4 — Calendario de flota (timeline) | [calendario](calendario.md) |
| v5 — Tarifa por día del auto (desde VikRentCar, actualizada por sync) | [sync-vikrentcar](sync-vikrentcar.md) |
| v6 — Plugin andes-sync configurable + más datos + reservas sin confirmar | [sync-vikrentcar](sync-vikrentcar.md) |
| v7 — Notas del equipo (vehículos y reservas) + nombres/colores de estado unificados | [reservas](reservas.md) |
| v8 — Caja (registro de cobros y pagos) | [caja](caja.md) |
| v9 — Indicador de pago (borde) en Calendario / Alquileres / Home | [reservas](reservas.md) |
| v10 — Historial de logins (sección Usuarios) | [usuarios-auth](usuarios-auth.md) |
| v11 — Recuperar contraseña | [usuarios-auth](usuarios-auth.md) |
| Add-on — Andes Pay Stripe (pasarela de pago para VikRentCar) | [stripe-plugin](stripe-plugin.md) |
| v12 — Auditoría integral: seguridad, UX del wizard, Configuración/Reportes/Caja, arquitectura y performance | [plataforma](plataforma.md) |
| v13 — Usuarios dentro de Configuración + Reportes por mes cerrado | [reportes](reportes.md) |
| v14 — Tareas (coordinación de equipo) | [tareas-equipo](tareas-equipo.md) |
| v15 — % de gracia configurable para "Service vencido" + Alertas arriba del Home | [vehiculos](vehiculos.md) |
| v16 — Avanzar sin señal (desacoplar la confirmación de la evidencia) | [entrega-devolucion](entrega-devolucion.md) |
| v17 — WhatsApp (mensajería con clientes) | [whatsapp](whatsapp.md) |
| v18 — Bot de IA de WhatsApp | [whatsapp](whatsapp.md) |
| v19 — Corrección de la integración con Chakra contra su documentación real | [whatsapp](whatsapp.md) |
| v20 — El webhook de Chakra confirmado contra una cuenta real (y una corrección sobre la corrección) | [whatsapp](whatsapp.md) |
| v21 — Pendiente de respuesta, ecos de Coexistence y conversaciones únicas en Reportes | [whatsapp](whatsapp.md) |
| v22 — Vínculo a reservas, badge de no leídos en el menú, y el bot en la misma página de WhatsApp | [whatsapp](whatsapp.md) |
| v23 — "No leído" en vez de "Pendiente", fondo distinto y filtro | [whatsapp](whatsapp.md) |
| v24 — El bot de WhatsApp puede consultar disponibilidad, precios y reservas propias | [whatsapp](whatsapp.md) |
| v25 — Inbox de WhatsApp: búsqueda, auto-refresh, pestaña en la reserva, auto-vínculo y fijado | [whatsapp](whatsapp.md) |
| v26 — Entrenar el bot desde el Playground + fix de fechas y cotización temprana | [whatsapp](whatsapp.md) |
| v27 — Estados de triage del inbox de WhatsApp: "A confirmar" y "A recuperar" | [whatsapp](whatsapp.md) |
| v28 — Estado "Transferido" + panel "Estados" explicativo y configurable | [whatsapp](whatsapp.md) |
| v29 — Caja: cuentas corrientes unificadas (Proveedores/Asociados), Billetera y moneda ARS/USD | [caja-cuentas](caja-cuentas.md) |
| v30 — Calendario: ventana de 90 días asimétrica, modo mes, apodo y temporadas | [calendario](calendario.md) |
| v31 — Vehículos: apodo, camionetas y ficha en pestañas + GPS | [vehiculos](vehiculos.md) |
| v32 — Precios de la competencia | [vehiculos](vehiculos.md) |
| v33 — Ajustes de flujo sueltos (service/arreglo, reasignación, orden de reservas, usuarios, sesión) | [reservas](reservas.md) |
| v34 — Fix real de "Borrar un usuario": nombre congelado en toda interacción | [usuarios-auth](usuarios-auth.md) |
| v35 — Links clicables en el chat de WhatsApp | [whatsapp](whatsapp.md) |
| v36 — Garantías separadas de Caja + "Cuentas propias" pasa a "Saldos" con página por cuenta | [caja](caja.md) |
| v37 — MovementRow rediseñado: detalle en modal, menos ruido en la fila | [caja](caja.md) |
| v38 — Ciclo de vida de las garantías: activas → Devolver/Cobrar → historial | [caja](caja.md) |
| v39 — Saldos: cada mes colapsable, el actual abierto | [caja-cuentas](caja-cuentas.md) |
| v41 — Cuentas corrientes y Asociados: tarjeta clickeable → página individual (mismo patrón que Saldos) | [caja-cuentas](caja-cuentas.md) |
| v42 — Reportes: egresos por categoría (torta) | [reportes](reportes.md) |
| v43 — Valor de referencia del USD, traspasos entre cuentas, Caja fuerte unificada y comisiones automáticas | [caja-cuentas](caja-cuentas.md) |
| v44 — Saldos: total del día, tarjetas cuadradas con actividad del mes, ajuste manual de saldo y Caja fuerte como una cuenta más | [caja-cuentas](caja-cuentas.md) |
| v45 — Garantías: "Devolver" acepta un monto parcial, la diferencia queda como ingreso | [caja](caja.md) |
| v46 — Garantías para todos los roles + editar la cuenta de un pago a proveedor/asociado | [caja](caja.md) |
| v47 — Subcuentas agrupadas bajo su cuenta principal (buscador y Configuración) | [caja-cuentas](caja-cuentas.md) |
| v48 — Filtro por cuenta en la página de un proveedor/asociado | [caja-cuentas](caja-cuentas.md) |
| v49 — "Destino" + aclaración ("¿a dónde fue?") del destino en pagos a proveedores/asociados | [caja-cuentas](caja-cuentas.md) |
| v50 — Reportes: % de conversión de WhatsApp | [reportes](reportes.md) |
| v46 — Usuarios observadores y propietario | [usuarios-auth](usuarios-auth.md) |
| v49 — Pagos de la reserva en dólares (con cotización) | [caja](caja.md) |
| v51 — Reportes: ocupación, rentabilidad, extras, reservas y respuesta de WhatsApp | [reportes](reportes.md) |
| v52 — Cuentas corrientes con el formato de Movimientos (fila limpia + modal) | [caja-cuentas](caja-cuentas.md) |
| v53 — Verificación de reservas por un admin | [reservas](reservas.md) |
| v54 — Alerta de pagos pendientes acotada por fecha, cargar pagos en finalizadas y condonar saldo | [caja](caja.md) |
| v55 — Calendario: colores unificados (service y presupuesto) | [calendario](calendario.md) |
| v56 — Configuración → Nube (uso de base de datos y archivos) | [plataforma](plataforma.md) |
| v57 — Km mal cargado: aviso en el wizard + "Excluir de Reportes" | [entrega-devolucion](entrega-devolucion.md) |
| v56 — Limpiar archivos de la nube (descargar, comprimir, eliminar) | [plataforma](plataforma.md) |
| v57 — Paleta de comandos (Ctrl/⌘ + K) | [plataforma](plataforma.md) |
| v58 — Habitaciones (alquiler temporario: Airbnb / Booking / directas) | [habitaciones](habitaciones.md) |
| v59 — Horarios del equipo | [tareas-equipo](tareas-equipo.md) |
| v60 — Tareas recurrentes + fix de doble-click en "Hecha" | [tareas-equipo](tareas-equipo.md) |
| v61 — Fondos de inversión en cuentas propias | [caja-cuentas](caja-cuentas.md) |
| v62 — Tareas: agrupadas por urgencia, buscador y pestañas "Mis tareas"/"Todas" | [tareas-equipo](tareas-equipo.md) |
| v63 — Editar/eliminar movimientos y garantías, abierto a cualquier rol | [caja](caja.md) |
| v64 — Saldos: desglose "En cuenta" / "En fondos" para cuentas con fondos de inversión | [caja-cuentas](caja-cuentas.md) |
| v65 — Fix: no se podía tipear la fecha de vencimiento de licencia en celular | [entrega-devolucion](entrega-devolucion.md) |
| v66 — Firma remota "en vivo": el cliente sigue la entrega/devolución desde el paso 1 y firma sola al completarse | [entrega-devolucion](entrega-devolucion.md) |
| v67 — El cliente completa sus propios datos faltantes desde /sign/[id] | [entrega-devolucion](entrega-devolucion.md) |
| v68 — Fix: espejos de Habitaciones por solapamiento, no por fecha exacta | [habitaciones](habitaciones.md) |
| v69 — Fix: el bloqueo diario de Airbnb por "anticipación mínima" dejaba la habitación marcada como ocupada | [habitaciones](habitaciones.md) |
| v70 — Ajuste de saldo también en cuentas de Asociados/Proveedores | [caja-cuentas](caja-cuentas.md) |
| v71 — Horarios de retiro/devolución: presupuestos + vista "22 días" por default con horarios en la barra | [calendario](calendario.md) |
| v72 — Calendario: una sola vista (90 días), con prioridad horario > nombre en cada barra | [calendario](calendario.md) |
| v73 — Mencionar (@) a un compañero en una nota de reserva genera una tarea | [reservas](reservas.md) |
| v74 — Días especiales (feriados): botón para cargarlos + resaltado amarillo en Horarios y Calendario | [tareas-equipo](tareas-equipo.md) |
| v75 — WhatsApp: adjuntos salientes (fotos/archivos) + emojis en el compositor | [whatsapp](whatsapp.md) |
| v76 — Fixes de v75 reportados por el dueño al probar con la cuenta real | [whatsapp](whatsapp.md) |
| v77 — Vehículos de terceros, unificados con Vehicle/Rental (contratos completos) | [vehiculos](vehiculos.md) |
| v78 — Alta/edición de vehículos abierta a cualquier usuario + borrar presupuestos del Calendario abierto a cualquier usuario | [vehiculos](vehiculos.md) |
| v79 — Caja: "Hay que facturar" en los ingresos + pestaña Facturación + libro de facturas | [caja](caja.md) |
| v80 — Saldos: línea roja "En garantías" en el resumen de cada cuenta | [caja](caja.md) |
| v81 — Calendario: código de lugar (OFI/AER/HOT/OTR) junto al horario de retiro/devolución | [calendario](calendario.md) |
| v82 — Calendario: fila el doble de alta para un alquiler de 1 solo día | [calendario](calendario.md) |
| v83 — Posponer la alerta de service | [vehiculos](vehiculos.md) |
| v84 — Código de cupón de VikRentCar en el detalle de la reserva | [sync-vikrentcar](sync-vikrentcar.md) |
| v85 — Rol "Finanzas" + "Observador" pasa de checkbox a rol + cuentas de Medios de pago restringidas a Finanzas | [usuarios-auth](usuarios-auth.md) |
| v86 — Selector de tema (Automático / Claro / Oscuro) en Perfil | [plataforma](plataforma.md) |
| v87 — Logout automático por inactividad a 10 minutos | [usuarios-auth](usuarios-auth.md) |
| v88 — Notas del service en Mantenimiento + "Info de la reserva" editable | [vehiculos](vehiculos.md) |
| v89 — Habitaciones: cobros en otra moneda que la del total (con cotización) | [habitaciones](habitaciones.md) |
| v90 — Extender alquiler: ofrecer reenviar el acta de entrega | [entrega-devolucion](entrega-devolucion.md) |
| v91 — El propietario no se desconecta por inactividad | [usuarios-auth](usuarios-auth.md) |
| v92 — El bot de WhatsApp cotiza con las temporadas de las fechas pedidas | [whatsapp](whatsapp.md) |
| v92 — Configuración → Contrato (condiciones generales editables, versionadas) | [entrega-devolucion](entrega-devolucion.md) |
| v93 — Permisos (Vehículos → pestaña nueva): registro de contratos/permisos vinculados a una reserva | [vehiculos](vehiculos.md) |
| v94 — Reorganización de la navegación: GPS a Vehículos, Horarios/Accesos a Tareas, Competencia oculta | [plataforma](plataforma.md) |
| v95 — El costo de un mantenimiento va siempre como deuda al proveedor | [caja](caja.md) |
| v96 — Compensación entre cuentas corrientes | [caja-cuentas](caja-cuentas.md) |
| v97 — Agenda del día en el Home + tareas con agenda | [tareas-equipo](tareas-equipo.md) |
| v98 — Fix: las habitaciones desaparecían el día de entrada | [habitaciones](habitaciones.md) |
| v97 — Facturación automática por cuenta + pedidos de clientes + agregar a mano | [caja](caja.md) |
| v99 — Cambios en VikRentCar con la reserva ya entregada: lugar de devolución y aviso de total | [sync-vikrentcar](sync-vikrentcar.md) |
| v100 — Contrato de cesión con el dueño de un auto de tercero | [vehiculos](vehiculos.md) |
| v101 — Presupuestos de 1 día + "Guardar y enviar por WhatsApp" desde el alta | [calendario](calendario.md) |
| v102 — Facturación: vista por mes + tres tarjetas | [caja](caja.md) |
| v103 — Las tareas recurrentes aparecen el día antes de su fecha | [tareas-equipo](tareas-equipo.md) |
| v104 — Cargar movimientos desde la página de una cuenta (Saldos) | [caja-cuentas](caja-cuentas.md) |
| v106 — Métodos de pago de VikRentCar: solo los activos | [sync-vikrentcar](sync-vikrentcar.md) |
| v105 — Cuentas de Finanzas: sin filtraciones + destacadas en Saldos | [caja-cuentas](caja-cuentas.md) |
| v107 — "Ver como…" cualquier rol de rango menor | [usuarios-auth](usuarios-auth.md) |
| v108 — El rol "Observador" pasa a llamarse "Socio" | [usuarios-auth](usuarios-auth.md) |
| v109 — Caja: un empleado ya no ve el total de Ingresos | [caja](caja.md) |
| v107 — Cuentas Bitcoin (saldo en BTC, aparte del disponible) | [caja-cuentas](caja-cuentas.md) |
| v110 — Cotizadores con el precio según la forma de pago (descuentos de VikRentCar) | [calendario](calendario.md) |
| v111 — Calendario: sombra sobre las otras filas al presupuestar | [calendario](calendario.md) |
| v112 — Franquicia distinta para camionetas | [vehiculos](vehiculos.md) |
| v113 — Calendario: alto de fila normalizado (máx. el doble) | [calendario](calendario.md) |
| v114 — Calendario: click en el auto lo resalta + fondo opaco de la etiqueta | [calendario](calendario.md) |
| v115 — Habitaciones: una columna por noche + nombre con la plataforma | [habitaciones](habitaciones.md) |
| v116 — Aviso de sonido de WhatsApp: ruta en vez de Server Action | [whatsapp](whatsapp.md) |
| v117 — Habitaciones: botón "Nueva reserva" arriba, y dos estadías solapadas se pueden cargar | [habitaciones](habitaciones.md) |
| v118 — Devolución tardía: se cobra en la liquidación, contra la hora en que volvió el auto | [entrega-devolucion](entrega-devolucion.md) |
| v116 — Habitaciones: una estadía con datos cargados nunca se oculta como espejo | [habitaciones](habitaciones.md) |
| v119 — Caja: exportar CSV con filtros (cuentas, tipo, categoría) | [caja](caja.md) |
| v117 — Habitaciones: corregir las fechas de una estadía de Airbnb/Booking | [habitaciones](habitaciones.md) |
| v120 — Configuración → Correos: quién recibe qué, destinatarios del informe mensual y envío de actas | [plataforma](plataforma.md) |
| v121 — Caja: un empleado ya no elimina; sus ediciones las aprueba un admin o Finanzas | [caja](caja.md) |
| v122 — Autos de terceros: lugares de retiro/devolución y "Datos de pago y retiro" editables | [vehiculos](vehiculos.md) |
| v123 — Reportes: lo que el cliente le paga directo a una cuenta corriente cuenta también como egreso, con categoría por cuenta | [reportes](reportes.md) |
