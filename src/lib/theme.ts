// Tema de la UI (claro / oscuro / automático). La preferencia vive en el
// dispositivo (localStorage), no en la base: es una comodidad de pantalla, y
// así se aplica antes de pintar sin esperar la sesión.
//
// El tema efectivo se escribe como `data-theme="light|dark"` en <html>; los
// colores de globals.css y la variante `dark:` de Tailwind dependen de ese
// atributo, nunca directo de `prefers-color-scheme`.

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "andes-theme";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(pref: ThemePreference, systemDark: boolean): ResolvedTheme {
  if (pref === "system") return systemDark ? "dark" : "light";
  return pref;
}

/**
 * Script inline para el <head>: fija `data-theme` antes del primer pintado
 * (evita el parpadeo claro→oscuro) y, en modo automático, sigue los cambios
 * del sistema. Debe mantenerse equivalente a `resolveTheme`.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var m=window.matchMedia("(prefers-color-scheme: dark)");var a=function(){var p=null;try{p=localStorage.getItem(k)}catch(e){}var d=p==="dark"||(p!=="light"&&m.matches);document.documentElement.dataset.theme=d?"dark":"light"};a();m.addEventListener("change",a)}catch(e){document.documentElement.dataset.theme="light"}})();`;
