import { describe, expect, it } from "vitest";
import { gradeQuestion, type Kyu2Data, type Kyu2Part } from "./kyu2";
import {
  isSeisan,
  seisanAccounts,
  seisanInputs,
  typedIntoTable,
} from "./seisan";

// 小さな精算表: 試算表の行・試算表の合計・足す科目・小計・当期純利益・合計
const e = (...a: number[]) => ({ a });
const part: Kyu2Part = {
  kind: "table",
  label: "精算表",
  head: [
    [
      "勘定科目",
      "残高試算表",
      "",
      "整理記入",
      "",
      "損益計算書",
      "",
      "貸借対照表",
      "",
    ],
  ],
  rows: [
    ["現金", "1,000", "", e(), e(), e(), e(), e(1000), e()],
    ["備品減価償却累計額", "", "300", e(), e(100), e(), e(), e(), e(400)],
    ["仮払金", "200", "", e(), e(200), e(), e(), e(), e()],
    ["完成工事高", "", "5,000", e(), e(), e(), e(5000), e(), e()],
    ["完成工事原価", "4,100", "", e(200), e(), e(4300), e(), e(), e()],
    ["", "5,300", "5,300", "", "", "", "", "", ""],
    ["備品減価償却費", "", "", e(100), e(), e(100), e(), e(), e()],
    ["", "", "", e(300), e(300), e(4400), e(5000), e(1000), e(400)],
    ["当期（純利益）", "", "", "", "", e(600), e(), e(), e(600)],
    ["", "", "", "", "", e(5000), e(5000), e(1000), e(1000)],
  ],
};
const data: Kyu2Data = { title: "精算表", problem: [], parts: [part] };

// 仕訳1つ目: 備品減価償却費 100／備品減価償却累計額 100。2つ目: 完成工事原価 200／仮払金 200
const typed = {
  "0:j:0:d:0:c": "r6",
  "0:j:0:d:0:a": "100",
  "0:j:0:k:0:c": "r1",
  "0:j:0:k:0:a": "100",
  "0:j:1:d:0:c": "r4",
  "0:j:1:d:0:a": "200",
  "0:j:1:k:0:c": "r2",
  "0:j:1:k:0:a": "200",
  "0:j:n": "2",
};

describe("精算表を整理仕訳から組み立てる", () => {
  it("精算表の表だけを見分ける", () => {
    expect(isSeisan(part)).toBe(true);
    expect(isSeisan({ ...part, label: "工事別原価計算表" })).toBe(false);
  });

  it("選べる科目は名前のある行（合計・当期純利益の行は除く）", () => {
    expect(seisanAccounts(part).map((a) => a.name)).toEqual([
      "現金",
      "備品減価償却累計額",
      "仮払金",
      "完成工事高",
      "完成工事原価",
      "備品減価償却費",
    ]);
  });

  it("整理記入を足し合わせ、損益計算書・貸借対照表・小計・当期純利益・合計まで埋める", () => {
    const cells = seisanInputs(part, 0, typed);
    expect(cells["0:1:4"]).toBe("100"); // 累計額の整理記入 貸方
    expect(cells["0:1:8"]).toBe("400"); // 貸借対照表 貸方
    expect(cells["0:2:7"]).toBe(""); // 仮払金は消えて空
    expect(cells["0:4:5"]).toBe("4,300");
    expect(cells["0:7:3"]).toBe("300");
    expect(cells["0:7:6"]).toBe("5,000");
    expect(cells["0:8:5"]).toBe("600");
    expect(cells["0:8:8"]).toBe("600");
    expect(cells["0:9:5"]).toBe("5,000");
    expect(cells["0:9:8"]).toBe("1,000");
  });

  it("正しい整理仕訳なら満点、何も打たなければ整理記入の欄が×", () => {
    expect(gradeQuestion(data, 30, typed).score).toBe(30);
    expect(gradeQuestion(data, 30, {}).score).toBeLessThan(30);
  });

  it("損失なら当期純利益の行は損益計算書の貸方・貸借対照表の借方に出る", () => {
    const loss = {
      ...typed,
      "0:j:2:d:0:c": "r4",
      "0:j:2:d:0:a": "1000",
      "0:j:2:k:0:c": "r0",
      "0:j:2:k:0:a": "1000",
      "0:j:n": "3",
    };
    const cells = seisanInputs(part, 0, loss);
    expect(cells["0:8:5"]).toBe(""); // 当期純利益の行の損益計算書 借方は空
    expect(cells["0:9:6"]).toBe("5,400"); // 損益計算書の合計は費用側 5,400 にそろう
  });

  it("組み立てる値は仕訳と試算表だけから決まり、表の欄に入った値は使わない", () => {
    const cells = seisanInputs(part, 0, { "0:0:7": "999" });
    expect(cells["0:0:7"]).toBe("1,000");
  });

  it("前に表の欄へ直接打った答えは、表に打つ形のまま採点する（仕訳が無いので組み立て直さない）", () => {
    const old: Record<string, string> = {};
    part.rows.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (typeof cell !== "string" && "a" in cell && cell.a.length)
          old[`0:${r}:${c}`] = String(cell.a.reduce((x, y) => x + y, 0));
      }),
    );
    expect(typedIntoTable(old, 0)).toBe(true);
    expect(typedIntoTable(typed, 0)).toBe(false);
    expect(gradeQuestion(data, 30, old).score).toBe(30);
  });
});
