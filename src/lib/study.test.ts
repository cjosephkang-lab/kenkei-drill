import { describe, expect, it } from "vitest";
import { closeOpenStudySegments, startStudy, touchStudy, shouldResumeStudy, type ActiveStudy } from "./study";

const active: ActiveStudy = {
  questionId: "a",
  attemptId: "attempt-1",
  segments: [{ startedAt: "2026-10-20T00:00:00.000Z", lastActiveAt: "2026-10-20T00:10:00.000Z" }],
};

describe("進行中の学習区間", () => {
  it("最終活動時刻で前の区間を閉じてから再開区間を追加する", () => {
    expect(startStudy(active, "a", "2026-10-20T01:00:00.000Z", "attempt-2")).toEqual({
      questionId: "a",
      attemptId: "attempt-1",
      segments: [
        { startedAt: "2026-10-20T00:00:00.000Z", lastActiveAt: "2026-10-20T00:10:00.000Z", completedAt: "2026-10-20T00:10:00.000Z" },
        { startedAt: "2026-10-20T01:00:00.000Z" },
      ],
    });
  });

  it("30秒ごとの保存用に進行中区間の最終活動時刻を更新する", () => {
    expect(touchStudy(active, "2026-10-20T00:10:30.000Z").segments[0].lastActiveAt).toBe("2026-10-20T00:10:30.000Z");
  });

  it("終了処理では未終了区間を最終活動時刻で閉じる", () => {
    expect(closeOpenStudySegments(active, "2026-10-20T01:00:00.000Z").segments[0].completedAt).toBe("2026-10-20T00:10:00.000Z");
  });

  it("学習ページ以外では表示復帰しても再開しない", () => {
    expect(shouldResumeStudy("stats", "visible")).toBe(false);
    expect(shouldResumeStudy("study", "visible")).toBe(true);
  });
});
