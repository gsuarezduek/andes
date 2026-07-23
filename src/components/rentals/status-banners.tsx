export function StatusBanners({ entrega, devolucion }: { entrega?: string; devolucion?: string }) {
  return (
    <>
      {entrega === "ok" && (
        <p className="rounded-lg bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">
          Entrega registrada. El acta y los emails se están generando.
        </p>
      )}
      {devolucion === "ok" && (
        <p className="rounded-lg bg-green-500/10 px-4 py-3 text-sm font-medium text-green-700 dark:text-green-400">
          Devolución registrada. El alquiler quedó finalizado; el acta y los emails se están generando.
        </p>
      )}
    </>
  );
}
