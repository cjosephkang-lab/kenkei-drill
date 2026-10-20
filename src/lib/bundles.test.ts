import { beforeAll, afterEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { deriveKey } from "./crypto";
import { clearBundleCache, loadExamBundle, loadIndex, type IndexExam } from "./bundles";

beforeAll(() => {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
});

afterEach(() => {
  clearBundleCache();
  vi.restoreAllMocks();
});

const exam: IndexExam = { id: "38b", round: 38, date: "2026-03-15", subject: "zaibun", questions: [{ no: 1, points: 20 }] };

async function encryptedBundle() {
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey("test", salt);
  const plaintext = JSON.stringify({ id: "38b", questions: [{ no: 1, points: 20, problem: ["problem"], answer: [], explain: [], items: [] }] });
  const ciphertext = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  const bundle = new Uint8Array(28 + ciphertext.length);
  bundle.set(salt); bundle.set(iv, 16); bundle.set(ciphertext, 28);
  return bundle.buffer;
}

describe("data bundle loading", () => {
  it("index.jsonだけを取得して、exam bundleを取得しない", async () => {
    const index = { version: 1, examDate: "2027-03-14", exams: [exam] };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(index)));

    await expect(loadIndex("/data")).resolves.toEqual(index);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/data/index.json");
  });

  it("同じ回のbundleはメモリキャッシュし、二度取得・復号しない", async () => {
    const bundle = await encryptedBundle();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(bundle));
    const key = await deriveKey("test", new Uint8Array(bundle.slice(0, 16)));

    const first = await loadExamBundle("/data", exam, key);
    const second = await loadExamBundle("/data", exam, key);

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(first.questions[0].problem).toEqual(["problem"]);
  });
});
