"use client";

import { useState, type ReactNode } from "react";
import { TabBar } from "@/components/ui/tabs";

const SECTIONS = ["Personalidad", "Políticas", "Seguridad", "Estados", "Ejemplos", "Documentos", "Calidad", "Probar"];

export function BotSettingsTabs({
  personality,
  policies,
  security,
  states,
  examples,
  documents,
  quality,
  playground,
}: {
  personality: ReactNode;
  policies: ReactNode;
  security: ReactNode;
  states: ReactNode;
  examples: ReactNode;
  documents: ReactNode;
  quality: ReactNode;
  playground: ReactNode;
}) {
  const [active, setActive] = useState(0);
  const panels = [personality, policies, security, states, examples, documents, quality, playground];

  return (
    <div className="flex flex-col gap-5">
      <TabBar sections={SECTIONS} active={active} onChange={setActive} />
      {panels[active]}
    </div>
  );
}
