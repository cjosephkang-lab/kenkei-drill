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

  it("日付をまたぐ学習時間をローカル日付ごとに分ける", () => {
    const next = addStudyRecord(empty, { questionId: "a", subject: "zaibun", startedAt: "2026-10-20T23:30:00+09:00", completedAt: "2026-10-21T01:30:00+09:00", score: 10, points: 20 });
    expect(studyMinutesByDay(next.studySessions)).toEqual({ "2026-10-20": 30, "2026-10-21": 30 });
  });

  it("離脱と再開を繰り返しても同じ大問は合計60分で打ち切る", () => {
    const next = addStudyRecord(addStudyRecord(empty, { questionId: "a", subject: "zaibun", startedAt: "2026-10-20T00:00:00Z", completedAt: "2026-10-20T00:45:00Z", score: 10, points: 20 }), { questionId: "a", subject: "zaibun", startedAt: "2026-10-20T01:00:00Z", completedAt: "2026-10-20T01:45:00Z", score: 10, points: 20 });
    expect(studyMinutesByDay(next.studySessions)).toEqual({ "2026-10-20": 60 });
  });

  it("firstLookの初見記録を移行し、最新の復習得点を初見値にしない", () => {
    const legacy: RecordsState = { ...empty, questionRecords: { a: { questionId: "a", subject: "zaibun", answeredAt: "2026-10-20T00:00:00.000Z", score: 8, points: 20, firstLook: true } } };
    saveRecords(legacy);
    const loaded = loadRecords();
    expect(loaded.questionRecords.a.firstLookScore).toBe(8);
    expect(loaded.questionRecords.a.firstLookPoints).toBe(20);
    expect(loaded.questionRecords.a.firstLookAnsweredAt).toBe("2026-10-20T00:00:00.000Z");
  });

  it("不正なインポートは詳細な形式エラーにする", () => {
    expect(() => importRecords(JSON.stringify({ version: 1, records: { questionRecords: [], studySessions: [], mockScores: {}, settings: {} } }))).toThrow("記録ファイルの形式が正しくありません");
  });

  it("保存失敗は例外を呼び出し元へ返す", () => {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { setItem: () => { throw new Error("quota"); }, getItem: () => null } });
    expect(() => saveRecords(empty)).toThrow("quota");
  });
});
