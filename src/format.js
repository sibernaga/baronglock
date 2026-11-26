export const MAGIC = Buffer.from("BARONGLOCK", "ascii"); // 10 bytes
export const VERSION = 1;          // Key from the key store, found by its key ID.
export const PASSWORD_VERSION = 2; // Key made from a password with scrypt.
export const KEY_BYTES = 32;
export const KEY_ID_BYTES = 16;
export const SALT_BYTES = 16;
export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;
export const KDF_SCRYPT = 1;
// The prefix is the header before the nonce. It is the AAD: changing any of
// it (key ID, password settings, salt) makes decryption fail.
const KEY_PREFIX_BYTES = MAGIC.length + 1 + KEY_ID_BYTES;                // 27
const PASSWORD_PREFIX_BYTES = MAGIC.length + 1 + 1 + 3 + SALT_BYTES;     // 31
export const HEADER_BYTES = KEY_PREFIX_BYTES + NONCE_BYTES + TAG_BYTES;  // 55, version 1

export function makeAad(version, keyId) {
  return Buffer.concat([MAGIC, Buffer.from([version]), keyId]);
}
export function keyPrefix(keyId) {
  if (keyId.length !== KEY_ID_BYTES) throw new Error("Invalid key ID length.");
  return makeAad(VERSION, keyId);
}
export function passwordPrefix(salt, { log2N, r, p }) {
  if (salt.length !== SALT_BYTES) throw new Error("Invalid salt length.");
  return Buffer.concat([MAGIC, Buffer.from([PASSWORD_VERSION, KDF_SCRYPT, log2N, r, p]), salt]);
}

export function parseEnvelope(buffer) {
  if (buffer.length < MAGIC.length + 1) throw new Error("Truncated BarongLock file.");
  if (!buffer.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Not a BarongLock file (magic signature not found).");
  }
  const version = buffer[MAGIC.length];
  let prefixBytes;
  const details = {};
  if (version === VERSION) {
    prefixBytes = KEY_PREFIX_BYTES;
  } else if (version === PASSWORD_VERSION) {
    prefixBytes = PASSWORD_PREFIX_BYTES;
  } else {
    throw new Error(`Unsupported BarongLock version: ${version}. A newer BarongLock may open it.`);
  }
  if (buffer.length < prefixBytes + NONCE_BYTES + TAG_BYTES) throw new Error("Truncated BarongLock file.");
  let offset = MAGIC.length + 1;
  if (version === VERSION) {
    details.keyId = buffer.subarray(offset, offset + KEY_ID_BYTES);
  } else {
    const kdf = buffer[offset];
    if (kdf !== KDF_SCRYPT) throw new Error(`Unsupported password method in this file: ${kdf}.`);
    details.scrypt = { log2N: buffer[offset + 1], r: buffer[offset + 2], p: buffer[offset + 3] };
    details.salt = buffer.subarray(offset + 4, offset + 4 + SALT_BYTES);
  }
  offset = prefixBytes;
  const prefix = buffer.subarray(0, prefixBytes);
  const nonce = buffer.subarray(offset, offset + NONCE_BYTES); offset += NONCE_BYTES;
  const tag = buffer.subarray(offset, offset + TAG_BYTES); offset += TAG_BYTES;
  const ciphertext = buffer.subarray(offset);
  return { version, ...details, prefix, nonce, tag, ciphertext, aad: prefix };
}

export function encodeEnvelope({ prefix, nonce, tag, ciphertext }) {
  if (nonce.length !== NONCE_BYTES) throw new Error("Invalid nonce length.");
  if (tag.length !== TAG_BYTES) throw new Error("Invalid authentication tag length.");
  return Buffer.concat([prefix, nonce, tag, ciphertext]);
}
