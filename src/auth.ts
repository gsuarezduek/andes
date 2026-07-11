import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user || !user.active) return null;

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
    // App interna: Google solo autentica; el alta la sigue haciendo el admin.
    // `allowDangerousEmailAccountLinking` no aplica (sin adapter/JWT); la
    // vinculación real la hace el callback `signIn` contra nuestra tabla.
    Google,
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Google no da de alta usuarios: solo entra quien ya existe y está activo
    // en `users` (dado de alta por el admin). Así se preserva el modelo de
    // roles y ningún Gmail cualquiera puede iniciar sesión.
    async signIn({ user, account }) {
      if (account?.provider !== "google") return true; // credentials → authorize
      const email = user.email?.toLowerCase();
      if (!email) return false;
      const dbUser = await prisma.user.findUnique({ where: { email } });
      return Boolean(dbUser && dbUser.active);
    },
    // Con Google el `user` viene del perfil de OAuth (sin id/role nuestros):
    // los resolvemos desde la base al momento del sign-in. Con credentials el
    // `user` ya trae id/role desde `authorize`.
    async jwt({ token, user, account }) {
      if (account?.provider === "google" && user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: user.email.toLowerCase() },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.role = dbUser.role;
          token.name = dbUser.name;
          token.email = dbUser.email;
        }
        return token;
      }
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
  },
});
