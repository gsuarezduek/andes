import type { LoginDevice } from "@prisma/client";

const MOBILE_UA_PATTERN = /Mobi|Android|iPhone|iPad|iPod/i;

/** Heurística simple pc/celular a partir del header User-Agent del login. */
export function detectLoginDevice(userAgent: string | null | undefined): LoginDevice {
  return userAgent && MOBILE_UA_PATTERN.test(userAgent) ? "mobile" : "pc";
}
