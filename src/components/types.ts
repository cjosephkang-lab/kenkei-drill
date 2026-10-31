import type { IndexData } from "../lib/bundles";
import type { Subject } from "../lib/schedule";
import type { ScoreItem } from "../lib/scoring";
import type { Kyu2Data } from "../lib/kyu2";

export type FullQuestion = {
  id: string;
  examId: string;
  round: number;
  subject: Subject;
  mock?: boolean;
  no: number;
  points: number;
  problem: string[];
  answer: string[];
  explain: string[];
  items: ScoreItem[];
  kyu2?: Kyu2Data;
};
export type Page = "home" | "study" | "cats" | "mock" | "result";
export type { IndexData };

export const SUBJECT_LABEL: Record<Subject, string> = {
  zaibun: "財務分析",
  zaihyou: "財務諸表",
  genka: "原価計算",
  kyu2: "2級",
};

export type Grade = 1 | 2;
// 画面に出す級。1級は 2026-10-31 CEO「1級は非表示にして」で外した（データと記録は残す。戻す時は [1, 2]）
export const SHOWN_GRADES: Grade[] = [2];
export const gradeOf = (subject: Subject): Grade => (subject === "kyu2" ? 2 : 1);
