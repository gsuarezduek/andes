import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Extiende los tipos de Auth.js con nuestros campos (id, role).
declare module "next-auth" {
  interface User {
    role: UserRole;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
  }
}
