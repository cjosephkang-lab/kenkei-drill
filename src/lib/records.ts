import type { Subject } from "./schedule";

export type QuestionRecord = { questionId: string; subject: Subject; answeredAt: string; nextReviewAt?: string; score: number; points: number; firstLook: boolean; firstLookScore?: number; firstLookPoints?: number; firstLookAnsweredAt?: string; streak?: number };
export type StudySession = { questionId: string; subject: Subject; attemptId?: string; startedAt: string; completedAt: string; score: number; points: number };
export type RecordsState = { version?: 1; questionRecords: Record<string, QuestionRecord>; studySessions: StudySession[]; mockScores: Record<string, number>; settings: { dailyGoalMinutes: number } };
export const RECORDS_KEY = "kenkei-drill.records.v1";
export const RECORDS_BACKUP_KEY = "kenkei-drill.records.invalid-backup.v1";
const fallback: RecordsState = { questionRecords: {}, studySessions: [], mockScores: {}, settings: { dailyGoalMinutes: 60 } };

const migrate = (value: RecordsState): RecordsState => ({ ...fallback, ...value, questionRecords: Object.fromEntries(Object.entries(value.questionRecords).map(([id, record]) => [id, {
  ...record,
  ...(record.firstLook && record.firstLookScore === undefined ? { firstLookScore: record.score, firstLookPoints: record.points, firstLookAnsweredAt: record.answeredAt } : {}),
}])) });

const isRecordState = (value: unknown): value is RecordsState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<RecordsState>;
  if (candidate.version !== undefined && candidate.version !== 1) return false;
  if (!candidate.questionRecords || typeof candidate.questionRecords !== "object" || Array.isArray(candidate.questionRecords)) return false;
  if (!Array.isArray(candidate.studySessions) || !candidate.mockScores || typeof candidate.mockScores !== "object" || !candidate.settings || typeof candidate.settings.dailyGoalMinutes !== "number") return false;
  return Object.values(candidate.questionRecords).every((record) => Boolean(record && typeof record === "object" && typeof record.score === "number" && typeof record.points === "number" && record.score >= 0 && record.score <= record.points));
};

export const loadRecords = (): RecordsState => {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isRecordState(parsed) ? migrate(parsed) : fallback;
  } catch { return fallback; }
};
export const saveRecords = (records: RecordsState) => localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
export const exportRecords = (records: RecordsState) => JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), records }, null, 2);
export const importRecords = (text: string): RecordsState => {
  const parsed: unknown = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !("records" in parsed) || (parsed as { version?: unknown }).version !== 1 || !isRecordState((parsed as { records: unknown }).records)) throw new Error("記録ファイルの形式が正しくありません");
  return migrate((parsed as { records: RecordsState }).records);
};
export const addStudyRecord = (records: RecordsState, session: StudySession): RecordsState => ({ ...records, studySessions: [...records.studySessions, session] });
const localDateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const studyMinutesByDay = (sessions: StudySession[]) => {
  const remainingByAttempt: Record<string, number> = {};
  return sessions.reduce<Record<string, number>>((days, session) => {
    const start = new Date(session.startedAt).getTime();
    const end = new Date(session.completedAt).getTime();
    const attemptKey = session.attemptId ?? session.questionId;
    const remaining = remainingByAttempt[attemptKey] ?? 60 * 60000;
    const cappedEnd = Math.min(end, start + remaining);
    if (!Number.isFinite(start) || !Number.isFinite(cappedEnd) || cappedEnd <= start || remaining <= 0) return days;
    remainingByAttempt[attemptKey] = remaining - (cappedEnd - start);
    let cursor = new Date(start);
    while (cursor.getTime() < cappedEnd) {
      const nextMidnight = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1).getTime();
      const segmentEnd = Math.min(cappedEnd, nextMidnight);
      const day = localDateKey(cursor);
      days[day] = (days[day] ?? 0) + (segmentEnd - cursor.getTime()) / 60000;
      cursor = new Date(segmentEnd);
    }
    return days;
  }, {});
};
