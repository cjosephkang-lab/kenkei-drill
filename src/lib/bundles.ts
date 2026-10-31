import { decryptBundleWithKey, deriveKey } from "./crypto";
import type { Subject } from "./schedule";
import type { Kyu2Data } from "./kyu2";

export type IndexQuestion = { no: number; points: number };
export type IndexExam = { id: string; round: number; date: string; subject: Subject; mock?: boolean; questions: IndexQuestion[] };
export type IndexData = { version: number; examDate: string; exams: IndexExam[] };
export type BundleQuestion = { no: number; points: number; problem: string[]; answer: string[]; explain: string[]; items: { label?: string; answer: string; choices?: string[] }[]; kyu2?: Kyu2Data };
export type ExamBundle = { id: string; questions: BundleQuestion[] };

const cache = new Map<string, Promise<ExamBundle>>();

const checkedJson = async <T>(response: Response): Promise<T> => {
  if (!response.ok) throw new Error(`データ取得に失敗しました: ${response.status}`);
  return response.json() as Promise<T>;
};

export const loadIndex = async (dataBaseUrl: string): Promise<IndexData> => {
  const response = await fetch(`${dataBaseUrl}/index.json`);
  return checkedJson<IndexData>(response);
};

export const loadExamBundle = (dataBaseUrl: string, exam: IndexExam, key: CryptoKey): Promise<ExamBundle> => {
  const cached = cache.get(exam.id);
  if (cached) return cached;
  const request = fetch(`${dataBaseUrl}/${exam.id}.bin`)
    .then((response) => {
      if (!response.ok) throw new Error(`データ束の取得に失敗しました: ${response.status}`);
      return response.arrayBuffer();
    })
    .then((raw) => decryptBundleWithKey(raw, key))
    .then((text) => JSON.parse(text) as ExamBundle);
  cache.set(exam.id, request);
  return request;
};

export const verifyPassword = async (dataBaseUrl: string, exam: IndexExam, password: string): Promise<CryptoKey> => {
  const response = await fetch(`${dataBaseUrl}/${exam.id}.bin`);
  if (!response.ok) throw new Error(`データ束の取得に失敗しました: ${response.status}`);
  const raw = await response.arrayBuffer();
  const salt = new Uint8Array(raw.slice(0, 16));
  const key = await deriveKey(password, salt);
  const bundle = JSON.parse(await decryptBundleWithKey(raw, key)) as ExamBundle;
  cache.set(exam.id, Promise.resolve(bundle));
  return key;
};

export const clearBundleCache = () => cache.clear();
