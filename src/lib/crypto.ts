import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // Recommended length for GCM
const AUTH_TAG_LENGTH = 16;

let cachedKey: Buffer | null = null;

function getKey(): Buffer {
  if (cachedKey) return cachedKey;

  const keyBase64 = process.env.SECRET_VAULT_KEY;
  if (!keyBase64) {
    throw new Error("SECRET_VAULT_KEY is not set");
  }

  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error(
      "SECRET_VAULT_KEY must be a 32-byte key encoded in base64 (256-bit)"
    );
  }

  cachedKey = key;
  return key;
}

export function encryptSecret(plaintext: string): { ciphertext: string; iv: string } {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Store ciphertext + auth tag together as base64
  const payload = Buffer.concat([encrypted, authTag]).toString("base64");

  return {
    ciphertext: payload,
    iv: iv.toString("base64"),
  };
}

export function decryptSecret(ciphertext: string, iv: string): string {
  const key = getKey();
  const ivBuf = Buffer.from(iv, "base64");
  const payload = Buffer.from(ciphertext, "base64");

  if (ivBuf.length !== IV_LENGTH) {
    throw new Error("Invalid IV length");
  }
  if (payload.length <= AUTH_TAG_LENGTH) {
    throw new Error("Invalid ciphertext payload");
  }

  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const encrypted = payload.subarray(0, payload.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, ivBuf);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}
