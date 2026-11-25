# BarongLock

**Encrypt any file into a `.baronglock` file and decrypt it from the terminal using `npx`.**

BarongLock is a small Node.js CLI for automation. It uses Node.js's built-in cryptography—no runtime npm dependencies. The file format is versioned and uses AES-256-GCM authenticated encryption.

> **Important key fact:** A `.baronglock` file does not contain its decryption key. The key is stored separately. To decrypt on another machine, securely transfer/import the matching key or connect BarongLock to a trusted secret manager. `npx` installs the program; it cannot recover a missing secret.

## Quick start

Requirements: Node.js 20 or later and npm/npx.

When published to npm, the intended commands are:

```sh
npx baronglock data.txt
npx baronglock data.txt --out backup.baronglock
npx baronglock data.baronglock
npx baronglock data.baronglock --out restored.txt
```

The package in this repository is a prototype and is **not published just because this source exists**. Until it is published, clone/download the repository and run:

```sh
node src/cli.js --help
node src/cli.js data.txt
node src/cli.js data.baronglock
```

The automatic mode is content-based:
- Input beginning with the `BARONGLOCK` signature is treated as an encrypted file and decrypted.
- Other input is treated as plaintext and encrypted.
- Use explicit `encrypt` or `decrypt` subcommands in scripts where guessing would be undesirable.

## What happens to keys?

On encryption, BarongLock generates a fresh random 32-byte AES key and a fresh 12-byte nonce. The key is saved in a local key store (by default `~/.baronglock/keys/`) with restrictive file permissions where supported. The CLI prints the key ID and key-store path, **not the raw key**.

On decryption, the program reads the key ID from the encrypted file and looks for the matching key in the local key store.

### Decrypt on a different machine

1. On the machine that encrypted the file, export the matching key:

   ```sh
   npx baronglock key export <KEY_ID> --out baronglock-key.json
   ```

2. Transfer `baronglock-key.json` to the destination using a trusted, secure channel. Do not email it unprotected, commit it to Git, upload it beside the encrypted file, or share it publicly.

3. On the destination machine, import it:

   ```sh
   npx baronglock key import baronglock-key.json
   ```

4. Decrypt the file:

   ```sh
   npx baronglock data.baronglock
   ```

Delete temporary exported key files securely according to your operating system and storage policy. A file deletion is not guaranteed to erase all copies on SSDs, backups, or synced storage. For production or team automation, prefer a secret manager or managed key service.

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
- Each encryption uses a random key and a random nonce. A key is used for one file in this implementation, which simplifies nonce management.
- The key ID is not a secret. The key itself is a 32-byte secret and must be protected and backed up.
- The encrypted file is not self-decrypting. Anyone with only the `.baronglock` file cannot decrypt it.
- The prototype stores raw keys in local JSON files with restrictive permissions where supported. This is not equivalent to a hardware-backed key store or a centralized secret manager.
- Anyone who can read a key file can decrypt the corresponding file. Protect key backups and machine accounts.
- Authentication is verified before plaintext is returned by the crypto layer. The CLI buffers the full plaintext before writing it to stdout.
- This prototype is not independently security-audited. Review it before using it for sensitive or production data.
- Do not use the tool as a substitute for backups, access control, endpoint security, or a managed key-management system.
- Automatic detection treats non-BarongLock input as plaintext for encryption. In automation, prefer the explicit `encrypt` and `decrypt` subcommands.

## Development

```sh
npm test
node src/cli.js --help
```

The project has no third-party runtime dependencies. The CLI uses `node:crypto`, filesystem APIs, and standard Node.js streams.

## Publishing

Before publishing:
1. Pick and verify an available npm package name.
2. Review the implementation and threat model.
3. Add end-to-end tests for CLI detection, key import/export, truncated files, malformed headers, and file permissions.
4. Add streaming support or document a maximum file size.
5. Test on supported Windows, macOS, and Linux versions.
6. Publish a versioned release and tag the source repository.
7. Keep the format specification stable and document compatibility changes.

If you found a `.baronglock` file, search for the **BarongLock** repository and follow this README. You will still need the matching key or access to the key service used by whoever created the file.
