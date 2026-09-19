"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { generateAndSendActa } from "@/lib/acta";

/**
 * Reenvío manual del acta (regenera el PDF y vuelve a mandar los emails).
 * Cualquier empleado puede usarlo — es operacional, como el botón de sync —
 * típicamente después de ver en el detalle del alquiler que el envío al
 * cliente falló u omitió, para corregir el dato (email) y reintentar, o para
 * confirmar que ya se resolvió y avisarle al cliente por otro medio.
 */
export async function resendActaEmail(
  rentalId: string,
  inspectionId: string,
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  try {
    await generateAndSendActa(inspectionId);
  } catch (e) {
    console.error(`[acta] reenvío manual falló (inspection ${inspectionId})`, e);
    return { ok: false, error: "No se pudo generar/enviar el acta. Probá de nuevo en un momento." };
  }
  revalidatePath(`/rentals/${rentalId}`);
  return { ok: true };
}
