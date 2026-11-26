import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lock, unlock, relock, usesPassword, keyIdOf, isLocked } from "../src/index.js";
import { parseEnvelope } from "../src/format.js";

const PASSWORD = "correct horse battery staple";

test("locks and unlocks with a password, and saves no key", async (t) => {
  const keyDir = await mkdtemp(join(tmpdir(), "baronglock-pw-"));
  t.after(() => rm(keyDir, { recursive: true, force: true }));
  const { locked, keyId, keyFile } = await lock(Buffer.from("a,b\n"), { password: PASSWORD, keyDir });
  assert.equal(keyId, null);
  assert.equal(keyFile, null);
  assert.deepEqual(await readdir(keyDir), []);
  assert.ok(isLocked(locked));
  assert.ok(usesPassword(locked));
  assert.equal(keyIdOf(locked), null);
  assert.equal(parseEnvelope(locked).version, 2);
  assert.equal((await unlock(locked, { password: PASSWORD })).toString(), "a,b\n");
});

test("a wrong or missing password gives a clear error code", async () => {
  const { locked } = await lock(Buffer.from("x"), { password: PASSWORD });
  await assert.rejects(unlock(locked, { password: "wrong password" }), { code: "BARONGLOCK_WRONG_PASSWORD" });
  await assert.rejects(unlock(locked), { code: "BARONGLOCK_PASSWORD_REQUIRED" });
  await assert.rejects(relock(locked, Buffer.from("y"), { password: "wrong password" }), { code: "BARONGLOCK_WRONG_PASSWORD" });
});

test("refuses short passwords when locking", async () => {
  await assert.rejects(lock(Buffer.from("x"), { password: "short" }), /at least 8 characters/);
  await assert.rejects(lock(Buffer.from("x"), { password: "" }), /at least 8 characters/);
});

test("the same password typed in another Unicode form still opens the file", async () => {
  const composed = "café-crème-2026";                       // é as one character
  const decomposed = composed.normalize("NFD");             // e + combining accent
  assert.notEqual(composed, decomposed);
  const { locked } = await lock(Buffer.from("ok"), { password: composed });
  assert.equal((await unlock(locked, { password: decomposed })).toString(), "ok");
});

test("relock keeps the password and salt, with a new nonce", async () => {
  const { locked } = await lock(Buffer.from("v1"), { password: PASSWORD });
  const next = await relock(locked, Buffer.from("v2"), { password: PASSWORD });
  const [before, after] = [parseEnvelope(locked), parseEnvelope(next)];
  assert.deepEqual(after.salt, before.salt);
  assert.deepEqual(after.scrypt, before.scrypt);
  assert.notDeepEqual(after.nonce, before.nonce);
  assert.equal((await unlock(next, { password: PASSWORD })).toString(), "v2");
});

test("changing the salt or password settings in the header is detected", async () => {
  const { locked } = await lock(Buffer.from("secret"), { password: PASSWORD });
  const saltChanged = Buffer.from(locked);
  saltChanged[20] ^= 1; // inside the salt
  await assert.rejects(unlock(saltChanged, { password: PASSWORD }), { code: "BARONGLOCK_WRONG_PASSWORD" });
  const weaker = Buffer.from(locked);
  weaker[12] = 16; // log2N 17 -> 16: a different key, so the check fails
  await assert.rejects(unlock(weaker, { password: PASSWORD }), { code: "BARONGLOCK_WRONG_PASSWORD" });
});

test("refuses files that ask for far too much memory or too little work", async () => {
  const { locked } = await lock(Buffer.from("secret"), { password: PASSWORD });
  const costly = Buffer.from(locked);
  costly[12] = 30; // N = 2^30: about 1 TiB of memory
  await assert.rejects(unlock(costly, { password: PASSWORD }), /won't use/);
  const weak = Buffer.from(locked);
  weak[12] = 1;
  await assert.rejects(unlock(weak, { password: PASSWORD }), /won't use/);
});

test("refuses unknown versions and password methods", () => {
  const header = Buffer.concat([Buffer.from("BARONGLOCK"), Buffer.from([3]), Buffer.alloc(60)]);
  assert.throws(() => parseEnvelope(header), /Unsupported BarongLock version: 3/);
  const badKdf = Buffer.concat([Buffer.from("BARONGLOCK"), Buffer.from([2, 9]), Buffer.alloc(60)]);
  assert.throws(() => parseEnvelope(badKdf), /Unsupported password method/);
  assert.throws(() => parseEnvelope(Buffer.concat([Buffer.from("BARONGLOCK"), Buffer.from([2]), Buffer.alloc(40)])), /Truncated/);
});
