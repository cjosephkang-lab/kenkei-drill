export type Subject = "zaibun" | "zaihyou" | "genka" | "kyu2";
export const SUBJECT_ORDER: Subject[] = ["zaibun", "zaihyou", "genka", "kyu2"];

export type ScheduleQuestion = {
  id: string;
  subject: Subject;
  examId: string;
  round: number;
  no: number;
  points: number;
  mock?: boolean;
};
export type QuestionRecord = {
  answeredAt: string;
  nextReviewAt?: string;
  score: number;
  firstLook?: boolean;
};

export const nextReviewDays = (ratio: number, successfulReviews: number) => {
  if (ratio < 0.7) return 1;
  return [3, 7, 14, 30][Math.min(successfulReviews, 3)];
};

export const orderTodayQuestions = (
  questions: ScheduleQuestion[],
  records: Record<string, QuestionRecord>,
  now = new Date(),
) => {
  const eligible = questions.filter((question) => !question.mock);
  const due = eligible.filter((question) => {
    const next = records[question.id]?.nextReviewAt;
    return Boolean(next && new Date(next).getTime() <= now.getTime());
  });
  const untouched = eligible.filter((question) => !records[question.id]);
  const sort = (a: ScheduleQuestion, b: ScheduleQuestion) => {
    const subject =
      SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject);
    return subject || b.round - a.round || a.no - b.no;
  };
  return [...due.sort(sort), ...untouched.sort(sort)];
};

export type QueueMode = "today" | "review" | "unsolved" | "subject";

const isDue = (
  question: ScheduleQuestion,
  records: Record<string, QuestionRecord>,
  now: Date,
) => {
  const next = records[question.id]?.nextReviewAt;
  return Boolean(next && new Date(next).getTime() <= now.getTime());
};

const availableQuestions = (questions: ScheduleQuestion[]) =>
  questions.filter((question) => !question.mock);

export const queueFor = (
  mode: QueueMode,
  questions: ScheduleQuestion[],
  records: Record<string, QuestionRecord>,
  now = new Date(),
  subject?: Subject,
  no?: number,
) => {
  if (mode === "today") return orderTodayQuestions(questions, records, now);
  const eligible = availableQuestions(questions).filter(
    (question) =>
      mode !== "subject" ||
      (question.subject === subject && (no === undefined || question.no === no)),
  );
  const sort = (a: ScheduleQuestion, b: ScheduleQuestion) => {
    const subjectOrder =
      SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject);
    return subjectOrder || b.round - a.round || a.no - b.no;
  };
  if (mode === "review")
    return eligible
      .filter((question) => isDue(question, records, now))
      .sort(sort);
  if (mode === "unsolved")
    return eligible.filter((question) => !records[question.id]).sort(sort);
  const due = eligible
    .filter((question) => isDue(question, records, now))
    .sort(sort);
  const untouched = eligible
    .filter((question) => !records[question.id])
    .sort(sort);
  const rest = eligible
    .filter(
      (question) => records[question.id] && !isDue(question, records, now),
    )
    .sort(sort);
  return [...due, ...untouched, ...rest];
};

export const countModes = (
  questions: ScheduleQuestion[],
  records: Record<string, QuestionRecord>,
  now = new Date(),
) => {
  const eligible = availableQuestions(questions);
  return {
    review: eligible.filter((question) => isDue(question, records, now)).length,
    unsolved: eligible.filter((question) => !records[question.id]).length,
  };
};
