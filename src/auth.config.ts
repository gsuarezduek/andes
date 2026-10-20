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
    // Cierre de sesión por inactividad (10 minutos): el proxy corre `auth()` en
    // cada request protegida y renueva la cookie mientras haya actividad
    // (rolling session); sin requests durante 10 minutos, el JWT expira solo.
    // Es el backstop server-side; el logout activo por inactividad real
    // (sin requests, ej. tab abierta sin tocar nada) vive en
    // `inactivity-logout.tsx`, montado en el layout autenticado — debe
    // quedar con el mismo límite que acá, si no el backstop puede cortar la
    // sesión antes de que el aviso del cliente llegue a mostrarse.
    maxAge: 10 * 60,
    // Renovar como mucho cada minuto: el JWT puede vencer hasta `updateAge`
    // antes de lo que marca la última request, y con 10 min de límite eso
    // tiene que quedar por debajo del aviso de 60s del cliente.
    updateAge: 60,
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
      return token;
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
