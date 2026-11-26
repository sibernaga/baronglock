// Runs the extension inside a real, separate copy of VS Code.
// Everything goes in the OS temp folder: the VS Code download (kept for the
// next run), plus this run's key store, files and VS Code profile (deleted after).
import { runTests } from "@vscode/test-electron";
import { lock, unlock, keyIdOf, usesPassword } from "baronglock";
import { mkdir, mkdtemp, writeFile, readFile, readdir, stat, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const extensionRoot = fileURLToPath(new URL("../..", import.meta.url));
const base = join(tmpdir(), "baronglock-vscode-test");
await mkdir(base, { recursive: true });
const runDir = await mkdtemp(join(base, "run-"));
const keyDir = join(runDir, "keys");
const filesDir = join(runDir, "files");
const userData = join(runDir, "user-data");
await mkdir(filesDir);

const notes = await lock(Buffer.from("hello,world\n"), { keyDir });
await writeFile(join(filesDir, "notes.blj"), notes.locked);
const noKey = await lock(Buffer.from("secret\n"), { keyDir: join(runDir, "other-keys") });
await writeFile(join(filesDir, "nokey.blj"), noKey.locked);
await writeFile(join(filesDir, "plain.txt"), "plain text\n");
await writeFile(join(filesDir, "a.csv"), "a,b\n");
await writeFile(join(filesDir, "b.json"), "{}\n");
await writeFile(join(filesDir, "pw.txt"), "pw text\n");
const PASSWORD = "correct horse battery staple";
const SECRET_PASSWORD = "another long passphrase";
await writeFile(join(filesDir, "secret.blj"), (await lock(Buffer.from("top secret\n"), { password: SECRET_PASSWORD })).locked);

// Lists files under `dir` that contain `text`, to see where VS Code keeps copies.
async function filesContaining(dir, text) {
  const found = [];
  for (const entry of await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => [])) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    if ((await stat(path)).size > 5_000_000) continue;
    if ((await readFile(path).catch(() => Buffer.alloc(0))).includes(text)) found.push(relative(dir, path));
  }
  return found;
}

try {
  await runTests({
    extensionDevelopmentPath: extensionRoot,
    extensionTestsPath: join(extensionRoot, "spec", "integration", "suite.cjs"),
    cachePath: join(base, "vscode"),
    launchArgs: [filesDir, "--disable-extensions", `--user-data-dir=${userData}`, `--extensions-dir=${join(runDir, "extensions")}`],
    extensionTestsEnv: {
      BARONGLOCK_KEY_DIR: keyDir,
      BARONGLOCK_PASSWORD: undefined, // The suite sets it only where a step needs it.
      BARONGLOCK_TEST_DIR: filesDir,
      BARONGLOCK_TEST_USER_DATA: userData,
      BARONGLOCK_TEST_PASSWORD: PASSWORD,
      BARONGLOCK_TEST_SECRET_PASSWORD: SECRET_PASSWORD,
    },
  });

  const saved = await readFile(join(filesDir, "notes.blj"));
  assert.equal(keyIdOf(saved), notes.keyId, "saving changed the key");
  assert.equal((await unlock(saved, { keyDir })).toString(), "hello,world\nmore\n");
  console.log("ok - the file on disk is locked with the same key and holds the saved text");

  for (const [name, text] of [["plain.baronglock", "plain text\n"], ["new.blj", "new secret\n"]]) {
    assert.equal((await unlock(await readFile(join(filesDir, name)), { keyDir })).toString(), text, name);
  }
  console.log("ok - files locked in VS Code unlock with the BarongLock library");

  for (const [name, password, text] of [["pw.baronglock", PASSWORD, "pw text\nmore\n"], ["secret.blj", SECRET_PASSWORD, "top secret\nedited\n"]]) {
    const saved = await readFile(join(filesDir, name));
    assert.ok(usesPassword(saved), `${name} is no longer a password file`);
    assert.equal((await unlock(saved, { password })).toString(), text, name);
  }
  console.log("ok - password files saved in VS Code keep their password and hold the saved text");

  assert.deepEqual((await readdir(filesDir)).sort(),
    ["a.baronglock", "a.csv", "b.baronglock", "b.json", "new.blj", "nokey.blj", "notes.blj", "plain.baronglock", "plain.txt",
      "pw.baronglock", "pw.txt", "secret.blj"],
    "unexpected or temp files left behind");
  console.log("ok - no temp files left behind, and the original plain file is kept");

  const copies = await filesContaining(userData, "hello,world");
  console.log(copies.length
    ? `note - plaintext found in VS Code's data folder after saving:\n  ${copies.join("\n  ")}`
    : "note - no plaintext found in VS Code's data folder after saving");
} finally {
  await rm(runDir, { recursive: true, force: true });
}
