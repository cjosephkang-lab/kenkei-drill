import { describe, expect, it } from "vitest";
import {
  advanceSession,
  backSession,
  completeQuestion,
  forwardSession,
  reviewing,
  type SessionState,
} from "./session";
import type { FullQuestion } from "../components/types";
import type { RecordsState } from "./records";

const question: FullQuestion = {
  id: "38-a-1",
  examId: "38-a",
  round: 38,
  subject: "zaibun",
  no: 1,
  points: 20,
  problem: [],
  answer: [],
  explain: [],
  items: [],
};
const records: RecordsState = {
  questionRecords: {},
  studySessions: [],
  mockScores: {},
  settings: { dailyGoalMinutes: 60 },
};
const now = "2026-10-30T01:10:00.000Z";
const active = {
  questionId: question.id,
  attemptId: "original",
  segments: [{ startedAt: "2026-10-30T01:00:00.000Z" }],
};

describe("まとまりの進行", () => {
  it("次の大問でも元のqueueと名前を保ち、全問の点数を蓄積する", () => {
    const second = { ...question, id: "38-a-2", no: 2 };
    const initial: SessionState = {
      queue: [question, second],
      index: 0,
      results: [],
      name: "復習",
    };
    const next = advanceSession(initial, { score: 10, points: 20 });
    expect(next.queue).toEqual([question, second]);
    expect(next.index).toBe(1);
    expect(next.name).toBe("復習");
    const done = advanceSession(next, { score: 14, points: 20 });
    expect(done.index).toBe(2);
    expect(done.results).toEqual([
      { score: 10, points: 20 },
      { score: 14, points: 20 },
    ]);
  });
});

describe("解答記録", () => {
  it("70%以上の成功回数を保存し、3・7・14・30日後に復習を広げる", () => {
    let state = records;
    for (const [streak, date] of [
      [1, "2026-11-02"],
      [2, "2026-11-06"],
      [3, "2026-11-13"],
      [4, "2026-11-29"],
    ] as const) {
      state = completeQuestion(
        state,
        question,
        14,
        active,
        active.segments[0].startedAt,
        now,
      );
      expect(state.questionRecords[question.id].streak).toBe(streak);
      expect(state.questionRecords[question.id].nextReviewAt).toBe(
        `${date}T01:10:00.000Z`,
      );
    }
    state = completeQuestion(
      state,
      question,
      13,
      active,
      active.segments[0].startedAt,
      now,
    );
    expect(state.questionRecords[question.id].streak).toBe(0);
    expect(state.questionRecords[question.id].nextReviewAt).toBe(
      "2026-10-31T01:10:00.000Z",
    );
  });

  it("初見の得点を復習で上書きせず、legacyのfirstLook=trueにも初見値を補う", () => {
    const first = completeQuestion(
      records,
      question,
      8,
      active,
      active.segments[0].startedAt,
      now,
    );
    const reviewed = completeQuestion(
      first,
      question,
      20,
      active,
      active.segments[0].startedAt,
      now,
    );
    expect(reviewed.questionRecords[question.id].firstLookScore).toBe(8);
    const legacy = {
      ...records,
      questionRecords: {
        [question.id]: {
          ...first.questionRecords[question.id],
          firstLookScore: undefined,
        },
      },
    };
    expect(
      completeQuestion(
        legacy,
        question,
        14,
        active,
        active.segments[0].startedAt,
        now,
      ).questionRecords[question.id].firstLookScore,
    ).toBe(14);
  });

  it("firstLook=falseには初見値を作らず、再開したattemptIdと全区間を記録する", () => {
    const previous = completeQuestion(
      records,
      question,
      8,
      active,
      active.segments[0].startedAt,
      now,
    );
    previous.questionRecords[question.id].firstLook = false;
    delete previous.questionRecords[question.id].firstLookScore;
    const resumed = {
      ...active,
      segments: [
        {
          startedAt: "2026-10-30T00:00:00.000Z",
          completedAt: "2026-10-30T00:05:00.000Z",
        },
        ...active.segments,
      ],
    };
    const result = completeQuestion(
      { ...previous, studySessions: [] },
      question,
      20,
      resumed,
      active.segments[0].startedAt,
      now,
    );
    expect(result.questionRecords[question.id].firstLookScore).toBeUndefined();
    expect(
      result.studySessions.map((s) => [s.attemptId, s.completedAt]),
    ).toEqual([
      ["original", "2026-10-30T00:05:00.000Z"],
      ["original", now],
    ]);
  });
});

describe("前の問題に戻る", () => {
  const three: SessionState = {
    queue: [question, { ...question, id: "b" }, { ...question, id: "c" }],
    index: 2,
    results: [
      { score: 10, points: 20 },
      { score: 20, points: 20 },
    ],
    name: "今日の学習",
  };

  it("1つ前に戻ると、記録済みの大問を振り返る画面になる", () => {
    const back = backSession(three);
    expect(back.index).toBe(1);
    expect(reviewing(back)).toBe(true);
    expect(back.results).toEqual(three.results); // 戻っても結果は消さない
  });

  it("最初の大問より前には戻らない", () => {
    expect(backSession({ ...three, index: 0 }).index).toBe(0);
  });

  it("振り返りから進むと、まだ解いていない大問に戻り、その先へは記録なしで進まない", () => {
    const back = backSession(backSession(three));
    expect(back.index).toBe(0);
    const once = forwardSession(back);
    expect(once.index).toBe(1);
    expect(reviewing(once)).toBe(true);
    const twice = forwardSession(once);
    expect(twice.index).toBe(2);
    expect(reviewing(twice)).toBe(false);
    expect(forwardSession(twice).index).toBe(2);
  });
});
