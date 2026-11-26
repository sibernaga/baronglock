/// <reference types="node" />

export interface UnlockOptions {
  /** Key-store folder. Default: BARONGLOCK_KEY_DIR, else ~/.baronglock/keys. */
  keyDir?: string;
  /** Needed for files locked with a password. Ignored for key files. */
  password?: string;
}

export interface LockOptions extends UnlockOptions {
  /** Lock with this password instead of a new stored key. At least MIN_PASSWORD_LENGTH characters. */
  password?: string;
}

/** Shortest password accepted when locking. */
export const MIN_PASSWORD_LENGTH: number;

/** True if the bytes start with the BarongLock signature. */
export function isLocked(data: Uint8Array): boolean;

/** True if the locked file opens with a password rather than a stored key. */
export function usesPassword(locked: Uint8Array): boolean;

/** The Key ID (32 hex chars) a locked file needs, or null for a password file. Not secret. */
export function keyIdOf(locked: Uint8Array): string | null;

/**
 * Locks bytes. With `password`, the key is made from it and nothing is saved
 * (`keyId` and `keyFile` are null). Otherwise a new key is saved in the key
 * store; if the caller then fails to store `locked`, it should delete `keyFile`.
 */
export function lock(
  plaintext: Uint8Array,
  options?: LockOptions
): Promise<{ locked: Buffer; keyId: string | null; keyFile: string | null }>;

/**
 * Unlocks bytes. Errors for password files carry `code`:
 * "BARONGLOCK_PASSWORD_REQUIRED" or "BARONGLOCK_WRONG_PASSWORD".
 */
export function unlock(locked: Uint8Array, options?: UnlockOptions): Promise<Buffer>;

/**
 * Locks new contents for an existing locked file the same way it was locked
 * (same key, or same password), so everyone who could open it still can.
 */
export function relock(
  oldLocked: Uint8Array,
  plaintext: Uint8Array,
  options?: UnlockOptions
): Promise<Buffer>;
