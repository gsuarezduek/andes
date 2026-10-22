import type { NextAuthConfig } from "next-auth";
import type { UserRole } from "@prisma/client";
import { applyIdleTimeout, SESSION_MAX_AGE_S } from "@/lib/session-idle";

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
    // Vencimiento largo para todos (se renueva en cada request): Auth.js no
    // admite un `maxAge` por usuario. El corte por inactividad de 10 min
    // (todos menos el propietario, que queda conectado indefinidamente) lo
    // aplica `applyIdleTimeout` en el callback `jwt` — ver `session-idle.ts`.
    // El aviso "¿Seguís ahí?" del cliente (`inactivity-logout.tsx`) usa el
    // mismo `IDLE_TIMEOUT_MS`.
    maxAge: SESSION_MAX_AGE_S,
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
        token.owner = user.owner;
      }
      return applyIdleTimeout(token, Date.now());
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
        session.user.owner = token.owner as boolean;
      }
      return session;
    },
  },
  providers: [], // se completan en auth.ts
} satisfies NextAuthConfig;
