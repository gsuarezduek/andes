/**
 * i18n configuration for Andes.
 *
 * The employee-facing UI is always in Spanish (Argentina). Client-facing
 * content (signature screen, inspection PDF, emails) is bilingual and driven
 * per-rental by `rentals.language`, preselected from the VikRentCar order
 * `lang` field. See PROYECTO-ANDES.md §7 (Idiomas).
 *
 * Every client-facing string lives in a dictionary from day 1 — never
 * hardcoded — so English can later be extended to the whole app.
 */

export const locales = ["es", "en"] as const;

export type Locale = (typeof locales)[number];

/** Default language for every client-facing artifact unless a rental overrides it. */
export const defaultLocale: Locale = "es";

/** Type guard to validate arbitrary input (e.g. VikRentCar `lang`) into a Locale. */
export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (locales as readonly string[]).includes(value);
}

/**
 * Normalizes a raw language hint (VikRentCar order `lang`, browser header, etc.)
 * into a supported Locale, falling back to the default. Accepts values like
 * "en-US", "es_AR", "English", by looking at the leading two letters.
 */
export function resolveLocale(raw: unknown): Locale {
  if (isLocale(raw)) return raw;
  if (typeof raw === "string") {
    const head = raw.trim().toLowerCase().slice(0, 2);
    if (isLocale(head)) return head;
  }
  return defaultLocale;
}
