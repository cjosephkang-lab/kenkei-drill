// 原価計算の表（工事別原価計算表・部門費振替表）をスマホで解く: 打つのは考える所の欄だけ（今の表の欄のキーのまま）。
// 足し算で決まる欄（計の列・完成/未成の行・配る総額・合計・配賦金額）はアプリが埋め、採点は表の欄ごと（kyu2.ts）
import { sumAmounts, type Kyu2Cell, type Kyu2Inputs, type Kyu2Part } from "./kyu2";

type Table = Extract<Kyu2Part, { kind: "table" }>;
export type CostCard = { title: string; fields: [string, string][] }; // [欄のキー, 見出し]

const nameOf = (row: Kyu2Cell[]) => (typeof row[0] === "string" ? row[0].trim() : "");
const isInput = (cell: Kyu2Cell | undefined) => cell !== undefined && typeof cell !== "string" && "a" in cell;
const heads = (part: Table) => part.head?.[part.head.length - 1] ?? [];

export const costKind = (part: Kyu2Part): "kobetsu" | "bumon" | null => {
  if (part.kind !== "table") return null;
  const name = `${part.label}${part.title ?? ""}`;
  if (name.includes("工事別原価計算表") && heads(part).at(-1) === "計") return "kobetsu";
  if (name.includes("部門費振替表") && heads(part)[1] === "合計") return "bumon";
  return null;
};

// 工事別原価計算表の行: 月初未成・原価の要素（材料費〜工事間接費）・完成/未成（月初＋要素の和）
const kobetsuRows = (part: Table) => {
  const opening = part.rows.findIndex((row) => nameOf(row).includes("月初"));
  const totals = part.rows.flatMap((row, r) =>
    r !== opening && /完成工事原価|未成工事原価/.test(nameOf(row)) ? [r] : [],
  );
  const elements = part.rows.flatMap((row, r) =>
    r !== opening && !totals.includes(r) && row.some(isInput) ? [r] : [],
  );
  return { opening, elements, totals };
};

// 部門費振替表の行: 部門費合計・補助部門の配賦（行の名前が列の見出しと同じ）・合計・配賦金額
const bumonRows = (part: Table) => {
  const names = heads(part);
  const own = (r: number) => names.indexOf(nameOf(part.rows[r]));
  const base = part.rows.findIndex((row) => nameOf(row).includes("部門費合計"));
  const allocations = part.rows.flatMap((_, r) => (r !== base && own(r) > 1 ? [r] : []));
  return { base, allocations, own };
};

export const costCards = (part: Table, i: number): CostCard[] => {
  const names = heads(part);
  const field = (r: number, c: number, label: string): [string, string][] =>
    isInput(part.rows[r][c]) ? [[`${i}:${r}:${c}`, label]] : [];
  if (costKind(part) === "kobetsu") {
    const { opening, elements } = kobetsuRows(part);
    return names.slice(1, -1).map((title, j) => ({
      title,
      fields: [opening, ...elements].filter((r) => r >= 0).flatMap((r) => field(r, j + 1, nameOf(part.rows[r]))),
    }));
  }
  const { base, allocations, own } = bumonRows(part);
  const cols = names.map((_, c) => c).slice(2);
  return [base, ...allocations].map((r) => ({
    title: nameOf(part.rows[r]),
    fields: cols.filter((c) => c !== own(r)).flatMap((c) => field(r, c, names[c])),
  }));
};

// カードで打つ形（2026-10-31）より前に、表の足し算の欄へ直接打った下書き・答え。カードは足し算の欄に書かないので、そこに値があれば前の形
export const typedIntoAuto = (part: Table, i: number, inputs: Kyu2Inputs) =>
  Object.keys(autoCells(part, i, {})).some((key) => (inputs[key] ?? "").trim() !== "");

export const autoCells = (part: Table, i: number, inputs: Kyu2Inputs): Kyu2Inputs => {
  const values = new Map<string, number>();
  const get = (r: number, c: number) => values.get(`${r}:${c}`) ?? sumAmounts(inputs[`${i}:${r}:${c}`]) ?? 0;
  const put = (r: number, c: number, value: number) => {
    if (isInput(part.rows[r]?.[c])) values.set(`${r}:${c}`, value);
  };
  const width = part.rows[0].length;
  if (costKind(part) === "kobetsu") {
    const { opening, elements, totals } = kobetsuRows(part);
    for (let c = 1; c < width - 1; c += 1) {
      const cost = (opening >= 0 ? get(opening, c) : 0) + elements.reduce((s, r) => s + get(r, c), 0);
      for (const r of totals) put(r, c, cost);
    }
    part.rows.forEach((_, r) => {
      let total = 0;
      for (let c = 1; c < width - 1; c += 1) total += get(r, c);
      put(r, width - 1, total);
    });
  } else {
    const { base, allocations, own } = bumonRows(part);
    const given = (r: number) => {
      let total = 0;
      for (let c = 2; c < width; c += 1) if (c !== own(r)) total += get(r, c);
      return total;
    };
    if (base >= 0) put(base, 1, given(base));
    allocations.forEach((r, n) => {
      // 補助部門が配る総額＝自分の部門費＋先に配った補助部門から受けた額（配った先の合計ではない）
      const held =
        (base >= 0 ? get(base, own(r)) : 0) +
        allocations.slice(0, n).reduce((s, a) => s + get(a, own(r)), 0);
      put(r, 1, held);
      put(r, own(r), held);
    });
    part.rows.forEach((row, r) => {
      const name = nameOf(row);
      if (r === base || allocations.includes(r) || !(name === "合計" || name.includes("配賦金額"))) return;
      let total = 0;
      for (let c = 2; c < width; c += 1) {
        const received = allocations.reduce((s, a) => s + get(a, c), 0);
        const value = name === "合計" ? (base >= 0 ? get(base, c) : 0) + received : received;
        put(r, c, value);
        if (isInput(row[c])) total += value;
      }
      put(r, 1, total);
    });
  }
  const out: Kyu2Inputs = {};
  for (const [key, value] of values) out[`${i}:${key}`] = value ? value.toLocaleString("ja-JP") : "";
  return out;
};
