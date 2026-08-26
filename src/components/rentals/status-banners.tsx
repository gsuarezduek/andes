export function StatusBanners({
  entrega,
  devolucion,
  fusion,
  service,
}: {
  entrega?: string;
  devolucion?: string;
  fusion?: string;
  service?: string;
}) {
  return (
    <>
      {entrega === "ok" && (
        <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Entrega registrada. El acta y los emails se están generando.
        </p>
      )}
      {devolucion === "ok" && (
        <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Devolución registrada. El alquiler quedó finalizado; el acta y los emails se están generando.
        </p>
      )}
      {fusion === "ok" && (
        <p className="rounded-lg bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          Reserva fusionada: la orden de VikRentCar quedó vinculada acá y el duplicado se canceló.
        </p>
      )}
      {service === "opened" && (
        <p className="rounded-lg bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-700 dark:text-blue-400">
          Auto marcado fuera de servicio. Volvé a esta reserva para ponerlo de vuelta en servicio
          cuando esté listo.
        </p>
      )}
    </>
  );
}
