// Turns a password into a 32-byte key with scrypt.
import { scrypt as scryptCallback, randomBytes } from "node:crypto";
import { promisify } from "node:util";
import { KEY_BYTES, SALT_BYTES } from "./format.js";

const scrypt = promisify(scryptCallback);

// For new files: N = 2^17, r = 8, p = 1. That needs about 128 MiB of memory
// and a fraction of a second per try, so guessing passwords is slow.
export const SCRYPT_DEFAULTS = Object.freeze({ log2N: 17, r: 8, p: 1 });
export const MIN_PASSWORD_LENGTH = 8;
// The settings come from the file, so a crafted file could ask for huge
// amounts of memory or time. Refuse anything far beyond the defaults.
const MAX_MEMORY = 1024 * 1024 * 1024;
const MAX_P = 4;

export function newSalt() {
  return randomBytes(SALT_BYTES);
}

// The same password typed on different systems can arrive in different
// Unicode forms (é as one character, or e plus an accent). NFC makes them equal.
const normalize = (password) => password.normalize("NFC");

export function checkNewPassword(password) {
  if (typeof password !== "string") throw new TypeError("Password must be a string.");
  if ([...normalize(password)].length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
}

export async function deriveKey(password, salt, { log2N, r, p }) {
  if (typeof password !== "string" || password === "") throw new TypeError("Password must be a non-empty string.");
  const N = 2 ** log2N;
  const memory = 128 * N * r;
  if (log2N < 10 || r < 1 || p < 1 || p > MAX_P || memory > MAX_MEMORY) {
    throw new Error("This file asks for password settings BarongLock won't use (too weak or too costly).");
  }
  return scrypt(Buffer.from(normalize(password), "utf8"), salt, KEY_BYTES, { N, r, p, maxmem: 2 * memory });
}
