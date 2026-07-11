import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// El proxy (ex-middleware) corre en el edge: usa solo authConfig (sin Prisma/bcrypt).
export default NextAuth(authConfig).auth;

export const config = {
  // Protege todo menos assets estáticos, el endpoint de auth y archivos PWA.
  matcher: [
    // `api/sync` se excluye del proxy: lo llama el cron sin sesión y se
    // autentica con CRON_SECRET dentro del route handler.
    "/((?!api/auth|api/sync|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)",
  ],
};
