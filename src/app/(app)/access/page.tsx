import type { Metadata } from "next";
import { requireUser } from "@/lib/auth-helpers";
import { listAccessCredentials, canRevealAccessCredential } from "@/lib/access-credentials";
import { SectionHeading } from "@/components/ui/section-heading";
import { AccessCredentialForm } from "@/components/access/access-credential-form";
import { AccessCredentialRow } from "@/components/access/access-credential-row";

export const metadata: Metadata = { title: "Accesos — Andes" };

export default async function AccessPage() {
  const user = await requireUser();
  const credentials = await listAccessCredentials();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accesos</h1>
        <p className="text-sm text-foreground/60">
          Usuario y contraseña de los sitios y servicios que usa el equipo. Cualquiera puede cargar,
          editar o borrar un acceso; &quot;Solo admin&quot; restringe quién puede ver la contraseña o el
          extra de ese acceso puntual.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading>Cargar nuevo acceso</SectionHeading>
        <AccessCredentialForm />
      </section>

      <section className="flex flex-col gap-3">
        <SectionHeading>{credentials.length} accesos</SectionHeading>
        {credentials.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {credentials.map((c) => (
              <AccessCredentialRow key={c.id} credential={c} canReveal={canRevealAccessCredential(c.adminOnly, user.role)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/50">Todavía no hay accesos cargados.</p>
        )}
      </section>
    </div>
  );
}
