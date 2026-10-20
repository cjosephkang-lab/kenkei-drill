export type Subject = "zaibun" | "zaihyou" | "genka";
export const SUBJECT_ORDER: Subject[] = ["zaibun", "zaihyou", "genka"];

export type ScheduleQuestion = { id: string; subject: Subject; examId: string; round: number; no: number; points: number; mock?: boolean };
export type QuestionRecord = { answeredAt: string; nextReviewAt?: string; score: number; firstLook?: boolean };

export const nextReviewDays = (ratio: number, successfulReviews: number) => {
  if (ratio < 0.7) return 1;
  return [3, 7, 14, 30][Math.min(successfulReviews, 3)];
};

export const orderTodayQuestions = (questions: ScheduleQuestion[], records: Record<string, QuestionRecord>, now = new Date()) => {
  const eligible = questions.filter((question) => !question.mock);
  const due = eligible.filter((question) => {
    const next = records[question.id]?.nextReviewAt;
    return Boolean(next && new Date(next).getTime() <= now.getTime());
  });
  const untouched = eligible.filter((question) => !records[question.id]);
  const sort = (a: ScheduleQuestion, b: ScheduleQuestion) => {
    const subject = SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject);
    return subject || b.round - a.round || a.no - b.no;
  };
  return [...due.sort(sort), ...untouched.sort(sort)];
};
