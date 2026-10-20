import { beforeAll, describe, expect, it } from "vitest";
import { webcrypto } from "node:crypto";
import {
  decryptBundle,
  exportKeyForStorage,
  importKeyFromStorage,
  deriveKey,
} from "./crypto";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
});

describe("AES-GCM bundle", () => {
  it("salt‖iv‖ciphertext を復号できる", async () => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey("test", salt);
    const plaintext = new TextEncoder().encode('{"id":"39b"}');
    const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext));
    const bundle = new Uint8Array(salt.length + iv.length + ciphertext.length);
    bundle.set(salt, 0); bundle.set(iv, salt.length); bundle.set(ciphertext, salt.length + iv.length);
    await expect(decryptBundle(bundle.buffer, "test")).resolves.toBe('{"id":"39b"}');
  });

  it("パスワード違いは失敗する", async () => {
    const salt = webcrypto.getRandomValues(new Uint8Array(16));
    const iv = webcrypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey("test", salt);
    const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode("ok")));
    const bundle = new Uint8Array(28 + ciphertext.length); bundle.set(salt); bundle.set(iv, 16); bundle.set(ciphertext, 28);
    await expect(decryptBundle(bundle.buffer, "wrong")).rejects.toThrow();
  });

  it("鍵を localStorage 用文字列にして往復できる", async () => {
    const key = await deriveKey("test", webcrypto.getRandomValues(new Uint8Array(16)));
    const stored = await exportKeyForStorage(key);
    const imported = await importKeyFromStorage(stored);
    await expect(webcrypto.subtle.exportKey("raw", imported)).resolves.toBeInstanceOf(ArrayBuffer);
  });
});
