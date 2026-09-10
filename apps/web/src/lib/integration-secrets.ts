import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;

/** Derive a 32-byte AES key from env (hex or utf8, hashed when needed). */
export function getIntegrationSecretKey(): Buffer {
  const explicit = process.env.INTEGRATION_SECRET_KEY?.trim();
  if (explicit) {
    if (/^[0-9a-fA-F]{64}$/.test(explicit)) {
      return Buffer.from(explicit, "hex");
    }
    const utf8 = Buffer.from(explicit, "utf8");
    if (utf8.length === 32) return utf8;
    if (utf8.length < 32) {
      const padded = Buffer.alloc(32);
      utf8.copy(padded);
      return padded;
    }
    return createHash("sha256").update(utf8).digest();
  }

  const fallback =
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "prize-local-demo-integration-secret";
  return createHash("sha256").update(fallback, "utf8").digest();
}

export function encryptSecret(plaintext: string): {
  ciphertext: string;
  iv: string;
  authTag: string;
} {
  const key = getIntegrationSecretKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptSecret(
  ciphertext: string,
  iv: string,
  authTag: string
): string {
  const key = getIntegrationSecretKey();
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function maskSecret(plaintext?: string | null): string | null {
  if (plaintext == null || plaintext === "") return null;
  const last4 = plaintext.slice(-4);
  return `••••${last4}`;
}
