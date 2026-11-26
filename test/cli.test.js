import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../src/cli.js", import.meta.url));

// A scratch folder that also holds the key store, so the real one is never touched.
// `run` passes no password unless `env` sets one, and stdin is not a terminal.
async function scratch(t) {
  const dir = await mkdtemp(join(tmpdir(), "baronglock-cli-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const { BARONGLOCK_PASSWORD, ...base } = process.env;
  const runWith = (env, ...args) => spawnSync(process.execPath, [CLI, ...args], {
    env: { ...base, BARONGLOCK_KEY_DIR: join(dir, "keys"), ...env },
  });
  return { dir, run: (...args) => runWith({}, ...args), runWith };
}

test("locks with a password from BARONGLOCK_PASSWORD and unlocks with it", async (t) => {
  const { dir, run, runWith } = await scratch(t);
  const env = { BARONGLOCK_PASSWORD: "correct horse battery staple" };
  await writeFile(join(dir, "pw.txt"), "secret\n");
  const locked = runWith(env, "encrypt", join(dir, "pw.txt"), "--password");
  assert.equal(locked.status, 0, locked.stderr.toString());
  assert.match(locked.stderr.toString(), /Locked with a password/);
  assert.doesNotMatch(locked.stderr.toString(), /Key ID/);
  const unlocked = runWith(env, join(dir, "pw.baronglock"));
  assert.equal(unlocked.status, 0, unlocked.stderr.toString());
  assert.equal(unlocked.stdout.toString(), "secret\n");

  const wrong = runWith({ BARONGLOCK_PASSWORD: "not the password" }, join(dir, "pw.baronglock"));
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr.toString(), /Wrong password/);
  const missing = run(join(dir, "pw.baronglock"));
  assert.equal(missing.status, 1);
  assert.match(missing.stderr.toString(), /needs a password/);
});

test("refuses a short password and a password given as an argument", async (t) => {
  const { dir, runWith, run } = await scratch(t);
  await writeFile(join(dir, "a.txt"), "a");
  const short = runWith({ BARONGLOCK_PASSWORD: "short" }, "encrypt", join(dir, "a.txt"), "--password");
  assert.equal(short.status, 1);
  assert.match(short.stderr.toString(), /at least 8 characters/);
  const asArgument = run(join(dir, "a.txt"), "--password", "hunter22");
  assert.equal(asArgument.status, 1);
  assert.match(asArgument.stderr.toString(), /--password takes no value/);
});

test("locks and unlocks a file, printing the Key ID", async (t) => {
  const { dir, run } = await scratch(t);
  const input = join(dir, "notes.txt");
  await writeFile(input, "hello\r\n");
  const locked = run("encrypt", input, "--ext", "blj");
  assert.equal(locked.status, 0, locked.stderr.toString());
  assert.match(locked.stderr.toString(), /^Key ID: [a-f0-9]{32}$/m);
  const unlocked = run("decrypt", join(dir, "notes.blj"));
  assert.equal(unlocked.status, 0, unlocked.stderr.toString());
  assert.equal(unlocked.stdout.toString(), "hello\r\n");
});

test("auto mode decrypts a locked file to --out", async (t) => {
  const { dir, run } = await scratch(t);
  await writeFile(join(dir, "a.csv"), "a,b\n");
  assert.equal(run(join(dir, "a.csv")).status, 0);
  const out = join(dir, "a-unlocked.csv");
  assert.equal(run(join(dir, "a.baronglock"), "--out", out).status, 0);
  assert.equal(await readFile(out, "utf8"), "a,b\n");
});

test("refuses to lock a locked file or unlock a plain one", async (t) => {
  const { dir, run } = await scratch(t);
  await writeFile(join(dir, "x.txt"), "x");
  assert.equal(run(join(dir, "x.txt")).status, 0);
  const again = run("encrypt", join(dir, "x.baronglock"), "--out", join(dir, "y.baronglock"));
  assert.equal(again.status, 1);
  assert.match(again.stderr.toString(), /already a BarongLock file/);
  const plain = run("decrypt", join(dir, "x.txt"));
  assert.equal(plain.status, 1);
  assert.match(plain.stderr.toString(), /does not have the BarongLock signature/);
});
