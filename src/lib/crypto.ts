const PBKDF2_ITERATIONS = 200_000;
const encoder = new TextEncoder();
const asBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
};

const fromBase64 = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", asBuffer(encoder.encode(password)), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: asBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function decryptBundle(data: ArrayBuffer, password: string): Promise<string> {
  const bytes = new Uint8Array(data);
  if (bytes.byteLength < 29) throw new Error("暗号化データが短すぎます");
  const salt = bytes.slice(0, 16);
  const key = await deriveKey(password, salt);
  return decryptBundleWithKey(bytes, key);
}

export async function decryptBundleWithKey(data: ArrayBuffer | Uint8Array, key: CryptoKey): Promise<string> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const iv = bytes.slice(16, 28);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: asBuffer(iv) }, key, asBuffer(bytes.slice(28)));
  return new TextDecoder().decode(plaintext);
}

export async function exportKeyForStorage(key: CryptoKey): Promise<string> {
  return toBase64(new Uint8Array(await crypto.subtle.exportKey("raw", key)));
}

export async function importKeyFromStorage(value: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", asBuffer(fromBase64(value)), { name: "AES-GCM", length: 256 }, true, ["decrypt"]);
}

export { PBKDF2_ITERATIONS };
