import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// El proxy (ex-middleware) corre en el edge: usa solo authConfig (sin Prisma/bcrypt).
export default NextAuth(authConfig).auth;

export const config = {
  // Protege todo menos assets estáticos, el endpoint de auth y archivos PWA.
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)",
  ],
};
