// 2級の大問: 問題文の並びと答えの欄、端末の中での採点。形の決まりは docs/kyu2-data-format.md
export type Kyu2Block =
  | { t: "p"; text: string }
  | { t: "table"; caption?: string; rows: string[][] }
  | { t: "choices"; title: string; items: [string, string][] };
export type Kyu2Cell = string | { a: number[] } | { s: string };
export type Kyu2Part =
  | {
      kind: "journal";
      label: string;
      prompt?: string;
      debit: [string, number][];
      credit: [string, number][];
    }
  | {
      kind: "number";
      label: string;
      prompt?: string;
      prefix?: string;
      suffix?: string;
      a: number;
    }
  | {
      kind: "symbol";
      label: string;
      prompt?: string;
      choices: string[];
      a: string;
    }
  | {
      kind: "table";
      label: string;
      prompt?: string;
      title?: string;
      head?: string[][];
      rows: Kyu2Cell[][];
    };
export type Kyu2Data = {
  title: string;
  problem: Kyu2Block[];
  parts: Kyu2Part[];
};
export type Kyu2Inputs = Record<string, string>;
export type Kyu2Unit = { key: string; ok: boolean; expected: string };

const ZEN_DIGITS = "０１２３４５６７８９";
const half = (text: string) =>
  text
    .replace(/[０-９]/g, (c) => String(ZEN_DIGITS.indexOf(c)))
    .replace(/[，]/g, ",")
    .replace(/[．]/g, ".")
    .replace(/[＋]/g, "+")
    .replace(/[－−ー]/g, "-")
    // 日本語入力のままカンマを打つと「、」になる。数字に挟まれ後ろが3桁なら桁区切り
    .replace(/(\d)、(?=\d{3}(?!\d))/g, "$1,");

export const toNumber = (text: string | undefined): number | null => {
  if (text === undefined) return null;
  const t = half(text)
    .replace(/[￥¥円,\s]/g, "")
    .replace(/^[△▲]/, "-");
  if (!t) return null;
  const value = Number(t);
  return Number.isFinite(value) ? value : null;
};

export const sumAmounts = (text: string | undefined): number | null => {
  if (text === undefined) return null;
  const pieces = half(text)
    .split(/[+\s、]+/)
    .map((piece) => piece.trim())
    .filter(Boolean);
  if (!pieces.length) return null;
  let total = 0;
  for (const piece of pieces) {
    const value = toNumber(piece);
    if (value === null) return null;
    total += value;
  }
  return total;
};

export const toSymbol = (text: string | undefined) =>
  (text ?? "")
    .trim()
    .toUpperCase()
    .replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0xfee0));

const yen = (value: number) => value.toLocaleString("ja-JP");
const sum = (values: number[]) =>
  values.reduce((total, value) => total + value, 0);

export const journalRows = (
  inputs: Kyu2Inputs,
  part: number,
  side: "d" | "k",
) => {
  let rows = Math.max(3, Number(inputs[`${part}:${side}:n`]) || 0);
  for (const key of Object.keys(inputs)) {
    const match = key.match(new RegExp(`^${part}:${side}:(\\d+):`));
    if (match && inputs[key]) rows = Math.max(rows, Number(match[1]) + 1);
  }
  return rows;
};

const sideTotals = (lines: [string, number][]) => {
  const totals = new Map<string, number>();
  for (const [code, value] of lines)
    totals.set(code, (totals.get(code) ?? 0) + value);
  return totals;
};

const typedSide = (inputs: Kyu2Inputs, part: number, side: "d" | "k") => {
  const lines: [string, number][] = [];
  for (let row = 0; row < journalRows(inputs, part, side); row += 1) {
    const code = toSymbol(inputs[`${part}:${side}:${row}:c`]);
    const value = toNumber(inputs[`${part}:${side}:${row}:a`]);
    if (!code && value === null) continue;
    lines.push([code, value ?? NaN]);
  }
  return sideTotals(lines);
};

const sameTotals = (a: Map<string, number>, b: Map<string, number>) =>
  a.size === b.size && [...a].every(([code, value]) => b.get(code) === value);

export const accountNames = (data: Kyu2Data) => {
  const names = new Map<string, string>();
  for (const block of data.problem)
    if (block.t === "choices")
      for (const [code, name] of block.items) names.set(code, name);
  return names;
};

export const gradeQuestion = (
  data: Kyu2Data,
  points: number,
  inputs: Kyu2Inputs,
) => {
  const names = accountNames(data);
  const units: Kyu2Unit[] = [];
  data.parts.forEach((part, i) => {
    if (part.kind === "journal") {
      const show = (lines: [string, number][]) =>
        lines
          .map(
            ([code, value]) => `${code} ${names.get(code) ?? ""} ${yen(value)}`,
          )
          .join("・");
      units.push({
        key: `${i}`,
        ok:
          sameTotals(typedSide(inputs, i, "d"), sideTotals(part.debit)) &&
          sameTotals(typedSide(inputs, i, "k"), sideTotals(part.credit)),
        expected: `借方 ${show(part.debit)}／貸方 ${show(part.credit)}`,
      });
    } else if (part.kind === "number") {
      units.push({
        key: `${i}`,
        ok: toNumber(inputs[`${i}`]) === part.a,
        expected: `${part.prefix ?? ""}${yen(part.a)}${part.suffix ?? ""}`,
      });
    } else if (part.kind === "symbol") {
      units.push({
        key: `${i}`,
        ok: toSymbol(inputs[`${i}`]) === part.a,
        expected: part.a,
      });
    } else {
      part.rows.forEach((row, r) =>
        row.forEach((cell, c) => {
          if (typeof cell === "string") return;
          const key = `${i}:${r}:${c}`;
          if ("s" in cell) {
            units.push({ key, ok: toSymbol(inputs[key]) === cell.s, expected: `${cell.s} ${names.get(cell.s) ?? ""}`.trim() });
            return;
          }
          const typed = sumAmounts(inputs[key]);
          if (!cell.a.length) {
            if (typed) units.push({ key, ok: false, expected: "（空欄）" });
            return;
          }
          units.push({
            key,
            ok: typed === sum(cell.a),
            expected: cell.a.map(yen).join(" + "),
          });
        }),
      );
    }
  });
  const correct = units.filter((unit) => unit.ok).length;
  const total = units.length;
  return {
    units,
    correct,
    total,
    score: total ? Math.round((points * correct) / total) : 0,
  };
};
