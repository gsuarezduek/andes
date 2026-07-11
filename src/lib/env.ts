/**
 * Environment variable access, centralized and typed.
 *
 * Variables are grouped by the phase that introduces them (see
 * PROYECTO-ANDES.md §10). We intentionally do NOT hard-require later-phase
 * variables at boot, so Phase 0/1 can run locally without R2, Resend or the
 * WordPress MySQL credentials configured yet. Each accessor throws only when
 * the value is actually needed and missing.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.length === 0) {
    throw new Error(
      `Missing required environment variable: ${name}. See .env.example.`,
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export const env = {
  /** PostgreSQL connection string (Railway). Required for any DB access. */
  get databaseUrl(): string {
    return required("DATABASE_URL");
  },

  /** Public base URL of the app. Falls back to localhost in development. */
  get appUrl(): string {
    return (
      optional("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000"
    );
  },

  /** Auth.js session secret. Required once authentication lands (Phase 1). */
  get authSecret(): string {
    return required("AUTH_SECRET");
  },

  /** ¿Está configurado el login con Google? (opcional; Auth.js lee estas envs). */
  get hasGoogleAuth(): boolean {
    return Boolean(optional("AUTH_GOOGLE_ID") && optional("AUTH_GOOGLE_SECRET"));
  },

  /** WordPress / VikRentCar read-only MySQL (Phase 5, dev/testing transport). */
  get wpMysql() {
    return {
      host: required("WP_MYSQL_HOST"),
      port: Number(optional("WP_MYSQL_PORT") ?? "3306"),
      database: required("WP_MYSQL_DATABASE"),
      user: required("WP_MYSQL_USER"),
      password: required("WP_MYSQL_PASSWORD"),
    };
  },

  /** Is the direct MySQL transport configured? (dev/testing) */
  get hasWpMysql(): boolean {
    return Boolean(optional("WP_MYSQL_HOST"));
  },

  /** WordPress REST transport via the Andes mu-plugin (Phase 5, production). */
  get wpRest() {
    return {
      url: required("WP_REST_URL"),
      token: required("WP_REST_TOKEN"),
    };
  },

  /** Is the REST transport configured? (preferred in production) */
  get hasWpRest(): boolean {
    return Boolean(optional("WP_REST_URL"));
  },

  /** Shared secret guarding the /api/sync endpoint against the Railway cron. */
  get cronSecret(): string {
    return required("CRON_SECRET");
  },
  get hasCronSecret(): boolean {
    return Boolean(optional("CRON_SECRET"));
  },

  /** Sync window and options (Phase 5). Sensible defaults for the current volume. */
  get sync() {
    return {
      daysBack: Number(optional("SYNC_WINDOW_DAYS_BACK") ?? "2"),
      daysForward: Number(optional("SYNC_WINDOW_DAYS_FORWARD") ?? "60"),
      includeStandby: optional("SYNC_INCLUDE_STANDBY") === "true",
    };
  },

  /** Cloudflare R2 object storage (Phase 2). */
  get r2() {
    return {
      accountId: required("R2_ACCOUNT_ID"),
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
      bucket: optional("R2_BUCKET") ?? "andes-media",
    };
  },

  /** Resend transactional email (Phase 2). */
  get email() {
    return {
      resendApiKey: required("RESEND_API_KEY"),
      from: required("EMAIL_FROM"),
      admin: required("ADMIN_EMAIL"),
    };
  },
} as const;
