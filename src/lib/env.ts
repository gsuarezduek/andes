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

  /** WordPress / VikRentCar read-only MySQL (Phase 5). */
  get wpMysql() {
    return {
      host: required("WP_MYSQL_HOST"),
      port: Number(optional("WP_MYSQL_PORT") ?? "3306"),
      database: required("WP_MYSQL_DATABASE"),
      user: required("WP_MYSQL_USER"),
      password: required("WP_MYSQL_PASSWORD"),
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
