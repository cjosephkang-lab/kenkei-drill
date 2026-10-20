import type { Subject } from "./schedule";

export type QuestionRecord = { questionId: string; subject: Subject; answeredAt: string; nextReviewAt?: string; score: number; points: number; firstLook: boolean; streak?: number };
export type StudySession = { questionId: string; subject: Subject; startedAt: string; completedAt: string; score: number; points: number };
export type RecordsState = { questionRecords: Record<string, QuestionRecord>; studySessions: StudySession[]; mockScores: Record<string, number>; settings: { dailyGoalMinutes: number } };
export const RECORDS_KEY = "kenkei-drill.records.v1";
const fallback: RecordsState = { questionRecords: {}, studySessions: [], mockScores: {}, settings: { dailyGoalMinutes: 60 } };

export const loadRecords = (): RecordsState => {
  try { const raw = localStorage.getItem(RECORDS_KEY); return raw ? { ...fallback, ...JSON.parse(raw) } : fallback; } catch { return fallback; }
};
export const saveRecords = (records: RecordsState) => localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
export const exportRecords = (records: RecordsState) => JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2);
export const importRecords = (text: string): RecordsState => {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !("records" in parsed)) throw new Error("記録ファイルの形式が正しくありません");
  return (parsed as { records: RecordsState }).records;
};
export const addStudyRecord = (records: RecordsState, session: StudySession): RecordsState => ({ ...records, studySessions: [...records.studySessions, session] });
export const studyMinutesByDay = (sessions: StudySession[]) => sessions.reduce<Record<string, number>>((days, session) => {
  const day = session.startedAt.slice(0, 10);
  const minutes = Math.min(60, Math.max(0, (new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 60000));
  days[day] = (days[day] ?? 0) + minutes;
  return days;
}, {});
