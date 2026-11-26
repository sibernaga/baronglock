import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../src/cli.js", import.meta.url));

// A scratch folder that also holds the key store, so the real one is never touched.
async function scratch(t) {
  const dir = await mkdtemp(join(tmpdir(), "baronglock-cli-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const run = (...args) => spawnSync(process.execPath, [CLI, ...args], {
    env: { ...process.env, BARONGLOCK_KEY_DIR: join(dir, "keys") },
  });
  return { dir, run };
}

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
