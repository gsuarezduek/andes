import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// El proxy (ex-middleware) corre en el edge: usa solo authConfig (sin Prisma/bcrypt).
export default NextAuth(authConfig).auth;

export const config = {
  // Protege todo menos assets estáticos, el endpoint de auth y archivos PWA.
  matcher: [
    // `api/sync` se excluye del proxy: lo llama el cron sin sesión y se
    // autentica con CRON_SECRET dentro del route handler.
    // `sign` / `api/sign` también se excluyen: el cliente firma en su propio
    // teléfono, sin sesión; se validan por el id no adivinable + expiración +
    // un solo uso dentro de cada handler (firma remota, Fase 10).
    // `forgot-password` / `reset-password` también son públicas por
    // definición (recuperar contraseña sin sesión); se validan por token
    // no adivinable + expiración + un solo uso (mismo criterio que la firma).
    "/((?!api/auth|api/sync|sign|api/sign|forgot-password|reset-password|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)",
  ],
};
