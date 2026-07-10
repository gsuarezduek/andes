import Image from "next/image";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-12">
      <header className="flex items-center gap-4">
        <Image src="/icon.svg" alt="Andes" width={56} height={56} className="rounded-xl" priority />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Andes</h1>
          <p className="text-sm text-foreground/60">MDZ Rent a Car</p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <p className="text-base text-foreground/80">
          Sistema interno de entregas y devoluciones de vehículos.
        </p>
        <p className="rounded-lg border border-foreground/10 bg-foreground/[0.03] px-4 py-3 text-sm text-foreground/60">
          Fase 0 — fundaciones en marcha. El inicio de sesión y el flujo de
          entrega llegan en las próximas fases.
        </p>
      </section>
    </main>
  );
}
