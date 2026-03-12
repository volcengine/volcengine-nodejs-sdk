import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const AES_KEY_SIZE = 32;
const AES_NONCE_SIZE = 12;

export interface EncryptInfo {
  version?: string;
  ring_id?: string;
  key_id?: string;
  expire_time: number;
}

const CIPHER_VERSION_AICC_V01 = "AICCv01";

/**
 * Key agreement client using ECIES (P-256 / prime256v1).
 * Ports the Go `KeyAgreementClient` from `pkg/encryption/kaMgr.go`.
 */
export class KeyAgreementClient {
  private serverPublicKey: crypto.KeyObject;

  constructor(pemCert: string) {
    const x509 = new crypto.X509Certificate(pemCert);
    this.serverPublicKey = x509.publicKey;
  }

  /**
   * Generate ephemeral ECIES key pair and derive shared secret.
   * Returns [keyNonce (AES key + nonce), sessionToken (base64)].
   */
  generateECIESKeyPair(): [Buffer, string] {
    // Generate ephemeral EC key pair on prime256v1
    const ecdh = crypto.createECDH("prime256v1");
    ecdh.generateKeys();

    // Get server public key in uncompressed format
    const serverPubKeyDer = this.serverPublicKey.export({
      type: "spki",
      format: "der",
    });
    // Extract raw public key from SPKI DER
    const serverPubKey = extractRawPublicKeyFromSPKI(serverPubKeyDer);

    // Compute shared secret (ECDH)
    const sharedSecret = ecdh.computeSecret(serverPubKey);

    // Derive key material via HKDF (SHA-256, no salt, no info)
    const keyMaterial = hkdfExpand(sharedSecret, AES_KEY_SIZE + AES_NONCE_SIZE);

    // Session token is the uncompressed ephemeral public key, base64-encoded
    const sessionToken = ecdh.getPublicKey("base64");

    return [keyMaterial, sessionToken];
  }
}

/**
 * Extract raw public key bytes from SPKI DER encoding for EC keys.
 * The uncompressed point is at the end of the SPKI structure.
 */
function extractRawPublicKeyFromSPKI(spkiDer: Buffer): Buffer {
  // For P-256 uncompressed, the public key is 65 bytes (0x04 || X || Y)
  // SPKI adds algorithm identifiers at the beginning
  // The bitstring containing the public key is the last part
  // For P-256 SPKI: the raw key starts at byte 26 (total = 91 bytes)
  const uncompressedKeyLen = 65;
  if (spkiDer.length >= uncompressedKeyLen) {
    return spkiDer.subarray(spkiDer.length - uncompressedKeyLen);
  }
  return spkiDer;
}

/**
 * HKDF extract + expand (SHA-256) with no salt and no info.
 * Matches Go's `deriveKeyBasic`.
 *
 * The Go code uses ECDHMarshalBinary which is just the X coordinate of the shared point.
 * However, Node's ECDH.computeSecret already returns the X coordinate by default.
 */
function hkdfExpand(ikm: Buffer, length: number): Buffer {
  // Use Node.js built-in hkdfSync (available since Node 15+)
  const derivedKey = crypto.hkdfSync(
    "sha256",
    ikm,
    Buffer.alloc(0), // no salt → use all-zero salt internally
    Buffer.alloc(0), // no info
    length,
  );
  return Buffer.from(derivedKey);
}

/**
 * AES-256-GCM encryption.
 */
export function aesGcmEncrypt(
  key: Buffer,
  nonce: Buffer,
  plaintext: Buffer,
): Buffer {
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([encrypted, tag]);
}

/**
 * AES-256-GCM decryption.
 */
export function aesGcmDecrypt(
  key: Buffer,
  nonce: Buffer,
  ciphertext: Buffer,
): Buffer {
  const tagLength = 16;
  const encrypted = ciphertext.subarray(0, ciphertext.length - tagLength);
  const tag = ciphertext.subarray(ciphertext.length - tagLength);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}

/**
 * Encrypt plaintext string → base64 ciphertext using AES-GCM.
 */
export function aesGcmEncryptBase64(
  key: Buffer,
  nonce: Buffer,
  plaintext: string,
): string {
  const encrypted = aesGcmEncrypt(key, nonce, Buffer.from(plaintext, "utf-8"));
  return encrypted.toString("base64");
}

