import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Result } from "./Result";
import { Today } from "./Today";
import { Question } from "./Question";
import type { FullQuestion } from "./types";

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
const noop = () => {};

describe("画面の回帰", () => {
  it("単一回の範囲・実際の模試科目数・未収録科目・空のモードを表示する", () => {
    const html = renderToStaticMarkup(
      <Today
        index={{
          version: 1,
          examDate: "2027-03-14",
          exams: [
            {
              id: "mock-a",
              round: 39,
              date: "2026-09-01",
              subject: "zaibun",
              mock: true,
              questions: [{ no: 1, points: 20 }],
            },
          ],
        }}
        questions={[question]}
        records={{
          questionRecords: {},
          studySessions: [],
          mockScores: {},
          settings: { dailyGoalMinutes: 60 },
        }}
        days={100}
        todayMinutes={0}
        onStart={noop}
        onMode={noop}
        onNavigate={noop}
        onGoal={noop}
      />,
    );
    expect(html).toContain("過去問（第38回）");
    expect(html).toContain("1 科目");
    expect(html).toContain("収録なし");
    expect(html).not.toContain("0／0題");
    expect(html).toMatch(/class="mode" disabled=""[^>]*><div class="m-t">復習/);
  });

  it("大問の現在位置と全体数から進行表示を計算する", () => {
    const html = renderToStaticMarkup(
      <Question
        question={question}
        selected={{}}
        setSelected={noop}
        revealed={false}
        setRevealed={noop}
        elapsed={0}
        onFinish={noop}
        onBack={noop}
        position={2}
        total={4}
      />,
    );
    expect(html).toContain("2 / 4");
    expect(html).toContain("width:50%");
  });
});

it("結果画面に全問の合計と実際の連続学習日数を表示する", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 30, 12));
  try {
    const sessions = [29, 30].map((day) => ({
      questionId: `q-${day}`,
      subject: "zaibun" as const,
      startedAt: new Date(2026, 9, day, 10).toISOString(),
      completedAt: new Date(2026, 9, day, 10, 2).toISOString(),
      score: 14,
      points: 20,
    }));
    const html = renderToStaticMarkup(
      <Result
        session={{
          queue: [question, { ...question, id: "q2" }],
          index: 2,
          results: [
            { score: 10, points: 20 },
            { score: 14, points: 20 },
          ],
          name: "復習",
        }}
        records={{
          questionRecords: {},
          studySessions: sessions,
          mockScores: {},
          settings: { dailyGoalMinutes: 60 },
        }}
        todayMinutes={2}
        onContinue={noop}
        onHome={noop}
      />,
    );
    expect(html).toContain("60%");
    expect(html).toContain("24 / 40");
    expect(html).toContain("<strong>2</strong><span>解いた大問</span>");
    expect(html).toContain("<strong>2</strong><span>連続学習（日）</span>");
  } finally {
    vi.useRealTimers();
  }
});
