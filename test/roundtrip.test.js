import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { encrypt, decrypt } from "../src/crypto.js";

test("round-trips UTF-8 CSV bytes exactly", () => {
  const input = Buffer.from('name,value\r\n"Zoë","hello, world"\r\nemoji,🌍\r\n', "utf8");
  const key = randomBytes(32);
  const { envelope } = encrypt(input, key);
  assert.deepEqual(decrypt(envelope, key), input);
});

test("rejects modified ciphertext", () => {
  const input = Buffer.from("a,b\n1,2\n");
  const key = randomBytes(32);
  const { envelope } = encrypt(input, key);
  envelope[envelope.length - 1] ^= 1;
  assert.throws(() => decrypt(envelope, key));
});

test("rejects wrong key", () => {
  const { envelope } = encrypt(Buffer.from("a,b\n"), randomBytes(32));
  assert.throws(() => decrypt(envelope, randomBytes(32)));
});
