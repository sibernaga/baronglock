# BarongLock File Format v1

This document specifies the on-disk envelope implemented in `src/format.js`.

All offsets are byte offsets from the start of the file. Integer fields use one byte; no multi-byte integers are present in version 1.

| Offset | Length | Field |
|---:|---:|---|
| 0 | 10 | ASCII `BARONGLOCK` |
| 10 | 1 | Version byte, currently `0x01` |
| 11 | 16 | Random key ID |
| 27 | 12 | Random AES-GCM nonce |
| 39 | 16 | AES-GCM authentication tag |
| 55 | rest | Ciphertext |

AAD is exactly `magic || version || key_id`. The cipher is AES-256-GCM with a 128-bit authentication tag. The key ID maps to a separately managed 32-byte key. Version 1 has no compression and does not transform plaintext bytes.

A parser must reject unknown versions, truncated headers, missing keys, and failed authentication. It must not emit plaintext before successful authentication. Do not change this layout in-place; introduce a new version for incompatible changes.
