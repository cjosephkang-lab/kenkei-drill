import { mkdir, writeFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";

const encoder = new TextEncoder();
const output = new URL("../public/data-fixture/", import.meta.url);
const exams = [
  { id: "38b", round: 38, date: "2026-03-15", subject: "zaibun", mock: false },
  { id: "39b", round: 39, date: "2026-09-13", subject: "zaibun", mock: true },
  { id: "38h", round: 38, date: "2026-03-15", subject: "zaihyou", mock: false },
  { id: "39h", round: 39, date: "2026-09-13", subject: "zaihyou", mock: true },
];
const svg = (title, color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="${color}"/><text x="32" y="90" font-family="sans-serif" font-size="30" fill="white">${title}</text><text x="32" y="150" font-family="sans-serif" font-size="20" fill="white">fixture / sample image</text></svg>`)}`;
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const material = await webcrypto.subtle.importKey("raw", encoder.encode("test"), "PBKDF2", false, ["deriveKey"]);
const key = await webcrypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 200000, hash: "SHA-256" }, material, { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
await mkdir(output, { recursive: true });
const index = { version: 1, examDate: "2027-03-14", exams: exams.map((exam) => ({ ...exam, questions: [{ no: 1, points: 20 }] })) };
await writeFile(new URL("index.json", output), JSON.stringify(index, null, 2));
for (const exam of exams) {
  const body = { id: exam.id, questions: [{ no: 1, points: 20, problem: [svg(`${exam.subject} 第${exam.round}回 問題`, "#1f6b4f")], answer: [svg("解答", "#295f91")], explain: [svg("解説", "#8b5d25")], items: [{ label: "1", answer: "ア", choices: ["ア", "イ", "ウ", "エ"] }, { label: "2", answer: "イ", choices: ["ア", "イ", "ウ", "エ"] }] }] };
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(body))));
  const bundle = new Uint8Array(16 + 12 + encrypted.length); bundle.set(salt); bundle.set(iv, 16); bundle.set(encrypted, 28);
  await writeFile(new URL(`${exam.id}.bin`, output), bundle);
}
console.log(`Wrote fixture to ${output.pathname}`);
