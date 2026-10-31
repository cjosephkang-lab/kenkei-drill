// 2級の解説: TAC の解説を答える欄ごとに割り当て、Claude に聞く文を作る
import { accountNames, type Kyu2Block, type Kyu2Data, type Kyu2Explain } from "./kyu2";

// 解説が対応する欄。label が同じ欄、無ければ「問２」→「問２ 1」「問２ 2」…のように、その label で始まる欄すべて
const partsOf = (data: Kyu2Data, section: Kyu2Explain) => {
  const all = data.parts.map((part, i) => ({ label: part.label, i }));
  const same = all.filter((p) => p.label === section.label);
  return (same.length ? same : all.filter((p) => p.label.startsWith(`${section.label} `))).map((p) => p.i);
};

// まとめた解説は、まとめた欄の最後の欄の下に出す。どの欄にも対応しない物は大問の最後に出す
export const explainByPart = (data: Kyu2Data) => {
  const byPart = new Map<number, Kyu2Explain[]>();
  const rest: Kyu2Explain[] = [];
  for (const section of data.explain ?? []) {
    const i = partsOf(data, section).at(-1);
    if (i === undefined) rest.push(section);
    else byPart.set(i, [...(byPart.get(i) ?? []), section]);
  }
  return { byPart, rest };
};

const yen = (n: number) => n.toLocaleString("ja-JP");

const blockText = (block: Kyu2Block) => {
  if (block.t === "p") return block.text;
  if (block.t === "choices")
    return `${block.title}: ${block.items.map(([code, name]) => `${code} ${name}`).join("、")}`;
  return [block.caption, ...block.rows.map((row) => row.join(" | "))].filter(Boolean).join("\n");
};

const answerText = (data: Kyu2Data, i: number) => {
  const part = data.parts[i];
  const names = accountNames(data);
  const acc = (code: string) => `${code} ${names.get(code) ?? ""}`.trim();
  if (part.kind === "journal") {
    const side = (lines: [string, number][]) => lines.map(([code, v]) => `${acc(code)} ${yen(v)}`).join("、");
    return `借方 ${side(part.debit)} ／ 貸方 ${side(part.credit)}`;
  }
  if (part.kind === "number") return `${part.prefix ?? ""}${yen(part.a)}${part.suffix ?? ""}`;
  if (part.kind === "symbol") return acc(part.a);
  const cell = (c: (typeof part.rows)[number][number]) =>
    typeof c === "string" ? c : "s" in c ? acc(c.s) : c.a.map(yen).join("＋");
  return [...(part.head ?? []).map((row) => row.join(" | ")), ...part.rows.map((row) => row.map(cell).join(" | "))].join("\n");
};

// 欄に対応しない解説（精算表の整理事項など）は、どの欄の話か決められないので、すべての欄の答えを入れる
const askParts = (data: Kyu2Data, section: Kyu2Explain) => {
  const parts = partsOf(data, section);
  return parts.length ? parts : data.parts.map((_, i) => i);
};

export const askPrompt = (data: Kyu2Data, where: string, section: Kyu2Explain) =>
  [
    `建設業経理士2級の過去問（${where}「${data.title}」）を勉強しています。下の TAC の解説を、初めて学ぶ人にもわかるように、かみ砕いて説明してください。なぜその仕訳・計算になるのかを一歩ずつお願いします。`,
    "",
    "【問題】",
    ...data.problem.map(blockText),
    ...askParts(data, section).flatMap((i) => [
      "",
      `【${data.parts[i].label}】`,
      ...(data.parts[i].prompt ? [data.parts[i].prompt!] : []),
      `正しい答え: ${answerText(data, i)}`,
    ]),
    "",
    `【TAC の解説 ${section.label}${section.title ? ` ${section.title}` : ""}】`,
    ...section.blocks.map(blockText),
  ].join("\n");

// 長い URL は開けない端末があるので、長い時は新しい会話だけを開き、文は貼り付けてもらう
const MAX_URL = 6000;
export const askUrl = (text: string) => {
  const url = `https://claude.ai/new?q=${encodeURIComponent(text)}`;
  return url.length <= MAX_URL ? url : "https://claude.ai/new";
};
