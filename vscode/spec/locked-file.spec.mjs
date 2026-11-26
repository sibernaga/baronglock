// Not named *.test.mjs, so the root `npm test` (which needs no extension
// dependencies) doesn't pick it up. Run with `npm test` in vscode/.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { lock, unlock, keyIdOf, usesPassword } from "baronglock";
import { readLocked, writeLocked, lockedPath, lockToFile } from "../src/locked-file.mjs";

// A scratch folder with its own key store, so the real one is never touched.
async function scratch(t, text = "hello\n") {
  const dir = await mkdtemp(join(tmpdir(), "baronglock-vscode-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const keyDir = join(dir, "keys");
  const file = join(dir, "notes.blj");
  const { locked, keyId } = await lock(Buffer.from(text), { keyDir });
  await writeFile(file, locked);
  return { dir, keyDir, file, keyId };
}

test("readLocked returns the unlocked bytes", async (t) => {
  const { keyDir, file } = await scratch(t, "a,b\r\n");
  const { plaintext, password } = await readLocked(file, { keyDir });
  assert.equal(plaintext.toString(), "a,b\r\n");
  assert.equal(password, undefined);
});

const PASSWORD = "correct horse battery staple";
async function passwordFile(t, text = "secret\n") {
  const { dir, keyDir } = await scratch(t);
  const file = join(dir, "pw.blj");
  await lockToFile(Buffer.from(text), file, { password: PASSWORD });
  return { dir, keyDir, file };
}

test("readLocked asks for a password, and again after a wrong one", async (t) => {
  const { file } = await passwordFile(t);
  const asked = [];
  const answers = ["wrong password", PASSWORD];
  const result = await readLocked(file, { askPassword: async (message) => { asked.push(message); return answers.shift(); } });
  assert.equal(result.plaintext.toString(), "secret\n");
  assert.equal(result.password, PASSWORD);
  assert.deepEqual(asked, ["This file is locked with a password.", "Wrong password. Try again."]);
});

test("readLocked uses a given password without asking", async (t) => {
  const { file } = await passwordFile(t);
  const result = await readLocked(file, { password: PASSWORD, askPassword: () => assert.fail("asked") });
  assert.equal(result.plaintext.toString(), "secret\n");
});

test("readLocked stops when asking is cancelled or after 4 wrong tries", async (t) => {
  const { file } = await passwordFile(t);
  await assert.rejects(readLocked(file, { askPassword: async () => undefined }), { code: "BARONGLOCK_CANCELLED" });
  let tries = 0;
  await assert.rejects(readLocked(file, { askPassword: async () => { tries++; return "wrong password"; } }),
    { code: "BARONGLOCK_WRONG_PASSWORD" });
  assert.equal(tries, 4);
  await assert.rejects(readLocked(file), { code: "BARONGLOCK_PASSWORD_REQUIRED" });
});

test("writeLocked keeps a password file's password", async (t) => {
  const { dir, file } = await passwordFile(t);
  await writeLocked(file, Buffer.from("changed\n"), { password: PASSWORD });
  assert.equal((await unlock(await readFile(file), { password: PASSWORD })).toString(), "changed\n");
  await assert.rejects(writeLocked(file, Buffer.from("x"), { password: "wrong password" }), { code: "BARONGLOCK_WRONG_PASSWORD" });
  await assert.rejects(writeLocked(file, Buffer.from("x")), { code: "BARONGLOCK_PASSWORD_REQUIRED" });
  assert.deepEqual((await readdir(dir)).sort(), ["keys", "notes.blj", "pw.blj"]);
});

test("lockToFile with a password saves no key", async (t) => {
  const { keyDir, file } = await passwordFile(t);
  assert.ok(usesPassword(await readFile(file)));
  assert.equal((await readdir(keyDir)).length, 1); // only the key from scratch()
});

test("readLocked refuses a plain file", async (t) => {
  const { dir, keyDir } = await scratch(t);
  await writeFile(join(dir, "plain.blj"), "not locked");
  await assert.rejects(readLocked(join(dir, "plain.blj"), { keyDir }), /not a BarongLock file/);
});

test("writeLocked saves new text with the same key and leaves no temp file", async (t) => {
  const { dir, keyDir, file, keyId } = await scratch(t);
  await writeLocked(file, new TextEncoder().encode("changed\n"), { keyDir });
  const saved = await readFile(file);
  assert.equal(keyIdOf(saved), keyId);
  assert.equal((await unlock(saved, { keyDir })).toString(), "changed\n");
  assert.deepEqual((await readdir(dir)).sort(), ["keys", "notes.blj"]);
});

test("writeLocked leaves the file alone when the key is missing", async (t) => {
  const { dir, file } = await scratch(t);
  const before = await readFile(file);
  await assert.rejects(writeLocked(file, Buffer.from("x"), { keyDir: join(dir, "no-keys") }), /not found/);
  assert.deepEqual(await readFile(file), before);
  assert.deepEqual((await readdir(dir)).sort(), ["keys", "notes.blj"]);
});

test("lockedPath names files like the CLI", () => {
  assert.equal(lockedPath(join("d", "notes.txt")), join("d", "notes.baronglock"));
  assert.equal(lockedPath(join("d", "archive.tar.gz"), "blj"), join("d", "archive.tar.blj"));
  assert.equal(lockedPath(join("d", ".env")), join("d", ".env.baronglock"));
});

test("lockToFile writes a new locked file with a new key", async (t) => {
  const { dir, keyDir } = await scratch(t);
  const target = join(dir, "new.blj");
  const { keyId } = await lockToFile(Buffer.from("fresh\n"), target, { keyDir });
  const saved = await readFile(target);
  assert.equal(keyIdOf(saved), keyId);
  assert.equal((await unlock(saved, { keyDir })).toString(), "fresh\n");
  assert.equal((await readdir(keyDir)).length, 2);
});

test("lockToFile never overwrites, and removes the unused key", async (t) => {
  const { keyDir, file } = await scratch(t);
  const before = await readFile(file);
  await assert.rejects(lockToFile(Buffer.from("x"), file, { keyDir }), /EEXIST/);
  assert.deepEqual(await readFile(file), before);
  assert.equal((await readdir(keyDir)).length, 1);
});

test("writeLocked refuses a changed file and leaves it alone", async (t) => {
  const { keyDir, file } = await scratch(t);
  const damaged = await readFile(file);
  damaged[damaged.length - 1] ^= 1;
  await writeFile(file, damaged);
  await assert.rejects(writeLocked(file, Buffer.from("x"), { keyDir }));
  assert.deepEqual(await readFile(file), damaged);
});
