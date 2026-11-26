![BarongLock identity: a Barong mask](docs/assets/baronglock-identity-200.jpg)

# BarongLock

**Lock any file so only people with the key can open it.**

BarongLock turns a normal file into a locked file (`.baronglock`, or the short form `.blj`). It works with any kind of file: notes, text, CSV, JSON, config files, documents. You can store or send the locked file. Nobody can open it without its key, not even with BarongLock.

## How it works

Think of a padlocked box:

- **The locked file** (`.baronglock` or `.blj`) is the box. Store it or send it anywhere.
- **The key** is made when you lock the file. It is saved privately on your computer, never inside the locked file.
- **To unlock**, you need both. On the computer that locked the file, this just works.
- **If you lose the key, the file is gone for good.** Nobody can recover it. See [Keep your keys safe](#keep-your-keys-safe).

Each locked file gets its own new key.

Got a `.baronglock` or `.blj` file from someone else? You also need its key from them. See [Open the file on another computer](#open-the-file-on-another-computer).

## Before you start

Do this once:

1. Install **Node.js** version 20 or newer from [nodejs.org](https://nodejs.org). Pick the "LTS" version. It includes `npx`, which runs BarongLock for you. Nothing else to download.
2. Open a terminal in the folder that holds your file:
   - **Windows:** open the folder, right-click an empty space, choose **Open in Terminal**.
   - **macOS / Linux:** open Terminal, type `cd ` (with a space), drag the folder into the window, press Enter.

The first time you run `npx baronglock`, it asks `Ok to proceed? (y)`. Type `y` and press Enter.

## Lock a file

```sh
npx baronglock notes.txt
```

- This makes `notes.baronglock` next to `notes.txt`. The `.txt` part is dropped, so remember what kind of file it was.
- If `notes.baronglock` already exists (for example from `notes.csv`), choose another name: `npx baronglock notes.txt --out notes-txt.baronglock`.
- It prints a **Key ID** (a long code). Save it: you need it to open the file on another computer.
- Your original `notes.txt` is **not** deleted. Delete it yourself if you only want the locked copy.

Prefer the short ending? Add `--ext blj` to get `notes.blj` instead:

```sh
npx baronglock notes.txt --ext blj
```

**Tip:** if the file is in another folder, type `npx baronglock ` (with a space) and drag the file into the terminal window. That pastes its full location.

## Unlock a file

```sh
npx baronglock notes.baronglock --out notes-unlocked.txt
```

- `--out` sets the name of the unlocked file. Give it the right ending (`.txt`, `.csv`, …) so your computer knows how to open it.
- Without `--out`, the contents are shown on screen instead of saved.
- BarongLock never overwrites a file. If the name is taken, pick another one.
- `.blj` files unlock the same way: `npx baronglock notes.blj --out notes-unlocked.txt`.

## Open the file on another computer

The other computer needs the key too. Copy it over like this:

1. **On your computer**, save the key to a file. Use the Key ID from when you locked the file:

   ```sh
   npx baronglock key export <KEY_ID> --out my-key.json
   ```

2. **Send `my-key.json` separately from the locked file**, in a safe way, for example a USB stick you hand over. Never send it by plain email, never keep it next to the locked file, never share it publicly. Anyone with both can read your data.

3. **On the other computer**, add the key:

   ```sh
   npx baronglock key import my-key.json
   ```

4. **Unlock** the file as usual:

   ```sh
   npx baronglock notes.baronglock --out notes-unlocked.txt
   ```

5. **Delete `my-key.json`** on both computers when done. On SSDs, backups or synced folders (OneDrive, iCloud, Dropbox), deleting may not remove every copy.

Lost the Key ID? Try to unlock the file on the other computer. The error message shows the Key ID it needs.

## Keep your keys safe

- Keys are saved in a hidden folder:
  - **Windows:** `C:\Users\<your name>\.baronglock\keys`
  - **macOS / Linux:** `~/.baronglock/keys`
- Each key is one small file, named after its Key ID.
- **Back up this folder** somewhere safe and private. If your computer breaks and there is no backup, your locked files can't be opened.
- Anyone who gets a key file can unlock the matching locked file.

## Common problems

| Message contains | What it means | What to do |
|---|---|---|
| `'npx' is not recognized` / `command not found` | Node.js is not installed | Install Node.js, then open a new terminal |
| `ENOENT: no such file or directory` | BarongLock can't find the file | Check the name, or drag the file into the terminal |
| `Key ... not found` | This computer doesn't have the key | Import the key (see above) |
| `EEXIST: file already exists` | A file with that name is already there | Pick a different name with `--out` |
| `unable to authenticate data` | Wrong key, or the locked file is damaged or changed | Get the right key or a fresh copy of the file |
| `already a BarongLock file` | The file is already locked | Nothing to do |

## Good to know

- BarongLock is an early version and has not had an independent security review. Don't rely on it alone for very sensitive data.
- Very large files may be slow or fail. This version loads the whole file into memory.
- BarongLock is not a backup. Keep normal backups of your important files.

---

# For developers and automation

The rest of this README is technical. BarongLock is a small Node.js CLI. It uses Node.js's built-in cryptography, with no runtime npm dependencies. The file format is versioned and uses AES-256-GCM authenticated encryption.

## Quick start

Requirements: Node.js 20 or later and npm/npx.

```sh
npx baronglock data.txt
npx baronglock data.txt --out backup.baronglock
npx baronglock data.baronglock
npx baronglock data.baronglock --out restored.txt
```

The automatic mode is content-based:
- Input beginning with the `BARONGLOCK` signature is treated as an encrypted file and decrypted.
- Other input is treated as plaintext and encrypted.
- Use explicit `encrypt` or `decrypt` subcommands in scripts where guessing would be undesirable.

## What happens to keys?

On encryption, BarongLock generates a fresh random 32-byte AES key and a fresh 12-byte nonce. The key is saved in a local key store (by default `~/.baronglock/keys/`) with restrictive file permissions where supported. The CLI prints the key ID and key-store path, **not the raw key**.

On decryption, the program reads the key ID from the encrypted file and looks for the matching key in the local key store.

To decrypt on another machine, use `key export` / `key import` (steps in [Open the file on another computer](#open-the-file-on-another-computer)), or connect BarongLock to a trusted secret manager. `npx` installs the program; it cannot recover a missing key. Do not commit exported key files to Git. For production or team automation, prefer a secret manager or managed key service.

## CLI reference

```text
baronglock <input-file> [--out <path> | --ext <baronglock|blj>]
baronglock encrypt <input-file> [--out <path> | --ext <baronglock|blj>]
baronglock decrypt <input-file> [--out <path>]
baronglock key import <key-file>
baronglock key export <key-id> --out <key-file>
```

- `--out PATH` / `-o PATH`: write to a file. Existing files are not overwritten.
- `--ext baronglock|blj`: when encrypting without `--out`, pick the locked file's extension. Default `baronglock`. Cannot be combined with `--out`.
- Both extensions are the same format. Detection uses the `BARONGLOCK` signature in the content, never the file name, so a renamed file still decrypts.
- Decryption without `--out` writes plaintext bytes to stdout, suitable for pipes.
- Encryption without `--out` writes `<name>.baronglock` (or `<name>.blj` with `--ext blj`) next to the input, dropping the input's last extension (`notes.txt` → `notes.baronglock`, `archive.tar.gz` → `archive.tar.baronglock`, `.env` → `.env.baronglock`). The original extension is not stored in the locked file.
- For stdin, use `-` as the input path. For example, `cat data.txt | npx baronglock - --out data.baronglock`.
- Diagnostics go to stderr; decrypted content goes to stdout.
- `BARONGLOCK_KEY_DIR` overrides the local key-store directory. Set it to a protected directory accessible only to the service account.

## Piping into tools

```sh
npx baronglock data.baronglock | python process.py
npx baronglock data.baronglock | node process.mjs
npx baronglock data.baronglock | vim -
npx baronglock data.baronglock | nano -
```

For a destination file:

```sh
npx baronglock data.baronglock --out restored.txt
```

The program buffers input in memory in this prototype. Avoid using it with very large files until streaming support has been implemented and tested.

## Using BarongLock from AI agents

AI coding agents can run BarongLock like any other CLI. The agent guide is at [sibernaga.github.io/baronglock/llms.txt](https://sibernaga.github.io/baronglock/llms.txt) ([source](docs/llms.txt)). Point your agent at it. The main rules:

- Run `npx --yes baronglock ...`, so npx doesn't stop at its install prompt.
- Use the explicit `encrypt` / `decrypt` subcommands.
- Read the Key ID from the `Key ID: <32 hex chars>` line on stderr. Exit code `0` means success, `1` means failure.
- Decrypt with `--out <file>` unless the agent needs to read the contents. Plaintext printed to stdout goes into the agent's context.
- The agent must never read, print or upload key files, and should run `key export` only when you ask.
- For tests, set `BARONGLOCK_KEY_DIR` to a temporary folder.

## Using BarongLock as a library

Editor integrations and scripts can lock and unlock bytes in memory. They use the same key store as the CLI.

```js
import { lock, unlock, relock, isLocked, keyIdOf } from "baronglock";

const { locked, keyId } = await lock(Buffer.from("a,b\n1,2\n"));
const plaintext = await unlock(locked);
const updated = await relock(locked, Buffer.from("a,b\n3,4\n")); // same key, new nonce
```

- Inputs can be `Buffer` or `Uint8Array`. Outputs are `Buffer`.
- Every function takes an optional `{ keyDir }`. The default is `BARONGLOCK_KEY_DIR`, or `~/.baronglock/keys`.
- `lock` saves a new key and also returns its `keyFile`. If you then fail to store `locked`, delete `keyFile`.
- `relock` is for saving edits. It checks that the old file opens with its key, then locks the new contents with that same key, so people who imported the key can still open it.
- `lock` and `relock` refuse contents that are already locked.
- TypeScript types are included.

## File format (version 1)

All fields are binary and have fixed lengths except the ciphertext:

| Field | Size | Purpose |
|---|---:|---|
| Magic signature `BARONGLOCK` | 10 bytes | File detection |
| Version | 1 byte | Format version (`1`) |
| Key ID | 16 bytes | Identifies the required key; not secret |
| Nonce | 12 bytes | AES-GCM nonce |
| Authentication tag | 16 bytes | Verifies ciphertext and authenticated header |
| Ciphertext | Remaining bytes | Encrypted original input bytes |

The authenticated additional data (AAD) is the magic signature, version byte, and key ID. The nonce, tag, and ciphertext are passed to AES-256-GCM. Input bytes are preserved as-is; this tool does not parse or normalize the input, so any file (text, CSV, JSON, binary) round-trips byte-for-byte, with no encoding or line-ending changes.

## Security notes and limitations

- AES-256-GCM provides confidentiality and integrity when used correctly.
- Each file gets its own random key, and every encryption uses a fresh random nonce. Saving edits with `relock` reuses the file's key with a new nonce. AES-GCM allows that for far more saves than any file will see.
- The key ID is not a secret. The key itself is a 32-byte secret and must be protected and backed up.
- The encrypted file is not self-decrypting. Anyone with only the `.baronglock` / `.blj` file cannot decrypt it.
- The prototype stores raw keys in local JSON files with restrictive permissions where supported. This is not equivalent to a hardware-backed key store or a centralized secret manager.
- Anyone who can read a key file can decrypt the corresponding file. Protect key backups and machine accounts.
- Authentication is verified before plaintext is returned by the crypto layer. The CLI buffers the full plaintext before writing it to stdout.
- This prototype is not independently security-audited. Review it before using it for sensitive or production data.
- Do not use the tool as a substitute for backups, access control, endpoint security, or a managed key-management system.
- Automatic detection treats non-BarongLock input as plaintext for encryption. In automation, prefer the explicit `encrypt` and `decrypt` subcommands.

## Development

Clone the repository, then run the tests or the CLI straight from source:

```sh
npm test
node src/cli.js --help
node src/cli.js data.txt
```

The project has no third-party runtime dependencies. The CLI uses `node:crypto`, filesystem APIs, and standard Node.js streams.

## Releasing

BarongLock is published on npm as [`baronglock`](https://www.npmjs.com/package/baronglock). Members of the `sibernaga` npm organisation's `developers` team can publish new versions.

To release a new version:
1. Run `npm test`.
2. Run `npm version patch` (or `minor` / `major`). This updates `package.json` and creates a git tag.
3. Run `git push --follow-tags`.
4. Run `npm publish` in a normal terminal and approve the 2FA prompt in the browser.

Still to do before 1.0:
- Review the implementation and threat model.
- Add end-to-end tests for CLI detection, key import/export, truncated files, malformed headers, and file permissions.
- Add streaming support or document a maximum file size.
- Test on supported Windows, macOS, and Linux versions.
- Keep the format specification stable and document compatibility changes.
