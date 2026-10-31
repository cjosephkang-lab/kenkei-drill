// 文字に起こした2級のデータ（source-2kyu/。コミットしない）が手元にある時だけ動く
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gradeQuestion, type Kyu2Data, type Kyu2Inputs } from "./kyu2";
import { costCards, costKind } from "./costTable";
import { isSeisan } from "./seisan";

const root = join(__dirname, "../../source-2kyu");
const files = existsSync(root)
  ? readdirSync(root).flatMap((round) =>
      existsSync(join(root, round)) && !round.startsWith(".")
        ? readdirSync(join(root, round))
            .filter((name) => /^q\d\.json$/.test(name))
            .map((name) => join(root, round, name))
        : [],
    )
  : [];

const perfect = (data: Kyu2Data): Kyu2Inputs => {
  const inputs: Kyu2Inputs = {};
  data.parts.forEach((part, i) => {
    if (part.kind === "journal") {
      part.debit.forEach(([code, value], r) => {
        inputs[`${i}:d:${r}:c`] = code;
        inputs[`${i}:d:${r}:a`] = value.toLocaleString("ja-JP");
      });
      part.credit.forEach(([code, value], r) => {
        inputs[`${i}:k:${r}:c`] = code;
        inputs[`${i}:k:${r}:a`] = String(value);
      });
    } else if (part.kind === "number") inputs[`${i}`] = String(part.a);
    else if (part.kind === "symbol") inputs[`${i}`] = part.a;
    else if (isSeisan(part)) {
      // 精算表は整理記入の答えを1つの仕訳にまとめて打つ（借方の科目・金額をすべて借方に、貸方も同じ）
      const lines = { d: 0, k: 0 };
      part.rows.forEach((row, r) =>
        ([["d", 3], ["k", 4]] as const).forEach(([side, c]) => {
          const cell = row[c];
          if (typeof cell === "string" || !("a" in cell)) return;
          for (const value of cell.a) {
            inputs[`${i}:j:0:${side}:${lines[side]}:c`] = `r${r}`;
            inputs[`${i}:j:0:${side}:${lines[side]}:a`] = String(value);
            lines[side] += 1;
          }
        }),
      );
    } else if (costKind(part)) {
      // 原価計算の表はカードの欄（考える所）だけを打つ。足し算の欄はアプリが埋める
      const fields = new Set(costCards(part, i).flatMap((card) => card.fields.map(([key]) => key)));
      part.rows.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (fields.has(`${i}:${r}:${c}`) && typeof cell !== "string" && "a" in cell)
            inputs[`${i}:${r}:${c}`] = cell.a.join(" ");
        }),
      );
    } else
      part.rows.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (typeof cell === "string") return;
          if ("s" in cell) inputs[`${i}:${r}:${c}`] = cell.s;
          else if (cell.a.length) inputs[`${i}:${r}:${c}`] = cell.a.join(" ");
        }),
      );
  });
  return inputs;
};

describe.skipIf(!files.length)("2級のデータ", () => {
  it.each(files)("%s: 答えどおりに打てば満点・何も打たなければ0点", (file) => {
    const q = JSON.parse(readFileSync(file, "utf-8"));
    const data: Kyu2Data = {
      title: q.title,
      problem: q.problem,
      parts: q.parts,
    };
    expect(gradeQuestion(data, q.points, perfect(data)).score).toBe(q.points);
    // 精算表は仕訳が無くても試算表の金額が損益計算書・貸借対照表へ移るので、0点にはならない
    if (!data.parts.some(isSeisan))
      expect(gradeQuestion(data, q.points, {}).score).toBe(0);
  });
});
