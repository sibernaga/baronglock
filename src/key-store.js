import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { KEY_BYTES } from "./format.js";

export function defaultKeyDir() {
  return process.env.BARONGLOCK_KEY_DIR || join(homedir(), ".baronglock", "keys");
}
export function keyIdHex(idBuffer) { return idBuffer.toString("hex"); }
export function keyPath(keyIdHexValue, dir = defaultKeyDir()) {
  if (!/^[a-f0-9]{32}$/i.test(keyIdHexValue)) throw new Error("Invalid key ID.");
  return join(dir, `${keyIdHexValue}.json`);
}
export async function createKey() {
  return randomBytes(KEY_BYTES);
}
export async function saveKey(keyId, key, dir = defaultKeyDir()) {
  if (key.length !== KEY_BYTES) throw new Error("Key must be 32 bytes.");
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const file = keyPath(keyId, dir);
  const data = JSON.stringify({ format: "baronglock-key-v1", keyId, key: key.toString("base64") }, null, 2) + "\n";
  await writeFile(file, data, { mode: 0o600, flag: "wx" });
  await chmod(file, 0o600).catch(() => {});
  return file;
}
export async function loadKey(keyId, dir = defaultKeyDir()) {
  const file = keyPath(keyId, dir);
  let obj;
  try { obj = JSON.parse(await readFile(file, "utf8")); }
  catch (e) {
    if (e.code === "ENOENT") throw new Error(`Key ${keyId} not found in ${dir}. Import the matching key on this machine first.`);
    throw new Error(`Cannot read key file ${file}: ${e.message}`);
  }
  if (obj.format !== "baronglock-key-v1" || obj.keyId !== keyId || typeof obj.key !== "string") {
    throw new Error(`Invalid key file: ${file}`);
  }
  const key = Buffer.from(obj.key, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== obj.key) throw new Error(`Invalid key material in ${file}`);
  return key;
}
export async function importKeyFile(source, dir = defaultKeyDir()) {
  const obj = JSON.parse(await readFile(source, "utf8"));
  if (obj.format !== "baronglock-key-v1" || !/^[a-f0-9]{32}$/i.test(obj.keyId || "") || typeof obj.key !== "string") {
    throw new Error("Invalid BarongLock key file.");
  }
  const key = Buffer.from(obj.key, "base64");
  if (key.length !== KEY_BYTES || key.toString("base64") !== obj.key) throw new Error("Invalid key material.");
  return saveKey(obj.keyId, key, dir);
}
export async function exportKeyFile(keyId, destination, dir = defaultKeyDir()) {
  const key = await loadKey(keyId, dir);
  const data = JSON.stringify({ format: "baronglock-key-v1", keyId, key: key.toString("base64") }, null, 2) + "\n";
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, data, { mode: 0o600, flag: "wx" });
  await chmod(destination, 0o600).catch(() => {});
  return destination;
}
