# BarongLock File Format

This document specifies the on-disk envelope implemented in `src/format.js`. There are two versions. The version byte says which header follows:

- **Version 1:** the key is a random 32-byte key kept in a key store, found by its key ID.
- **Version 2:** the key is made from a password with scrypt.

All offsets are byte offsets from the start of the file. Integer fields use one byte; no multi-byte integers are present.

## Version 1: stored key

| Offset | Length | Field |
|---:|---:|---|
| 0 | 10 | ASCII `BARONGLOCK` |
| 10 | 1 | Version byte `0x01` |
| 11 | 16 | Random key ID |
| 27 | 12 | Random AES-GCM nonce |
| 39 | 16 | AES-GCM authentication tag |
| 55 | rest | Ciphertext |

AAD is exactly `magic || version || key_id` (bytes 0–26). The key ID maps to a separately managed 32-byte key.

## Version 2: password

| Offset | Length | Field |
|---:|---:|---|
| 0 | 10 | ASCII `BARONGLOCK` |
| 10 | 1 | Version byte `0x02` |
| 11 | 1 | Password method: `0x01` = scrypt |
| 12 | 1 | scrypt cost as log2(N). New files use 17 (N = 131072) |
| 13 | 1 | scrypt block size r. New files use 8 |
| 14 | 1 | scrypt parallelism p. New files use 1 |
| 15 | 16 | Random salt |
| 31 | 12 | Random AES-GCM nonce |
| 43 | 16 | AES-GCM authentication tag |
| 59 | rest | Ciphertext |

The key is `scrypt(password, salt, 32 bytes, N, r, p)`. The password is the UTF-8 encoding of its Unicode NFC form, so the same password typed on different systems gives the same key.

AAD is bytes 0–30: magic, version, method, scrypt settings and salt. Changing any of them makes authentication fail.

A reader must refuse settings that are too weak or too costly before running scrypt, because they come from the file. This implementation refuses log2(N) below 10, p above 4, and settings needing more than 1 GiB (`128 * N * r` bytes).

## Both versions

The cipher is AES-256-GCM with a 128-bit authentication tag. There is no compression, and plaintext bytes are not transformed.

A file saved again after editing keeps its header up to the nonce (same key ID, or same password settings and salt) and gets a fresh random nonce.

A parser must reject unknown versions, unknown password methods, truncated headers, missing keys, and failed authentication. It must not emit plaintext before successful authentication. Do not change a layout in place; introduce a new version for incompatible changes.
