export const MAGIC = Buffer.from("BARONGLOCK", "ascii"); // 10 bytes
export const VERSION = 1;
export const KEY_BYTES = 32;
export const KEY_ID_BYTES = 16;
export const NONCE_BYTES = 12;
export const TAG_BYTES = 16;
export const HEADER_BYTES = MAGIC.length + 1 + KEY_ID_BYTES + NONCE_BYTES + TAG_BYTES;

export function makeAad(version, keyId) {
  return Buffer.concat([MAGIC, Buffer.from([version]), keyId]);
}

export function parseEnvelope(buffer) {
  if (buffer.length < HEADER_BYTES) throw new Error("Truncated BarongLock file.");
  if (!buffer.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Not a BarongLock file (magic signature not found).");
  }
  const version = buffer[MAGIC.length];
  if (version !== VERSION) throw new Error(`Unsupported BarongLock version: ${version}.`);
  let offset = MAGIC.length + 1;
  const keyId = buffer.subarray(offset, offset + KEY_ID_BYTES); offset += KEY_ID_BYTES;
  const nonce = buffer.subarray(offset, offset + NONCE_BYTES); offset += NONCE_BYTES;
  const tag = buffer.subarray(offset, offset + TAG_BYTES); offset += TAG_BYTES;
  const ciphertext = buffer.subarray(offset);
  return { version, keyId, nonce, tag, ciphertext, aad: makeAad(version, keyId) };
}

export function encodeEnvelope({ version = VERSION, keyId, nonce, tag, ciphertext }) {
  if (keyId.length !== KEY_ID_BYTES) throw new Error("Invalid key ID length.");
  if (nonce.length !== NONCE_BYTES) throw new Error("Invalid nonce length.");
  if (tag.length !== TAG_BYTES) throw new Error("Invalid authentication tag length.");
  return Buffer.concat([MAGIC, Buffer.from([version]), keyId, nonce, tag, ciphertext]);
}
