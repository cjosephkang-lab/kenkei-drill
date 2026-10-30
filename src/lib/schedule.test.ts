import { describe, expect, it } from "vitest";
import {
  countModes,
  nextReviewDays,
  orderTodayQuestions,
  queueFor,
  type ScheduleQuestion,
  type QuestionRecord,
} from "./schedule";

describe("復習スケジュール", () => {
  it("70%以上は3→7→14→30日、未満は翌日", () => {
    expect([0, 1, 2, 3, 4].map((n) => nextReviewDays(0.7, n))).toEqual([
      3, 7, 14, 30, 30,
    ]);
    expect(nextReviewDays(0.69, 3)).toBe(1);
  });
});

describe("今日やる順", () => {
  const questions: ScheduleQuestion[] = [
    {
      id: "mock",
      subject: "zaibun",
      examId: "39b",
      round: 39,
      no: 1,
      points: 20,
      mock: true,
    },
    {
      id: "old",
      subject: "zaihyou",
      examId: "38a",
      round: 38,
      no: 1,
      points: 20,
      mock: false,
    },
    {
      id: "new",
      subject: "zaibun",
      examId: "38b",
      round: 38,
      no: 2,
      points: 20,
      mock: false,
    },
    {
      id: "due",
      subject: "zaibun",
      examId: "37a",
      round: 37,
      no: 1,
      points: 20,
      mock: false,
    },
  ];
  const records: Record<string, QuestionRecord> = {
    due: {
      answeredAt: "2026-10-18T00:00:00Z",
      nextReviewAt: "2026-10-19T00:00:00Z",
      score: 10,
    },
  };

  it("期限到来→未着手、科目順、各科目は新しい回から、mock除外", () => {
    expect(
      orderTodayQuestions(
        questions,
        records,
        new Date("2026-10-20T00:00:00Z"),
      ).map((q) => q.id),
    ).toEqual(["due", "new", "old"]);
  });

  it("モード別に期限・未着手・科目のキューを作る", () => {
    expect(
      queueFor(
        "review",
        questions,
        records,
        new Date("2026-10-20T00:00:00Z"),
      ).map((q) => q.id),
    ).toEqual(["due"]);
    expect(
      queueFor(
        "unsolved",
        questions,
        records,
        new Date("2026-10-20T00:00:00Z"),
      ).map((q) => q.id),
    ).toEqual(["new", "old"]);
    expect(
      queueFor(
        "subject",
        questions,
        records,
        new Date("2026-10-20T00:00:00Z"),
        "zaibun",
      ).map((q) => q.id),
    ).toEqual(["due", "new"]);
  });

  it("復習と未着手の件数を返す", () => {
    expect(
      countModes(questions, records, new Date("2026-10-20T00:00:00Z")),
    ).toEqual({ review: 1, unsolved: 2 });
  });
});
