// Library API: lock, unlock and re-lock bytes in memory, using the same key
// store as the CLI, or a password. For editor integrations such as a VS Code extension.
import { MAGIC, PASSWORD_VERSION, VERSION, parseEnvelope, passwordPrefix } from "./format.js";
import { encrypt, decrypt, seal } from "./crypto.js";
import { createKey, saveKey, loadKey, keyIdHex, defaultKeyDir } from "./key-store.js";
import { SCRYPT_DEFAULTS, MIN_PASSWORD_LENGTH, checkNewPassword, deriveKey, newSalt } from "./password.js";

export { MIN_PASSWORD_LENGTH };

// Editors hand over Uint8Array; Node's crypto code wants Buffer. No copy is made.
function toBuffer(data, name) {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof Uint8Array) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  throw new TypeError(`${name} must be a Buffer or Uint8Array.`);
}

function codedError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

/** True if the bytes start with the BarongLock signature. */
export function isLocked(data) {
  const buffer = toBuffer(data, "data");
  return buffer.length >= MAGIC.length && buffer.subarray(0, MAGIC.length).equals(MAGIC);
}

/** True if the locked file opens with a password rather than a stored key. */
export function usesPassword(locked) {
  return parseEnvelope(toBuffer(locked, "locked")).version === PASSWORD_VERSION;
}

/** The Key ID (32 hex chars) a locked file needs, or null for a password file. Not secret. */
export function keyIdOf(locked) {
  const parsed = parseEnvelope(toBuffer(locked, "locked"));
  return parsed.version === VERSION ? keyIdHex(parsed.keyId) : null;
}

/**
 * Locks bytes. With `password`, the key is made from it and nothing is saved.
 * Otherwise a new key is made and saved in the key store; if the caller then
 * fails to store `locked`, it should delete `keyFile`.
 */
export async function lock(plaintext, { keyDir = defaultKeyDir(), password } = {}) {
  const input = toBuffer(plaintext, "plaintext");
  if (isLocked(input)) throw new Error("Input is already a BarongLock file; refusing to encrypt it again.");
  if (password !== undefined) {
    checkNewPassword(password);
    const salt = newSalt();
    const key = await deriveKey(password, salt, SCRYPT_DEFAULTS);
    return { locked: seal(input, key, passwordPrefix(salt, SCRYPT_DEFAULTS)), keyId: null, keyFile: null };
  }
  const key = await createKey();
  const { envelope, keyId } = encrypt(input, key);
  const id = keyIdHex(keyId);
  const keyFile = await saveKey(id, key, keyDir);
  return { locked: envelope, keyId: id, keyFile };
}

// The key for a parsed file: from the password, or from the key store.
async function keyFor(parsed, { keyDir = defaultKeyDir(), password } = {}) {
  if (parsed.version === PASSWORD_VERSION) {
    if (!password) throw codedError("This file is locked with a password.", "BARONGLOCK_PASSWORD_REQUIRED");
    return deriveKey(password, parsed.salt, parsed.scrypt);
  }
  return loadKey(keyIdHex(parsed.keyId), keyDir);
}

// For a password file, a failed check almost always means a wrong password.
function open(input, parsed, key) {
  try {
    return decrypt(input, key);
  } catch (error) {
    if (parsed.version === PASSWORD_VERSION) {
      throw codedError("Wrong password, or the file was changed.", "BARONGLOCK_WRONG_PASSWORD");
    }
    throw error;
  }
}

/** Unlocks bytes, with the key from the key store or, for a password file, `password`. */
export async function unlock(locked, options = {}) {
  const input = toBuffer(locked, "locked");
  const parsed = parseEnvelope(input);
  return open(input, parsed, await keyFor(parsed, options));
}

/**
 * Locks new contents for an existing locked file the same way it was locked
 * (same key, or same password and salt), so everyone who could open it still
 * can. Used when an editor saves. The nonce is fresh and random each time;
 * AES-GCM allows billions of encryptions per key that way.
 */
export async function relock(oldLocked, plaintext, options = {}) {
  const old = toBuffer(oldLocked, "oldLocked");
  const input = toBuffer(plaintext, "plaintext");
  // Guards against an editor bug writing the locked bytes back as plaintext.
  if (isLocked(input)) throw new Error("New contents are already a BarongLock file; refusing to encrypt them again.");
  const parsed = parseEnvelope(old);
  const key = await keyFor(parsed, options);
  open(old, parsed, key); // Throws if the key or password is wrong, or the old file was changed.
  return seal(input, key, Buffer.from(parsed.prefix));
}
