import { Button } from "@/components/ui/button";
import type { StepContext } from "./context";

/**
 * QR de firma remota: "early" se muestra en el paso "Datos" (punto de entrada
 * principal — el cliente escanea apenas arranca y sigue el resto en vivo);
 * "firma" se muestra en el paso "Firma" (estado/fallback si por algún motivo
 * no se generó antes). Comparten el mismo estado (`ctx.remote`/`remoteStatus`),
 * que vive en `InspectionWizard`, no en el paso — por eso el QR sigue andando
 * aunque el empleado navegue a otro paso.
 */
export function RemoteSignaturePanel({ ctx, variant }: { ctx: StepContext; variant: "early" | "firma" }) {
  const { props, remote, remoteStatus, remoteBusy, startRemoteSign, cancelRemote } = ctx;
  if (!props.createRemoteSignature) return null;
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-foreground/10 p-3">
      <p className="text-xs font-medium text-foreground/70">
        {variant === "early"
          ? "¿El cliente quiere seguir el proceso y firmar desde su teléfono?"
          : "¿El cliente prefiere firmar en su teléfono?"}
      </p>
      {remoteStatus === "signed" ? (
        <p className="text-sm font-medium text-emerald-600">Firma del cliente recibida ✓</p>
      ) : !remote ? (
        <Button type="button" variant="secondary" onClick={startRemoteSign} disabled={remoteBusy}>
          {remoteBusy ? "Generando…" : "Generar QR para el cliente"}
        </Button>
      ) : (
        <div className="flex flex-col items-center gap-2">
          {/* SVG del QR generado en el servidor */}
          <div className="h-44 w-44 [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: remote.svg }} />
          <p className="text-center text-xs text-foreground/60">
            {remoteStatus === "error"
              ? "El pedido venció. Generá uno nuevo."
              : variant === "early"
                ? "El cliente escanea este QR y va viendo en vivo los datos de la entrega/devolución. Va a poder firmar ahí mismo apenas esté todo listo."
                : "El cliente escanea este QR y firma en su teléfono. Esperando la firma…"}
          </p>
          <button type="button" className="text-xs text-foreground/60 underline" onClick={cancelRemote}>
            {remoteStatus === "error" ? "Cerrar" : "Cancelar"}
          </button>
        </div>
      )}
    </div>
  );
}
