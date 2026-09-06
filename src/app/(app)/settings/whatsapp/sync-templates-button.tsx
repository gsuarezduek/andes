"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { syncTemplates } from "./actions";

export function SyncTemplatesButton() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  const run = () =>
    start(async () => {
      const result = await syncTemplates();
      setMessage("error" in result ? result.error : `Sincronizado: ${result.count} plantilla(s).`);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      <Button type="button" variant="secondary" onClick={run} disabled={pending} className="self-start">
        {pending ? "Sincronizando…" : "Sincronizar plantillas ahora"}
      </Button>
      {message ? <p className="text-sm text-foreground/60">{message}</p> : null}
    </div>
  );
}
