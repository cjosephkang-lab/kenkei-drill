import { describe, expect, it } from "vitest";
import { gradeQuestion, type Kyu2Data, type Kyu2Part } from "./kyu2";
import { autoCells, costCards, costKind, typedIntoAuto } from "./costTable";

const e = (...a: number[]) => ({ a });

// 工事別原価計算表: No.1 は完成、No.2 は未完成
const kobetsu: Kyu2Part = {
  kind: "table",
  label: "問１ 工事別原価計算表",
  head: [["摘要", "No.1", "No.2", "計"]],
  rows: [
    ["月初未成工事原価", e(100), "―", e(100)],
    ["当月発生工事原価", "", "", ""],
    ["材料費", e(10), e(20), e(30)],
    ["工事間接費", e(1), e(2), e(3)],
    ["当月完成工事原価", e(111), "―", e(111)],
    ["月末未成工事原価", "―", e(22), e(22)],
  ],
};

// 部門費振替表: 補助部門は 修繕 と 運搬（運搬から先に配る）
const bumon: Kyu2Part = {
  kind: "table",
  label: "問２ 部門費振替表",
  head: [
    ["摘要", "合計", "第１工事部門", "第２工事部門", "修繕部門", "運搬部門"],
  ],
  rows: [
    ["部門費合計", e(1000), e(500), e(300), e(120), e(80)],
    ["運搬部門", e(80), e(30), e(30), e(20), "―"],
    ["修繕部門", e(140), e(70), e(70), e(140), "―"],
    ["合計", e(1000), e(600), e(400), "―", "―"],
    ["（配賦金額）", "―", e(100), e(100), "―", "―"],
  ],
};

const typedKobetsu = {
  "0:0:1": "100",
  "0:2:1": "10",
  "0:2:2": "20",
  "0:3:1": "1",
  "0:3:2": "2",
};
const typedBumon = {
  "0:0:2": "500",
  "0:0:3": "300",
  "0:0:4": "120",
  "0:0:5": "80",
  "0:1:2": "30",
  "0:1:3": "30",
  "0:1:4": "20",
  "0:2:2": "70",
  "0:2:3": "70",
};

describe("原価計算表の足し算の欄をアプリが埋める", () => {
  it("工事別原価計算表と部門費振替表を見分ける", () => {
    expect(costKind(kobetsu)).toBe("kobetsu");
    expect(costKind(bumon)).toBe("bumon");
    expect(costKind({ ...kobetsu, label: "精算表" })).toBe(null);
  });

  it("工事別原価計算表: 打つのは工事ごとの月初未成と原価の要素。完成・未成の行と計の列は足し算", () => {
    expect(costCards(kobetsu, 0)).toEqual([
      {
        title: "No.1",
        fields: [
          ["0:0:1", "月初未成工事原価"],
          ["0:2:1", "材料費"],
          ["0:3:1", "工事間接費"],
        ],
      },
      {
        title: "No.2",
        fields: [
          ["0:2:2", "材料費"],
          ["0:3:2", "工事間接費"],
        ],
      },
    ]);
    const cells = autoCells(kobetsu, 0, typedKobetsu);
    expect(cells["0:4:1"]).toBe("111");
    expect(cells["0:5:2"]).toBe("22");
    expect(cells["0:2:3"]).toBe("30");
    expect(cells["0:5:3"]).toBe("22");
  });

  it("部門費振替表: 打つのは部門費合計と、補助部門から各部門へ配る額。配る総額・合計・配賦金額は足し算", () => {
    expect(costCards(bumon, 0).map((card) => card.title)).toEqual([
      "部門費合計",
      "運搬部門",
      "修繕部門",
    ]);
    expect(costCards(bumon, 0)[2].fields.map(([, label]) => label)).toEqual([
      "第１工事部門",
      "第２工事部門",
    ]);
    const cells = autoCells(bumon, 0, typedBumon);
    expect(cells["0:0:1"]).toBe("1,000");
    expect(cells["0:1:1"]).toBe("80");
    expect(cells["0:2:4"]).toBe("140"); // 修繕部門が配る総額＝自分の部門費＋運搬から受けた分
    expect(cells["0:2:1"]).toBe("140");
    expect(cells["0:3:2"]).toBe("600");
    expect(cells["0:3:1"]).toBe("1,000");
    expect(cells["0:4:3"]).toBe("100");
  });

  it("打つ欄だけ正しく打てば満点", () => {
    const one = (part: Kyu2Part): Kyu2Data => ({
      title: "原価計算",
      problem: [],
      parts: [part],
    });
    expect(gradeQuestion(one(kobetsu), 14, typedKobetsu).score).toBe(14);
    expect(gradeQuestion(one(bumon), 24, typedBumon).score).toBe(24);
  });

  it("補助部門が配る総額は、自分の部門費＋先に配った補助部門から受けた額（配った先の合計ではない）", () => {
    const cells = autoCells(bumon, 0, { ...typedBumon, "0:1:4": "0" });
    expect(cells["0:2:4"]).toBe("120");
    expect(cells["0:2:1"]).toBe("120");
  });

  it("前に表の足し算の欄へ直接打った答えは、表に打つ形のまま採点する", () => {
    const old = { ...typedKobetsu, "0:4:1": "111", "0:4:3": "111" };
    expect(typedIntoAuto(kobetsu, 0, old)).toBe(true);
    expect(typedIntoAuto(kobetsu, 0, typedKobetsu)).toBe(false);
    const one: Kyu2Data = { title: "原価計算", problem: [], parts: [kobetsu] };
    // 材料費 No.1 だけ誤り・完成の行は前に打った 111 のまま → 完成の行は○のまま
    const wrong = { ...old, "0:2:1": "11" };
    const units = gradeQuestion(one, 14, wrong).units;
    expect(units.find((u) => u.key === "0:4:1")?.ok).toBe(true);
  });
});
