import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { KEY_BYTES, KEY_ID_BYTES, NONCE_BYTES, TAG_BYTES, VERSION, makeAad, encodeEnvelope, parseEnvelope } from "./format.js";

// keyId is new and random unless given. Pass the existing one to re-lock a file
// with its own key. The nonce is always fresh and random.
export function encrypt(plaintext, key, keyId = randomBytes(KEY_ID_BYTES)) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) throw new Error("Encryption key must be exactly 32 bytes.");
  if (!Buffer.isBuffer(keyId) || keyId.length !== KEY_ID_BYTES) throw new Error("Key ID must be exactly 16 bytes.");
  const nonce = randomBytes(NONCE_BYTES);
  const aad = makeAad(VERSION, keyId);
  const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: TAG_BYTES });
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { envelope: encodeEnvelope({ version: VERSION, keyId, nonce, tag, ciphertext }), keyId };
}

export function decrypt(envelopeBuffer, key) {
  if (!Buffer.isBuffer(key) || key.length !== KEY_BYTES) throw new Error("Decryption key must be exactly 32 bytes.");
  const parsed = parseEnvelope(envelopeBuffer);
  const decipher = createDecipheriv("aes-256-gcm", key, parsed.nonce, { authTagLength: TAG_BYTES });
  decipher.setAAD(parsed.aad);
  decipher.setAuthTag(parsed.tag);
  // Do not return plaintext until final() verifies the authentication tag.
  const first = decipher.update(parsed.ciphertext);
  const last = decipher.final();
  return Buffer.concat([first, last]);
}
