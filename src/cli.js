#!/usr/bin/env node
import { readFile, writeFile, chmod, unlink } from "node:fs/promises";
import { parse, join } from "node:path";
import { stdin, stdout, stderr } from "node:process";
import { isLocked as hasMagic, lock, unlock } from "./index.js";
import { importKeyFile, exportKeyFile, defaultKeyDir } from "./key-store.js";

function usage() {
  return `BarongLock — lock and unlock any file

Usage:
  baronglock <input-file> [--out <path> | --ext <baronglock|blj>]
  baronglock encrypt <input-file> [--out <path> | --ext <baronglock|blj>]
  baronglock decrypt <input-file> [--out <path>]
  baronglock key import <key-file>
  baronglock key export <key-id> --out <key-file>
  baronglock --help

Behavior:
  Any other input        -> encrypt to <name>.baronglock (e.g. notes.txt -> notes.baronglock)
                            --ext blj gives the short form <name>.blj
  BarongLock input       -> decrypt to stdout (or --out <path>)
                            .baronglock and .blj files are both recognised by content, not name
  "-"                    -> read stdin; output to stdout unless --out is given

Key store: ${defaultKeyDir()}
Environment:
  BARONGLOCK_KEY_DIR     Override local key-store directory
`;
}
function parseArgs(args) {
  const result = { positional: [], out: null, ext: null, help: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--help" || a === "-h") result.help = true;
    else if (a === "--out" || a === "-o") {
      if (!args[i + 1]) throw new Error(`${a} requires a path.`);
      result.out = args[++i];
    } else if (a === "--ext") {
      const ext = (args[i + 1] || "").replace(/^\./, "").toLowerCase();
      if (!LOCKED_EXTENSIONS.includes(ext)) throw new Error(`--ext must be one of: ${LOCKED_EXTENSIONS.join(", ")}.`);
      result.ext = ext;
      i++;
    } else if (a.startsWith("-") && a !== "-") throw new Error(`Unknown option: ${a}`);
    else result.positional.push(a);
  }
  return result;
}
async function readInput(path) {
  if (path !== "-") return readFile(path);
  const chunks = [];
  for await (const chunk of stdin) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function writeOutput(path, data) {
  if (!path || path === "-") { stdout.write(data); return; }
  await writeFile(path, data, { flag: "wx", mode: 0o600 });
  await chmod(path, 0o600).catch(() => {});
}
// Locked files may end in .baronglock (default) or the short .blj. Unlocking
// never relies on the name: it checks the BARONGLOCK signature in the content.
const LOCKED_EXTENSIONS = ["baronglock", "blj"];
// notes.txt -> notes.baronglock (the file's own extension is dropped; folder is kept).
function lockedName(inputPath, ext = "baronglock") {
  const { dir, name } = parse(inputPath);
  return join(dir, `${name}.${ext}`);
}
async function runFile(inputPath, explicitMode, outputPath, ext) {
  const input = await readInput(inputPath);
  const isLocked = hasMagic(input);
  const mode = explicitMode || (isLocked ? "decrypt" : "encrypt");
  if (mode === "decrypt") {
    if (ext) throw new Error("--ext only applies when locking a file. Use --out to name the unlocked file.");
    if (!isLocked) throw new Error("Input does not have the BarongLock signature; refusing to decrypt.");
    const plaintext = await unlock(input);
    const out = outputPath ?? (inputPath === "-" ? "-" : null);
    if (out === null) await writeOutput("-", plaintext);
    else await writeOutput(out, plaintext);
    if (out !== "-" && out !== null) stderr.write(`Decrypted to ${out}\n`);
  } else {
    const { locked: envelope, keyId: id, keyFile } = await lock(input);
    const defaultOut = inputPath === "-" ? "-" : lockedName(inputPath, ext ?? undefined);
    const out = outputPath ?? defaultOut;
    try {
      await writeOutput(out, envelope);
    } catch (error) {
      // Nothing was locked with this key, so don't leave it behind.
      await unlink(keyFile).catch(() => {});
      throw error;
    }
    stderr.write(`Encrypted: ${out === "-" ? "stdout" : out}\nKey ID: ${id}\nKey stored privately at: ${keyFile}\nBack up/transfer the key securely to decrypt on another machine.\n`);
  }
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.positional.length === 0) { stdout.write(usage()); return; }
  const p = args.positional;
  if (p[0] === "key" && p[1] === "import") {
    if (p.length !== 3) throw new Error("Usage: baronglock key import <key-file>");
    const destination = await importKeyFile(p[2]);
    stdout.write(`Imported key to ${destination}\n`);
    return;
  }
  if (p[0] === "key" && p[1] === "export") {
    if (p.length !== 3 || !args.out) throw new Error("Usage: baronglock key export <key-id> --out <key-file>");
    const destination = await exportKeyFile(p[2], args.out);
    stdout.write(`Exported key to ${destination}. Treat this file as a secret.\n`);
    return;
  }
  let mode = null;
  let inputPath;
  if (p[0] === "encrypt" || p[0] === "decrypt") {
    mode = p[0];
    inputPath = p[1];
    if (!inputPath || p.length !== 2) throw new Error(`Usage: baronglock ${mode} <input-file> [--out <path>]`);
  } else {
    if (p.length !== 1) throw new Error("Provide one input file. Use --help for usage.");
    inputPath = p[0];
  }
  if (args.out && args.ext) throw new Error("Use either --out or --ext, not both.");
  await runFile(inputPath, mode, args.out, args.ext);
}
main().catch((error) => {
  stderr.write(`baronglock: ${error.message}\n`);
  process.exitCode = 1;
});
