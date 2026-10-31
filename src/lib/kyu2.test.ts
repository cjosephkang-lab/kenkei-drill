import { describe, expect, it } from "vitest";
import {
  gradeQuestion,
  journalRows,
  sumAmounts,
  toNumber,
  toSymbol,
  type Kyu2Data,
} from "./kyu2";

const journal: Kyu2Data = {
  title: "仕訳",
  problem: [
    {
      t: "choices",
      title: "勘定科目群",
      items: [
        ["Ａ", "現金"],
        ["Ｂ", "当座預金"],
        ["Ｌ", "預り金"],
        ["Ｑ", "未払配当金"],
      ],
    },
  ],
  parts: [
    {
      kind: "journal",
      label: "(1)",
      debit: [["Ｑ", 5000000]],
      credit: [
        ["Ｂ", 4000000],
        ["Ｌ", 1000000],
      ],
    },
    { kind: "number", label: "(2)", prefix: "￥", a: 10800 },
  ],
};

describe("数の読み取り", () => {
  it("全角・カンマ・円記号・空白をそろえる", () => {
    expect(toNumber("１，２００")).toBe(1200);
    expect(toNumber(" ￥1,200 円")).toBe(1200);
    expect(toNumber("4.5")).toBe(4.5);
    expect(toNumber("△300")).toBe(-300);
    expect(toNumber("")).toBeNull();
    expect(toNumber("abc")).toBeNull();
  });
  it("日本語入力の「、」も、数字に挟まれて後ろが3桁なら桁区切り", () => {
    expect(toNumber("２０、３００")).toBe(20300);
    expect(sumAmounts("２０、３００")).toBe(20300);
    expect(sumAmounts("800、3,200")).toBe(4000);
  });
  it("1つの欄の複数の金額は合計する（カンマは桁区切りのまま）", () => {
    expect(sumAmounts("800 3,200")).toBe(4000);
    expect(sumAmounts("800+3,200")).toBe(4000);
    expect(sumAmounts("1,200")).toBe(1200);
    expect(sumAmounts("")).toBeNull();
  });
  it("記号は半角・小文字でも全角の大文字にする", () => {
    expect(toSymbol("q")).toBe("Ｑ");
    expect(toSymbol("Ｑ")).toBe("Ｑ");
    expect(toSymbol(" b ")).toBe("Ｂ");
  });
});

describe("仕訳の採点", () => {
  it("行の順番が違っても、同じ記号の金額を分けて書いても○", () => {
    const inputs = {
      "0:d:0:c": "Ｑ",
      "0:d:0:a": "5,000,000",
      "0:k:0:c": "Ｌ",
      "0:k:0:a": "1000000",
      "0:k:1:c": "Ｂ",
      "0:k:1:a": "3000000",
      "0:k:2:c": "Ｂ",
      "0:k:2:a": "1000000",
      "1": "10800",
    };
    const result = gradeQuestion(journal, 20, inputs);
    expect(result.units.map((u) => u.ok)).toEqual([true, true]);
    expect(result.score).toBe(20);
  });
  it("同じ科目が借方と貸方の両方にある仕訳は、差し引いた1行で書いても○", () => {
    const bond: Kyu2Data = {
      title: "仕訳",
      problem: [{ t: "choices", title: "勘定科目群", items: [["Ｂ", "当座預金"], ["Ｈ", "社債"], ["Ｓ", "社債発行費"]] }],
      parts: [{ kind: "journal", label: "(2)", debit: [["Ｂ", 19700000], ["Ｓ", 150000]], credit: [["Ｈ", 19700000], ["Ｂ", 150000]] }],
    };
    const netted = { "0:d:0:c": "Ｂ", "0:d:0:a": "19550000", "0:d:1:c": "Ｓ", "0:d:1:a": "150000", "0:k:0:c": "Ｈ", "0:k:0:a": "19700000" };
    expect(gradeQuestion(bond, 4, netted).units[0].ok).toBe(true);
    const asTac = { ...netted, "0:d:0:a": "19700000", "0:k:1:c": "Ｂ", "0:k:1:a": "150000" };
    expect(gradeQuestion(bond, 4, asTac).units[0].ok).toBe(true);
  });
  it("貸方の1行が欠けたら×", () => {
    const inputs = {
      "0:d:0:c": "Ｑ",
      "0:d:0:a": "5000000",
      "0:k:0:c": "Ｂ",
      "0:k:0:a": "4000000",
      "1": "10800",
    };
    const result = gradeQuestion(journal, 20, inputs);
    expect(result.units[0].ok).toBe(false);
    expect(result.score).toBe(10);
  });
  it("借方と貸方を取り違えたら×", () => {
    const inputs = {
      "0:k:0:c": "Ｑ",
      "0:k:0:a": "5000000",
      "0:d:0:c": "Ｂ",
      "0:d:0:a": "4000000",
      "0:d:1:c": "Ｌ",
      "0:d:1:a": "1000000",
    };
    expect(gradeQuestion(journal, 20, inputs).units[0].ok).toBe(false);
  });
  it("正しい答えの文字に借方・貸方の行が出る", () => {
    const result = gradeQuestion(journal, 20, {});
    expect(result.units[0].expected).toBe(
      "借方 Ｑ 未払配当金 5,000,000／貸方 Ｂ 当座預金 4,000,000・Ｌ 預り金 1,000,000",
    );
  });
  it("仕訳の行の数は3行から、打った行まで増える", () => {
    expect(journalRows({}, 0, "d")).toBe(3);
    expect(journalRows({ "0:d:4:a": "1" }, 0, "d")).toBe(5);
    expect(journalRows({ "0:d:n": "4" }, 0, "d")).toBe(4);
  });
});

