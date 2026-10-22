import type { UserRole } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Extiende los tipos de Auth.js con nuestros campos (id, role, owner).
declare module "next-auth" {
  interface User {
    role: UserRole;
    owner: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      owner: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    owner: boolean;
    /** Última request (ms) — corte por inactividad, ver `session-idle.ts`. */
    lastSeen?: number;
  }
}
