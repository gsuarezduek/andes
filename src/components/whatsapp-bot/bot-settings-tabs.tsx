"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

const SECTIONS = ["Personalidad", "Seguridad", "Ejemplos", "Documentos", "Calidad", "Probar"];

export function BotSettingsTabs({
  personality,
  security,
  examples,
  documents,
  quality,
  playground,
}: {
  personality: ReactNode;
  security: ReactNode;
  examples: ReactNode;
  documents: ReactNode;
  quality: ReactNode;
  playground: ReactNode;
}) {
  const [active, setActive] = useState(0);
  const panels = [personality, security, examples, documents, quality, playground];

  return (
    <div className="flex flex-col gap-5">
      <TabBar sections={SECTIONS} active={active} onChange={setActive} />
      {panels[active]}
    </div>
  );
}
