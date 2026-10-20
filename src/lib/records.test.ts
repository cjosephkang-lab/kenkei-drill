import { beforeEach, describe, expect, it } from "vitest";
import { addStudyRecord, exportRecords, importRecords, loadRecords, saveRecords, studyMinutesByDay, type RecordsState } from "./records";

const empty: RecordsState = { questionRecords: {}, studySessions: [], mockScores: {}, settings: { dailyGoalMinutes: 60 } };
beforeEach(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
    clear: () => data.clear(),
  } });
});

describe("localStorage記録", () => {
  it("読み書きと書き出し/読み込みができる", () => {
    saveRecords(empty); expect(loadRecords()).toEqual(empty);
    expect(importRecords(exportRecords(empty))).toEqual(empty);
  });
  it("1大問あたり60分で日別学習時間を打ち切る", () => {
    const next = addStudyRecord(empty, { questionId: "a", subject: "zaibun", startedAt: "2026-10-20T00:00:00Z", completedAt: "2026-10-20T02:00:00Z", score: 10, points: 20 });
    expect(studyMinutesByDay(next.studySessions)["2026-10-20"]).toBe(60);
  });
});
