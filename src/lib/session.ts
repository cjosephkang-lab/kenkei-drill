import type { FullQuestion } from "../components/types";
import { addStudyRecord, type RecordsState } from "./records";
import { nextReviewDays } from "./schedule";
import type { ActiveStudy } from "./study";

export type SessionResult = { score: number; points: number };
export type SessionState = {
  queue: FullQuestion[];
  index: number;
  results: SessionResult[];
  name: string;
};
export const advanceSession = (
  session: SessionState,
  result: SessionResult,
): SessionState => ({
  ...session,
  index: session.index + 1,
  results: [...session.results, result],
});
export function completeQuestion(
  records: RecordsState,
  current: FullQuestion,
  value: number,
  activeStudy: ActiveStudy | null,
  startedAt: string,
  now: string,
): RecordsState {
  const previous = records.questionRecords[current.id];
  const ratio = current.points ? value / current.points : 0;
  const nextReview = new Date(
    new Date(now).getTime() +
      nextReviewDays(ratio, previous?.streak ?? 0) * 86400000,
  ).toISOString();
  const record = {
    questionId: current.id,
    subject: current.subject,
    answeredAt: now,
    nextReviewAt: nextReview,
    score: value,
    points: current.points,
    firstLook: previous?.firstLook ?? true,
    streak: ratio >= 0.7 ? (previous?.streak ?? 0) + 1 : 0,
    ...(previous?.firstLookScore !== undefined
      ? {
          firstLookScore: previous.firstLookScore,
          firstLookPoints: previous.firstLookPoints,
          firstLookAnsweredAt: previous.firstLookAnsweredAt,
        }
      : (previous?.firstLook ?? true)
        ? {
            firstLookScore: value,
            firstLookPoints: current.points,
            firstLookAnsweredAt: now,
          }
        : {}),
  };
  const matchingStudy =
    activeStudy?.questionId === current.id ? activeStudy : null;
  const attemptId = matchingStudy?.attemptId ?? crypto.randomUUID();
  const segments = (matchingStudy?.segments ?? [{ startedAt }]).map(
    (segment, i, all) =>
      i === all.length - 1 && !segment.completedAt
        ? { ...segment, completedAt: now }
        : segment,
  );
  const updated = segments.reduce(
    (state, segment) =>
      segment.completedAt
        ? addStudyRecord(state, {
            questionId: current.id,
            subject: current.subject,
            attemptId,
            startedAt: segment.startedAt,
            completedAt: segment.completedAt,
            score: value,
            points: current.points,
          })
        : state,
    {
      ...records,
      questionRecords: { ...records.questionRecords, [current.id]: record },
    },
  );
  return updated;
}
