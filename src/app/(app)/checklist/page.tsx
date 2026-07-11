import { redirect } from "next/navigation";

/** El checklist se movió a Configuración. Redirige por compatibilidad de enlaces. */
export default function ChecklistPage() {
  redirect("/settings");
}
