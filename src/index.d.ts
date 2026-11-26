/// <reference types="node" />

export interface KeyStoreOptions {
  /** Key-store folder. Default: BARONGLOCK_KEY_DIR, else ~/.baronglock/keys. */
  keyDir?: string;
}

/** True if the bytes start with the BarongLock signature. */
export function isLocked(data: Uint8Array): boolean;

/** The Key ID (32 hex chars) a locked file needs. Not secret. */
export function keyIdOf(locked: Uint8Array): string;

/**
 * Locks bytes with a new key and saves the key in the key store.
 * If the caller then fails to store `locked`, it should delete `keyFile`.
 */
export function lock(
  plaintext: Uint8Array,
  options?: KeyStoreOptions
): Promise<{ locked: Buffer; keyId: string; keyFile: string }>;

/** Unlocks bytes using the matching key from the key store. */
export function unlock(locked: Uint8Array, options?: KeyStoreOptions): Promise<Buffer>;

/**
 * Locks new contents for an existing locked file with that file's own key,
 * so everyone who has the key can still open it. Used when an editor saves.
 */
export function relock(
  oldLocked: Uint8Array,
  plaintext: Uint8Array,
  options?: KeyStoreOptions
): Promise<Buffer>;
