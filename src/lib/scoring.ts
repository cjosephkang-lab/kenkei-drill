import type { Subject } from "./schedule";

export type ScoreItem = { label?: string; answer: string; selected?: string; choices?: string[] };
export type ScoringQuestion = { id: string; subject: Subject; points: number; firstLook: boolean; firstLookScore?: number; firstLookPoints?: number; items: ScoreItem[]; score?: number };

export const autoScoreItems = (items: ScoreItem[]) => {
  const correct = items.filter((item) => item.selected !== undefined && item.selected === item.answer).length;
  return { correct, total: items.length, ratio: items.length === 0 ? 0 : correct / items.length };
};

export const estimateSubjectScore = (questions: ScoringQuestion[], subject: Subject) => {
  const first = questions.filter((question) => question.subject === subject && question.firstLook);
  const points = first.reduce((sum, question) => sum + question.points, 0);
  const earned = first.reduce((sum, question) => sum + (question.firstLookScore ?? question.score ?? autoScoreItems(question.items).ratio * (question.firstLookPoints ?? question.points)), 0);
  return points === 0 ? 0 : Math.round((earned / points) * 1000) / 10;
};

export const countFirstLooks = (questions: ScoringQuestion[], subject: Subject) => questions.filter((question) => question.subject === subject && question.firstLook).length;