describe("表の採点", () => {
  const table: Kyu2Data = {
    title: "精算表",
    problem: [],
    parts: [
      {
        kind: "table",
        label: "精算表",
        rows: [
          ["現金", "20,300", { a: [] }, { a: [20300] }],
          ["未成工事支出金", "362,400", { a: [800, 3200] }, { a: [] }],
        ],
      },
    ],
  };
  it("答えのある欄だけを数え、複数の金額は合計で比べる", () => {
    const result = gradeQuestion(table, 30, {
      "0:0:3": "20,300",
      "0:1:2": "4000",
    });
    expect(result.total).toBe(2);
    expect(result.correct).toBe(2);
    expect(result.score).toBe(30);
  });
  it("答えが空の欄に金額を入れたら×として数える", () => {
    const result = gradeQuestion(table, 30, {
      "0:0:2": "500",
      "0:0:3": "20300",
      "0:1:2": "800 3200",
    });
    expect(result.total).toBe(3);
    expect(result.correct).toBe(2);
    expect(result.score).toBe(20);
  });
  it("答えが空の欄に0を入れても数えない", () => {
    const result = gradeQuestion(table, 30, {
      "0:0:2": "0",
      "0:0:3": "20300",
      "0:1:2": "4000",
    });
    expect(result.total).toBe(2);
  });
});

describe("表の中の記号の欄", () => {
  const ledger: Kyu2Data = {
    title: "勘定記入",
    problem: [{ t: "choices", title: "勘定科目群", items: [["Ａ", "完成工事高"], ["Ｂ", "完成工事原価"]] }],
    parts: [{ kind: "table", label: "未成工事支出金", rows: [["材料費", "100", { s: "Ｂ" }, { a: [100] }]] }],
  };
  it("記号の欄も1欄として数え、半角でも○", () => {
    const result = gradeQuestion(ledger, 10, { "0:0:2": "b", "0:0:3": "100" });
    expect(result.total).toBe(2);
    expect(result.score).toBe(10);
  });
  it("違う記号なら×で、正しい記号と科目名を出す", () => {
    const result = gradeQuestion(ledger, 10, { "0:0:2": "Ａ", "0:0:3": "100" });
    expect(result.units[0]).toEqual({ key: "0:0:2", ok: false, expected: "Ｂ 完成工事原価" });
  });
});

describe("記号の採点", () => {
  it("半角で選んでも○", () => {
    const data: Kyu2Data = {
      title: "",
      problem: [],
      parts: [
        { kind: "symbol", label: "問３ 記号", choices: ["Ａ", "Ｂ"], a: "Ｂ" },
      ],
    };
    expect(gradeQuestion(data, 4, { "0": "b" }).score).toBe(4);
    expect(gradeQuestion(data, 4, {}).score).toBe(0);
  });
});
