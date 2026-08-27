import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// El proxy (ex-middleware) corre en el edge: usa solo authConfig (sin Prisma/bcrypt).
export default NextAuth(authConfig).auth;

export const config = {
  // Protege todo menos assets estáticos, el endpoint de auth y archivos PWA.
  matcher: [
    // `api/sync`, `api/daily-summary` y `api/competitor-prices` se excluyen
    // del proxy: los llama el cron sin sesión y se autentican con
    // CRON_SECRET dentro del route handler.
    // `sign` / `api/sign` también se excluyen: el cliente firma en su propio
    // teléfono, sin sesión; se validan por el id no adivinable + expiración +
    // un solo uso dentro de cada handler (firma remota, Fase 10).
    // `forgot-password` / `reset-password` también son públicas por
    // definición (recuperar contraseña sin sesión); se validan por token
    // no adivinable + expiración + un solo uso (mismo criterio que la firma).
    "/((?!api/auth|api/sync|api/daily-summary|api/competitor-prices|sign|api/sign|forgot-password|reset-password|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)",
  ],
};
