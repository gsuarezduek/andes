/**
 * Tarjeta imprimible con el QR de un vehículo. El SVG llega ya generado
 * (server-side) como string. Pensada para pegar en el auto.
 */
export function QrCard({
  svg,
  title,
  subtitle,
  hint = "Escaneá para iniciar entrega o devolución",
}: {
  svg: string;
  title: string;
  subtitle: string;
  hint?: string;
}) {
  return (
    <div className="qr-sheet flex flex-col items-center gap-2 rounded-xl border border-foreground/15 p-5 text-center">
      <div className="h-44 w-44 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-lg font-bold leading-tight">{title}</p>
      <p className="text-sm text-foreground/70">{subtitle}</p>
      <p className="mt-1 text-xs text-foreground/50">{hint}</p>
    </div>
  );
}
