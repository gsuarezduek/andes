/**
 * Cifrado simétrico (AES-256-GCM) para credenciales que hay que poder leer de
 * vuelta — a diferencia de `password-reset.ts`/`remote-signature.ts`, que
 * hashean tokens de un solo uso, acá necesitamos el valor real para llamar a
 * la API de Chakra. Formato de salida: "iv:tag:ciphertext" en hex.
 */

import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";

function loadKey(): Buffer {
  const key = Buffer.from(env.encryptionKey, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe ser hex de 64 caracteres (32 bytes).");
  }
  return key;
}

export function encrypt(plainText: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, loadKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext.toString("hex")}`;
}

export function decrypt(value: string): string {
  const parts = value.split(":");
  if (parts.length !== 3) throw new Error("Valor cifrado con formato inválido.");
  const [ivHex, tagHex, dataHex] = parts;
  const decipher = createDecipheriv(ALGORITHM, loadKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return plain.toString("utf8");
}
