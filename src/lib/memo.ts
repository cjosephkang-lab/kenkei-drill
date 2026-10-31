// 振り返りメモ: 大問ごとに1つ。答え合わせの後に書き、次にその大問を開いた時に問題の上へ出す（端末の中だけに残る）
const MEMO_KEY = "kenkei-drill.memo.v1";

const all = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(MEMO_KEY) ?? "{}");
  } catch {
    return {}; // 壊れた保存は空として読む
  }
};

export const loadMemo = (id: string) => all()[id] ?? "";

export const saveMemo = (id: string, text: string) => {
  const memos = all();
  if (text.trim()) memos[id] = text;
  else delete memos[id];
  localStorage.setItem(MEMO_KEY, JSON.stringify(memos));
};
