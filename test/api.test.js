import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { isLocked, keyIdOf, lock, unlock, relock } from "../src/index.js";
import { encrypt, decrypt } from "../src/crypto.js";
import { parseEnvelope } from "../src/format.js";

// Each test gets its own key store, so the real one is never touched.
async function tempKeyDir(t) {
  const keyDir = await mkdtemp(join(tmpdir(), "baronglock-test-"));
  t.after(() => rm(keyDir, { recursive: true, force: true }));
  return keyDir;
}

test("lock then unlock round-trips the bytes and saves one key", async (t) => {
  const keyDir = await tempKeyDir(t);
  const input = Buffer.from("name,value\r\nZoë,🌍\r\n", "utf8");
  const { locked, keyId, keyFile } = await lock(input, { keyDir });
  assert.match(keyId, /^[a-f0-9]{32}$/);
  assert.equal(keyIdOf(locked), keyId);
  assert.ok(keyFile.startsWith(keyDir));
  assert.deepEqual(await readdir(keyDir), [`${keyId}.json`]);
  assert.ok(isLocked(locked));
  assert.ok(!isLocked(input));
  assert.deepEqual(await unlock(locked, { keyDir }), input);
});

test("accepts a Uint8Array view that does not start at offset 0", async (t) => {
  const keyDir = await tempKeyDir(t);
  const backing = new Uint8Array([9, 9, 104, 105, 9]);
  const view = backing.subarray(2, 4); // "hi"
  const { locked } = await lock(view, { keyDir });
  const lockedView = new Uint8Array(locked); // what an editor would hand back
  assert.equal((await unlock(lockedView, { keyDir })).toString(), "hi");
  const again = await relock(lockedView, new TextEncoder().encode("hey"), { keyDir });
  assert.equal((await unlock(again, { keyDir })).toString(), "hey");
});

test("relock keeps the key ID, uses a new nonce and adds no key", async (t) => {
  const keyDir = await tempKeyDir(t);
  const { locked, keyId } = await lock(Buffer.from("v1"), { keyDir });
  const next = await relock(locked, Buffer.from("v2"), { keyDir });
  assert.equal(keyIdOf(next), keyId);
  assert.notDeepEqual(parseEnvelope(next).nonce, parseEnvelope(locked).nonce);
  assert.equal((await unlock(next, { keyDir })).toString(), "v2");
  assert.equal((await readdir(keyDir)).length, 1);
});

test("relock refuses a changed old file", async (t) => {
  const keyDir = await tempKeyDir(t);
  const { locked } = await lock(Buffer.from("secret"), { keyDir });
  locked[locked.length - 1] ^= 1;
  await assert.rejects(relock(locked, Buffer.from("new"), { keyDir }));
});

test("relock and unlock fail without the key", async (t) => {
  const keyDir = await tempKeyDir(t);
  const otherDir = await tempKeyDir(t);
  const { locked } = await lock(Buffer.from("secret"), { keyDir });
  await assert.rejects(unlock(locked, { keyDir: otherDir }), /not found/);
  await assert.rejects(relock(locked, Buffer.from("new"), { keyDir: otherDir }), /not found/);
});

test("lock and relock refuse contents that are already locked", async (t) => {
  const keyDir = await tempKeyDir(t);
  const { locked } = await lock(Buffer.from("secret"), { keyDir });
  await assert.rejects(lock(locked, { keyDir }), /already a BarongLock file/);
  await assert.rejects(relock(locked, locked, { keyDir }), /already a BarongLock file/);
});

test("rejects input that is not bytes", async (t) => {
  const keyDir = await tempKeyDir(t);
  await assert.rejects(lock("text", { keyDir }), TypeError);
});

test("encrypt uses a given key ID and rejects a wrong-sized one", () => {
  const key = randomBytes(32);
  const keyId = randomBytes(16);
  const { envelope, keyId: used } = encrypt(Buffer.from("x"), key, keyId);
  assert.deepEqual(used, keyId);
  assert.equal(decrypt(envelope, key).toString(), "x");
  assert.throws(() => encrypt(Buffer.from("x"), key, randomBytes(8)), /16 bytes/);
});
