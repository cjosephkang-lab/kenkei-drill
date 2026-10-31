import { describe, expect, it } from "vitest";
import type { Kyu2Data } from "./kyu2";
import { askPrompt, askUrl, explainByPart } from "./kyu2Explain";

const data: Kyu2Data = {
  title: "仕訳",
  problem: [
    { t: "p", text: "次の取引を仕訳しなさい。" },
    {
      t: "choices",
      title: "勘定科目群",
      items: [
        ["Ａ", "現金"],
        ["Ｂ", "当座預金"],
        ["Ｓ", "社債"],
      ],
    },
  ],
  parts: [
    {
      kind: "journal",
      label: "(1)",
      prompt: "現金を預け入れた。",
      debit: [["Ｂ", 100]],
      credit: [["Ａ", 100]],
    },
    {
      kind: "number",
      label: "(2)",
      prompt: "利益は￥【　】である。",
      prefix: "￥",
      a: 10800,
    },
  ],
  explain: [
    {
      label: "(2)",
      title: "利益",
      blocks: [{ t: "p", text: "売上から原価を引く。" }],
    },
    {
      label: "1.",
      blocks: [
        {
          t: "table",
          rows: [
            ["借方", "金額"],
            ["現金", "100"],
          ],
        },
      ],
    },
    {
      label: "(1)",
      title: "預け入れ",
      blocks: [{ t: "p", text: "当座預金が増える。" }],
    },
  ],
};

describe("解説を答える欄に割り当てる", () => {
  it("label が同じ欄の下に出し、合わない物は最後にまとめる", () => {
    const { byPart, rest } = explainByPart(data);
    expect(byPart.get(0)?.map((s) => s.title)).toEqual(["預け入れ"]);
    expect(byPart.get(1)?.map((s) => s.title)).toEqual(["利益"]);
    expect(rest.map((s) => s.label)).toEqual(["1."]);
  });

  it("「問２」の解説は「問２ 1」〜「問２ 3」をまとめた物として最後の欄の下に出し、聞く文には3つの答えを入れる", () => {
    const grouped: Kyu2Data = {
      ...data,
      parts: [
        { kind: "number", label: "問１", a: 1000 },
        { kind: "number", label: "問２ 1", a: 2000 },
        { kind: "number", label: "問２ 2", a: 3000 },
        { kind: "number", label: "問２ 3", a: 4000 },
      ],
      explain: [{ label: "問２", blocks: [{ t: "p", text: "まとめ" }] }],
    };
    const { byPart, rest } = explainByPart(grouped);
    expect([...byPart.keys()]).toEqual([3]);
    expect(rest).toEqual([]);
    const text = askPrompt(grouped, "x", grouped.explain![0]);
    expect(text).toContain("2,000");
    expect(text).toContain("4,000");
    expect(text).not.toContain("1,000");
  });

  it("解説が無い大問は空", () => {
    const { byPart, rest } = explainByPart({ ...data, explain: undefined });
    expect(byPart.size).toBe(0);
    expect(rest).toEqual([]);
  });
});

describe("Claude に聞く文", () => {
  it("問題・その欄の正しい答え・解説を入れる", () => {
    const text = askPrompt(data, "第38回 第1問", data.explain![2]);
    expect(text).toContain("第38回 第1問");
    expect(text).toContain("次の取引を仕訳しなさい。");
    expect(text).toContain("Ａ 現金");
    expect(text).toContain("現金を預け入れた。");
    expect(text).toContain("借方 Ｂ 当座預金 100");
    expect(text).toContain("貸方 Ａ 現金 100");
    expect(text).toContain("当座預金が増える。");
    expect(text).not.toContain("売上から原価を引く。"); // ほかの欄の解説は入れない
  });

  it("欄に対応しない解説（精算表の整理事項など）は表も文字にする", () => {
    const text = askPrompt(data, "第38回 第5問", data.explain![1]);
    expect(text).toContain("借方 | 金額");
    expect(text).toContain("現金 | 100");
  });

  it("数の欄の答えは単位つき", () => {
    expect(askPrompt(data, "x", data.explain![0])).toContain("￥10,800");
  });

  it("長すぎる文は URL に入れず、Claude の新しい会話だけを開く", () => {
    expect(askUrl("短い")).toBe(
      `https://claude.ai/new?q=${encodeURIComponent("短い")}`,
    );
    expect(askUrl("あ".repeat(3000))).toBe("https://claude.ai/new");
  });
});
