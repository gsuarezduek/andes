"use client";

import { useSyncExternalStore } from "react";
import { ToggleButton } from "@/components/ui/toggle-button";
import {
  THEME_STORAGE_KEY,
  parseThemePreference,
  resolveTheme,
  type ThemePreference,
} from "@/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "Automático" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

const CHANGE_EVENT = "andes-theme-change";

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function applyPreference(pref: ThemePreference) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Sin storage (modo privado): igual se aplica en esta pestaña.
  }
  const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  document.documentElement.dataset.theme = resolveTheme(pref, systemDark);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Selector de tema (se guarda en este dispositivo). */
export function ThemeSelector() {
  const pref = useSyncExternalStore(subscribe, readPreference, () => "system" as const);

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((o) => (
          <ToggleButton key={o.value} active={pref === o.value} onClick={() => applyPreference(o.value)}>
            {o.label}
          </ToggleButton>
        ))}
      </div>
      <p className="text-xs text-foreground/50">
        Automático sigue la configuración del dispositivo. Se guarda en este dispositivo.
      </p>
    </div>
  );
}
