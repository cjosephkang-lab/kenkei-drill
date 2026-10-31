// 精算表（第5問）をスマホで解く: 打つのは整理仕訳だけ。科目ごとに整理記入を足し合わせ、試算表に加えて
// 損益計算書・貸借対照表の欄へ移し、小計・当期純利益・合計まで埋める。採点は精算表の欄ごと（kyu2.ts の表と同じ）
// 列は 科目, 試算表 借貸, 整理記入 借貸, 損益計算書 借貸, 貸借対照表 借貸 の9列（scripts/check_kyu2.py と同じ前提）
import { journalRows, toNumber, type Kyu2Cell, type Kyu2Inputs, type Kyu2Part } from "./kyu2";

type Table = Extract<Kyu2Part, { kind: "table" }>;

export const isSeisan = (part: Kyu2Part): boolean =>
  part.kind === "table" &&
  `${part.label}${part.title ?? ""}`.includes("精算表") &&
  part.rows.every((row) => row.length === 9);

const nameOf = (row: Kyu2Cell[]) => (typeof row[0] === "string" ? row[0].trim() : "");
const isNetIncome = (row: Kyu2Cell[]) => nameOf(row).includes("当期");

// 仕訳で選べる科目。記号は行の番号（"r12"）
export const seisanAccounts = (part: Table) =>
  part.rows.flatMap((row, r) =>
    nameOf(row) && !isNetIncome(row) ? [{ code: `r${r}`, name: nameOf(row) }] : [],
  );

export const entryCount = (inputs: Kyu2Inputs, i: number) => {
  let n = Math.max(1, Number(inputs[`${i}:j:n`]) || 0);
  for (const key of Object.keys(inputs)) {
    const match = key.match(new RegExp(`^${i}:j:(\\d+):`));
    if (match && inputs[key]) n = Math.max(n, Number(match[1]) + 1);
  }
  return n;
};

const printed = (cell: Kyu2Cell) => (typeof cell === "string" ? (toNumber(cell) ?? 0) : 0);
const answered = (cell: Kyu2Cell) => typeof cell !== "string" && "a" in cell && cell.a.length > 0;

export const seisanInputs = (part: Table, i: number, inputs: Kyu2Inputs): Kyu2Inputs => {
  // 科目ごとの整理記入（借方・貸方それぞれの合計）
  const debit = new Map<number, number>();
  const credit = new Map<number, number>();
  for (let n = 0; n < entryCount(inputs, i); n += 1)
    for (const [side, totals] of [["d", debit], ["k", credit]] as const) {
      const prefix = `${i}:j:${n}`;
      for (let line = 0; line < journalRows(inputs, prefix, side, 1); line += 1) {
        const r = Number((inputs[`${prefix}:${side}:${line}:c`] ?? "").replace(/^r/, ""));
        const value = toNumber(inputs[`${prefix}:${side}:${line}:a`]);
        if (!inputs[`${prefix}:${side}:${line}:c`] || value === null || !Number.isInteger(r)) continue;
        totals.set(r, (totals.get(r) ?? 0) + value);
      }
    }

  const values = new Map<string, number>(); // `${r}:${c}` → 金額
  const subtotal = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  part.rows.forEach((row, r) => {
    if (!nameOf(row) || isNetIncome(row)) return;
    const d = debit.get(r) ?? 0;
    const k = credit.get(r) ?? 0;
    const balance = printed(row[1]) - printed(row[2]) + d - k;
    // 損益計算書と貸借対照表のどちらへ移すかは、答えの入っている側で決める（両方空なら貸借対照表）
    const pl = answered(row[5]) || answered(row[6]);
    const col = (pl ? 5 : 7) + (balance < 0 ? 1 : 0);
    const cells: [number, number][] = [[3, d], [4, k], [col, Math.abs(balance)]];
    for (const [c, value] of cells) {
      values.set(`${r}:${c}`, value);
      subtotal[c] += value;
    }
  });
  const profit = subtotal[6] - subtotal[5];
  const income = [0, 0, 0, 0, 0, profit > 0 ? profit : 0, profit < 0 ? -profit : 0, profit < 0 ? -profit : 0, profit > 0 ? profit : 0];

  // 名前の無い行: 試算表の合計（印刷済み）・小計（当期純利益の行より前）・合計（当期純利益の行より後）
  const incomeRow = part.rows.findIndex(isNetIncome);
  part.rows.forEach((row, r) => {
    if (isNetIncome(row)) for (let c = 5; c <= 8; c += 1) values.set(`${r}:${c}`, income[c]);
    else if (!nameOf(row))
      for (let c = 3; c <= 8; c += 1)
        values.set(`${r}:${c}`, subtotal[c] + (incomeRow >= 0 && r > incomeRow ? income[c] : 0));
  });

  const out: Kyu2Inputs = {};
  part.rows.forEach((row, r) =>
    row.forEach((cell, c) => {
      if (typeof cell === "string") return;
      const value = values.get(`${r}:${c}`) ?? 0;
      out[`${i}:${r}:${c}`] = value ? value.toLocaleString("ja-JP") : "";
    }),
  );
  return out;
};
