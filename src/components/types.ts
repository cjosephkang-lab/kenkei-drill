import type { IndexData } from "../lib/bundles";
import type { Subject } from "../lib/schedule";
import type { ScoreItem } from "../lib/scoring";

export type FullQuestion = { id: string; examId: string; round: number; subject: Subject; mock?: boolean; no: number; points: number; problem: string[]; answer: string[]; explain: string[]; items: ScoreItem[] };
export type Page = "home" | "study" | "stats" | "mock" | "settings";
export type { IndexData };

export const SUBJECT_LABEL: Record<Subject, string> = { zaibun: "財務分析", zaihyou: "財務諸表", genka: "原価計算" };
