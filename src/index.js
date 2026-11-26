// Library API: lock, unlock and re-lock bytes in memory, using the same key
// store as the CLI. For editor integrations such as a VS Code extension.
import { MAGIC, parseEnvelope } from "./format.js";
import { encrypt, decrypt } from "./crypto.js";
import { createKey, saveKey, loadKey, keyIdHex, defaultKeyDir } from "./key-store.js";

// Editors hand over Uint8Array; Node's crypto code wants Buffer. No copy is made.
function toBuffer(data, name) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  throw new TypeError(`${name} must be a Buffer or Uint8Array.`);
}

/** True if the bytes start with the BarongLock signature. */
export function isLocked(data) {
  const buffer = toBuffer(data, "data");
  return buffer.length >= MAGIC.length && buffer.subarray(0, MAGIC.length).equals(MAGIC);
}

/** The Key ID (32 hex chars) a locked file needs. Not secret. */
export function keyIdOf(locked) {
  return keyIdHex(parseEnvelope(toBuffer(locked, "locked")).keyId);
}

/**
 * Locks bytes with a new key and saves the key in the key store.
 * If the caller then fails to store `locked`, it should delete `keyFile`.
 */
export async function lock(plaintext, { keyDir = defaultKeyDir() } = {}) {
  const input = toBuffer(plaintext, "plaintext");
  if (isLocked(input)) throw new Error("Input is already a BarongLock file; refusing to encrypt it again.");
  const key = await createKey();
  const { envelope, keyId } = encrypt(input, key);
  const id = keyIdHex(keyId);
  const keyFile = await saveKey(id, key, keyDir);
  return { locked: envelope, keyId: id, keyFile };
}

/** Unlocks bytes using the matching key from the key store. */
export async function unlock(locked, { keyDir = defaultKeyDir() } = {}) {
  const input = toBuffer(locked, "locked");
  const key = await loadKey(keyIdOf(input), keyDir);
  return decrypt(input, key);
}

/**
 * Locks new contents for an existing locked file, with that file's own key,
 * so everyone who has the key can still open it. Used when an editor saves.
 * The nonce is fresh and random each time; AES-GCM allows billions of
 * encryptions per key that way, far more than any file will be saved.
 */
export async function relock(oldLocked, plaintext, { keyDir = defaultKeyDir() } = {}) {
  const old = toBuffer(oldLocked, "oldLocked");
  const input = toBuffer(plaintext, "plaintext");
  // Guards against an editor bug writing the locked bytes back as plaintext.
  if (isLocked(input)) throw new Error("New contents are already a BarongLock file; refusing to encrypt them again.");
  const { keyId } = parseEnvelope(old);
  const key = await loadKey(keyIdHex(keyId), keyDir);
  decrypt(old, key); // Throws if the key is wrong or the old file was changed.
  return encrypt(input, key, Buffer.from(keyId)).envelope;
}
