import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";

/**
 * Configuración edge-safe de Auth.js (sin Prisma ni bcrypt).
 * La usa el middleware para proteger rutas y también `auth.ts`, que le agrega
 * el provider de credenciales (que sí necesita Node).
 */
export const authConfig = {
  trustHost: true, // Railway (no Vercel): confiar en el host de la request.
  pages: {
    signIn: "/login",
    // Los errores de OAuth (p. ej. Google rechazado por `signIn`) vuelven acá
    // con ?error=..., en vez de la página de error por defecto de Auth.js.
    error: "/login",
  },
  session: {
    strategy: "jwt",
  },
  callbacks: {
    // Protege toda la app; deja pasar /login. Redirige al home si ya hay sesión.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname === "/login";

      if (isOnLogin) {
        if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
        return true;
      }
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  providers: [], // se completan en auth.ts
} satisfies NextAuthConfig;
