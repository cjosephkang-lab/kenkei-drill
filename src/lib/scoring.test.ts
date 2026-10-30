import { describe, expect, it } from "vitest";
import {
  autoScoreItems,
  estimateSubjectScore,
  countFirstLooks,
  sessionScore,
  type ScoringQuestion,
} from "./scoring";

const q = (
  id: string,
  subject: ScoringQuestion["subject"],
  points: number,
  firstLook: boolean,
  answer: string,
  selected: string,
): ScoringQuestion => ({
  id,
  subject,
  points,
  firstLook,
  items: [{ answer, selected }],
});

describe("採点", () => {
  it("itemsを自動採点する", () =>
    expect(
      autoScoreItems([
        { answer: "ア", selected: "ア" },
        { answer: "イ", selected: "ロ" },
      ]),
    ).toEqual({ correct: 1, total: 2, ratio: 0.5 }));
  it("初見だけで科目別予想点と初見大問数を出す", () => {
    const questions = [
      q("a", "zaibun", 20, true, "ア", "ア"),
      q("b", "zaibun", 30, false, "ア", "ロ"),
      q("c", "zaibun", 50, true, "ア", "ロ"),
    ];
    expect(estimateSubjectScore(questions, "zaibun")).toBe(28.6);
    expect(countFirstLooks(questions, "zaibun")).toBe(2);
  });

  it("itemsが画像問題と併存しても記号正解率から初期提案点を計算する", () => {
    expect(
      autoScoreItems([
        { answer: "ア", selected: "ア" },
        { answer: "イ", selected: "ロ" },
        { answer: "ウ", selected: "ウ" },
      ]),
    ).toEqual({ correct: 2, total: 3, ratio: 2 / 3 });
  });

  it("最新得点ではなく固定した初見得点だけで予想点を計算する", () => {
    const questions = [
      {
        id: "a",
        subject: "zaibun" as const,
        points: 20,
        firstLook: true,
        score: 0,
        firstLookScore: 20,
        firstLookPoints: 20,
        items: [],
      },
      {
        id: "b",
        subject: "zaibun" as const,
        points: 30,
        firstLook: true,
        score: 0,
        firstLookScore: 10,
        firstLookPoints: 30,
        items: [],
      },
    ];
    expect(estimateSubjectScore(questions, "zaibun")).toBe(60);
  });

  it("まとまりの得点率を計算し、配点0は0にする", () => {
    expect(
      sessionScore([
        { score: 14, points: 20 },
        { score: 6, points: 10 },
      ]),
    ).toBe(2 / 3);
    expect(sessionScore([])).toBe(0);
  });
});
