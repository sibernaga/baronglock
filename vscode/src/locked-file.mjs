// Reading and saving locked files on disk. No VS Code code here, so it can be
// tested with plain Node.
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { basename, dirname, join, parse } from "node:path";
import { isLocked, usesPassword, lock, unlock, relock } from "baronglock";

/** notes.txt -> notes.baronglock, like the CLI: the last extension is dropped. */
export function lockedPath(path, ext = "baronglock") {
  const { dir, name } = parse(path);
  return join(dir, `${name}.${ext}`);
}

/**
 * Locks bytes into a new file, with a new key, or with `options.password`.
 * Never overwrites a file. If the file can't be written, a new key is removed again.
 */
export async function lockToFile(plaintext, target, options) {
  const { locked, keyId, keyFile } = await lock(plaintext, options);
  try {
    await writeFile(target, locked, { flag: "wx", mode: 0o600 });
  } catch (error) {
    if (keyFile) await unlink(keyFile).catch(() => {});
    throw error;
  }
  return { keyId };
}

/**
 * Reads a locked file and returns { plaintext, password }. For a password
 * file, `password` is tried first; then `askPassword(message)` is called until
 * the password is right, it returns undefined (cancelled), or 3 more tries fail.
 * The returned `password` is the one that worked (undefined for key files).
 */
export async function readLocked(path, { keyDir, password, askPassword } = {}) {
  const data = await readFile(path);
  if (!isLocked(data)) throw new Error(`${basename(path)} is not a BarongLock file.`);
  if (!usesPassword(data)) return { plaintext: await unlock(data, { keyDir }), password: undefined };
  for (let tries = 0; ; tries++) {
    if (password === undefined && askPassword) {
      password = await askPassword(tries ? "Wrong password. Try again." : "This file is locked with a password.");
      if (password === undefined) {
        throw Object.assign(new Error("No password was entered."), { code: "BARONGLOCK_CANCELLED" });
      }
    }
    try {
      return { plaintext: await unlock(data, { password }), password };
    } catch (error) {
      if (error.code !== "BARONGLOCK_WRONG_PASSWORD" || !askPassword || tries >= 3) throw error;
      password = undefined;
    }
  }
}

/**
 * Saves new contents into an existing locked file, locked the same way as
 * before: its own key, or its password (`options.password`).
 * The new locked bytes go to a temp file next to it, which then replaces the
 * old file in one step, so a crash mid-save can't leave half a file.
 */
export async function writeLocked(path, plaintext, options) {
  const locked = await relock(await readFile(path), plaintext, options);
  const temp = join(dirname(path), `.${basename(path)}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    await writeFile(temp, locked, { flag: "wx", mode: 0o600 });
    await replace(temp, path);
  } catch (error) {
    await unlink(temp).catch(() => {});
    throw error;
  }
}

// On Windows, a virus scanner or search indexer can hold a file for a moment.
async function replace(from, to) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await rename(from, to);
    } catch (error) {
      if (attempt >= 5 || !["EPERM", "EACCES", "EBUSY"].includes(error.code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
}