/**
 * Decrypt base64 ciphertext → plaintext string using AES-GCM.
 */
export function aesGcmDecryptBase64(
  key: Buffer,
  nonce: Buffer,
  ciphertext: string,
): string {
  const cipherBuf = Buffer.from(ciphertext, "base64");
  const decrypted = aesGcmDecrypt(key, nonce, cipherBuf);
  return decrypted.toString("utf-8");
}

/**
 * Extract ring ID, key ID, and expiry from a PEM certificate.
 * Matches Go's `GetCertInfo`.
 */
export function getCertInfo(
  certPem: string,
): { ringId: string; keyId: string; expireTime: number } {
  try {
    const x509 = new crypto.X509Certificate(certPem);
    const altNames = x509.subjectAltName ?? "";
    // Parse DNS:ring.xxx, DNS:key.yyy from subject alt names
    const dnsNames: string[] = [];
    for (const part of altNames.split(",")) {
      const trimmed = part.trim();
      if (trimmed.startsWith("DNS:")) {
        dnsNames.push(trimmed.substring(4));
      }
    }
    const expireTime = Math.floor(new Date(x509.validTo).getTime() / 1000);
    if (
      dnsNames.length > 1 &&
      dnsNames[0].startsWith("ring.") &&
      dnsNames[1].startsWith("key.")
    ) {
      return {
        ringId: dnsNames[0].substring(5),
        keyId: dnsNames[1].substring(4),
        expireTime,
      };
    }
    return { ringId: "", keyId: "", expireTime };
  } catch {
    return { ringId: "", keyId: "", expireTime: 0 };
  }
}

/**
 * Check if AICC encryption mode is enabled via environment variable.
 */
export function checkIsModeAICC(): boolean {
  return process.env.VOLC_ARK_ENCRYPTION === "AICC";
}

/**
 * Load locally cached certificate for a model.
 * Matches Go's `LoadLocalCertificate`.
 */
export function loadLocalCertificate(model: string): string | null {
  if (!model || /[/\\:..]/.test(model)) return null;
  const dir = path.join(os.homedir(), ".ark", "certificates");
  const certPath = path.join(dir, `${model}.pem`);
  try {
    const stat = fs.statSync(certPath);
    const age = Date.now() - stat.mtimeMs;
    if (age > 14 * 24 * 60 * 60 * 1000) {
      fs.unlinkSync(certPath);
      return null;
    }
    const certPem = fs.readFileSync(certPath, "utf-8");
    const { ringId, keyId } = getCertInfo(certPem);
    const aiccEnabled = checkIsModeAICC();
    if ((ringId === "" || keyId === "") && !aiccEnabled) return certPem;
    if (ringId !== "" && keyId !== "" && aiccEnabled) return certPem;
    fs.unlinkSync(certPath);
    return null;
  } catch {
    return null;
  }
}

/**
 * Save certificate PEM to local cache.
 * Matches Go's `SaveToLocalCertificate`.
 */
export function saveToLocalCertificate(
  model: string,
  certPem: string,
): void {
  if (!model || /[/\\:..]/.test(model)) return;
  const dir = path.join(os.homedir(), ".ark", "certificates");
  fs.mkdirSync(dir, { recursive: true });
  const certPath = path.join(dir, `${model}.pem`);
  fs.writeFileSync(certPath, certPem, "utf-8");
}

/**
 * E2EE client — manages certificate + key agreement + encrypt info.
 * Matches Go's `E2eeClient`.
 */
export class E2eeClient {
  private certificate: string;
  private cipher: KeyAgreementClient;
  private info: EncryptInfo;
  readonly isAICC: boolean;

  constructor(certificate: string) {
    this.certificate = certificate;
    this.cipher = new KeyAgreementClient(certificate);
    const { ringId, keyId, expireTime } = getCertInfo(certificate);
    this.info = { expire_time: expireTime };
    this.isAICC = false;
    if (ringId && keyId) {
      this.info.version = CIPHER_VERSION_AICC_V01;
      this.info.ring_id = ringId;
      this.info.key_id = keyId;
      this.isAICC = true;
    }
  }

  generateECIESKeyPair(): [Buffer, string] {
    return this.cipher.generateECIESKeyPair();
  }

  getEncryptInfo(): string {
    return JSON.stringify(this.info);
  }

  getExpireTime(): number {
    return this.info.expire_time;
  }
}
