// 2級の問題画面: 問題文と表を文字で出し、答えを欄ごとに打ち込んで端末の中で採点する
import { useEffect, useState } from "react";
import {
  accountNames,
  gradeQuestion,
  journalRows,
  type Kyu2Block,
  type Kyu2Explain,
  type Kyu2Inputs,
  type Kyu2Part,
  type Kyu2Unit,
} from "../lib/kyu2";
import { askPrompt, askUrl, explainByPart } from "../lib/kyu2Explain";
import { loadMemo, saveMemo } from "../lib/memo";
import { entryCount, isSeisan, seisanAccounts, seisanInputs, typedIntoTable } from "../lib/seisan";
import { ImageViewer } from "./ImageViewer";
import type { FullQuestion } from "./types";

const draftKey = (id: string) => `kenkei-drill.kyu2-draft.v1.${id}`;
// 答え合わせをした印。開き直しても答え合わせの後の画面に戻す（答えを見てから直した点を初見の得点にしない）
const revealedKey = (id: string) => `kenkei-drill.kyu2-revealed.v1.${id}`;
// 記録した時の答え。前の問題に戻った時、打った答えと採点を見せる
const answersKey = (id: string) => `kenkei-drill.kyu2-answers.v1.${id}`;
const loadInputs = (key: string): Kyu2Inputs => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "{}");
  } catch {
    return {}; // 壊れた下書きは捨てて空から始める
  }
};

function Block({ block }: { block: Kyu2Block }) {
  if (block.t === "p") return <p className="k2-p">{block.text}</p>;
  if (block.t === "choices")
    return (
      <div className="k2-choices">
        <div className="k2-cap">{block.title}</div>
        <div className="k2-acc">
          {block.items.map(([code, name]) => (
            <span key={code}>
              <b>{code}</b>
              {name}
            </span>
          ))}
        </div>
      </div>
    );
  const [head, ...rows] = block.rows;
  return (
    <div className="k2-scroll">
      {block.caption && <div className="k2-cap">{block.caption}</div>}
      <table className="k2-table">
        <thead>
          <tr>
            {head.map((cell, c) => (
              <th key={c}>{cell}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => (
                <td key={c}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// TAC の解説の1節。「Claude に聞く」は、問題・答え・この解説を1つの文にして claude.ai を開く（サブスクの Claude で聞ける）
function Explain({
  section,
  onAsk,
}: {
  section: Kyu2Explain;
  onAsk: () => void;
}) {
  return (
    <div className="k2-ex">
      <div className="k2-ex-h">
        解説（TAC）{section.label} {section.title}
      </div>
      {section.blocks.map((block, b) => (
        <Block block={block} key={b} />
      ))}
      <button className="k2-ask" onClick={onAsk}>
        この解説を Claude に聞く
      </button>
    </div>
  );
}

type FieldProps = {
  inputs: Kyu2Inputs;
  set: (key: string, value: string) => void;
  revealed: boolean;
  result: Map<string, Kyu2Unit>;
};

const mark = (unit?: Kyu2Unit) => (unit ? (unit.ok ? "ok" : "ng") : "");

// prefix は欄の番号（"2"）か、精算表の整理仕訳の番号（"4:j:0"）。label は記号から画面に出す名前
function Journal({
  prefix,
  unit,
  inputs,
  set,
  revealed,
  pick,
  label,
  minRows,
}: Omit<FieldProps, "result"> & {
  prefix: string;
  minRows?: number;
  unit?: Kyu2Unit;
  pick: (key: string) => void;
  label: (code: string) => string;
}) {
  const i = prefix;
  const side = (s: "d" | "k", name: string) => {
    const rows = journalRows(inputs, i, s, minRows);
    return (
      <div className="k2-side">
        <div className="k2-side-h">{name}</div>
        {Array.from({ length: rows }, (_, r) => (
          <div className="k2-jrow" key={r}>
            <button
              className="k2-code"
              disabled={revealed}
              onClick={() => pick(`${i}:${s}:${r}:c`)}
            >
              {inputs[`${i}:${s}:${r}:c`]
                ? label(inputs[`${i}:${s}:${r}:c`])
                : "科目"}
            </button>
            <input
              className="k2-amt mono"
              inputMode="numeric"
              placeholder="金額"
              disabled={revealed}
              value={inputs[`${i}:${s}:${r}:a`] ?? ""}
              onChange={(e) => set(`${i}:${s}:${r}:a`, e.target.value)}
            />
          </div>
        ))}
        {!revealed && (
          <button
            className="k2-addrow"
            onClick={() => set(`${i}:${s}:n`, String(rows + 1))}
          >
            ＋ 行を足す
          </button>
        )}
      </div>
    );
  };
  return (
    <div className={`k2-journal ${revealed ? mark(unit) : ""}`}>
      {side("d", "借方")}
      {side("k", "貸方")}
      {revealed && unit && !unit.ok && (
        <p className="k2-expect">正しい答え: {unit.expected}</p>
      )}
    </div>
  );
}

// 見出しの空の欄は左の見出しの続き（「残高試算表」が借方・貸方の2列にまたがる）
const headCells = (row: string[]) =>
  row.flatMap((cell, c) => {
    if (c > 0 && cell === "" && row.slice(1, c).some((v) => v !== ""))
      return [];
    let span = 1;
    while (c > 0 && cell !== "" && row[c + span] === "") span += 1;
    return [
      <th key={c} colSpan={span}>
        {cell}
      </th>,
    ];
  });

function Table({
  part,
  i,
  inputs,
  set,
  revealed,
  result,
  pick,
  names,
  locked,
}: FieldProps & {
  part: Extract<Kyu2Part, { kind: "table" }>;
  i: number;
  pick: (key: string) => void;
  names: Map<string, string>;
  locked?: boolean; // 精算表: 整理仕訳から組み立てた値を見せるだけで、打てない
}) {
  return (
    <div className="k2-scroll">
      {part.title && <div className="k2-cap">{part.title}</div>}
      <table className="k2-table k2-input">
        {part.head && (
          <thead>
            {part.head.map((row, r) => (
              <tr key={r}>{headCells(row)}</tr>
            ))}
          </thead>
        )}
        <tbody>
          {part.rows.map((row, r) => (
            <tr key={r}>
              {row.map((cell, c) => {
                if (typeof cell === "string") return <td key={c}>{cell}</td>;
                const key = `${i}:${r}:${c}`;
                const unit = result.get(key);
                if ("s" in cell)
                  return (
                    <td key={c} className={revealed ? mark(unit) : ""}>
                      <button
                        className="k2-code k2-cell-code"
                        disabled={revealed}
                        onClick={() => pick(key)}
                      >
                        {inputs[key]
                          ? `${inputs[key]} ${names.get(inputs[key]) ?? ""}`
                          : "記号"}
                      </button>
                      {revealed && unit && !unit.ok && (
                        <span className="k2-cell-expect">{unit.expected}</span>
                      )}
                    </td>
                  );
                return (
                  <td key={c} className={revealed ? mark(unit) : ""}>
                    <input
                      className="mono"
                      inputMode="numeric"
                      disabled={revealed || locked}
                      value={inputs[key] ?? ""}
                      onChange={(e) => set(key, e.target.value)}
                    />
                    {revealed && unit && !unit.ok && (
                      <span className="k2-cell-expect mono">
                        {unit.expected}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// 精算表: 整理仕訳だけを打ち、精算表は seisanInputs で組み立てて見せる
function Seisan({
  part,
  i,
  inputs,
  set,
  revealed,
  result,
  pick,
}: FieldProps & {
  part: Extract<Kyu2Part, { kind: "table" }>;
  i: number;
  pick: (key: string) => void;
}) {
  const accounts = new Map(seisanAccounts(part).map((a) => [a.code, a.name]));
  const count = entryCount(inputs, i);
  return (
    <>
      <p className="k2-note">
        整理記入の仕訳を1つずつ打つと、下の精算表が埋まります。科目は精算表の科目から選びます。
      </p>
      {Array.from({ length: count }, (_, n) => (
        <div className="k2-entry" key={n}>
          <div className="k2-ex-h">仕訳 {n + 1}</div>
          <Journal
            prefix={`${i}:j:${n}`}
            pick={pick}
            label={(code) => accounts.get(code) ?? code}
            minRows={1}
            inputs={inputs}
            set={set}
            revealed={revealed}
          />
        </div>
      ))}
      {!revealed && (
        <button className="k2-addrow" onClick={() => set(`${i}:j:n`, String(count + 1))}>
          ＋ 仕訳を足す
        </button>
      )}
      <Table
        part={part}
        i={i}
        inputs={{ ...inputs, ...seisanInputs(part, i, inputs) }}
        set={set}
        revealed={revealed}
        result={result}
        pick={pick}
        names={new Map()}
        locked
      />
    </>
  );
}

export function Kyu2Question({
  question,
  elapsed,
  position,
  total,
  onFinish,
  onBack,
  review,
  onPrev,
  onNext,
}: {
  question: FullQuestion;
  elapsed: number;
  position: number;
  total: number;
  onFinish: (score: number) => boolean;
  onBack: () => void;
  review: boolean; // 前の問題に戻って、記録済みの大問を見ている（記録は付け直さない）
  onPrev?: () => void;
  onNext: () => void;
}) {
  const data = question.kyu2!;
  const [inputs, setInputs] = useState<Kyu2Inputs>(() =>
    // 記録時の答えが保存できなかった時は下書きを残してあるので、そちらを見せる
    loadInputs(
      review && localStorage.getItem(answersKey(question.id)) !== null
        ? answersKey(question.id)
        : draftKey(question.id),
    ),
  );
  const [revealed, setRevealedState] = useState(
    () => review || localStorage.getItem(revealedKey(question.id)) === "1",
  );
  const [memo, setMemo] = useState(() => loadMemo(question.id));
  const writeMemo = (text: string) => {
    setMemo(text);
    try {
      saveMemo(question.id, text);
    } catch {
      // 保存できない端末では、メモは画面の中にだけ残る
    }
  };
  const setRevealed = (value: boolean) => {
    setRevealedState(value);
    try {
      localStorage.setItem(revealedKey(question.id), value ? "1" : "");
    } catch {
      // 保存できない端末では、開き直すと答え合わせの前に戻る
    }
  };
  const [picking, setPicking] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  // コピーできた時は "ok"、できなかった時は質問の文（画面に出して手で写してもらう）
  const [asked, setAsked] = useState<{ ok: true } | { ok: false; text: string } | null>(null);
  const names = accountNames(data);
  const explained = explainByPart(data);
  // 科目を選ぶ一覧。精算表の整理仕訳（"4:j:0:d:0:c"）は精算表の科目（記号は出さない）、ほかは勘定科目群
  const pickerOptions = (key: string): [string, string, boolean][] => {
    const part = data.parts[Number(key.split(":")[0])];
    return /^\d+:j:/.test(key) && part?.kind === "table" && isSeisan(part)
      ? seisanAccounts(part).map((a) => [a.code, a.name, false])
      : [...names].map(([code, name]) => [code, name, true]);
  };
  const ask = (section: Kyu2Explain) => {
    const text = askPrompt(data, `第${question.round}回 第${question.no}問`, section);
    // Safari はタップの中でないとコピーも別タブも許さないので、待たずに両方を始める。URL に入りきらない時は貼り付けてもらう
    const copied = navigator.clipboard?.writeText(text) ?? Promise.reject();
    copied.then(
      () => setAsked({ ok: true }),
      () => setAsked({ ok: false, text }),
    );
    window.open(askUrl(text), "_blank");
  };
  const graded = gradeQuestion(data, question.points, inputs);
  const result = new Map(graded.units.map((unit) => [unit.key, unit]));
  useEffect(() => {
    if (review) return; // 振り返りでは打てないので下書きも作らない
    try {
      localStorage.setItem(draftKey(question.id), JSON.stringify(inputs));
    } catch {
      // 保存できない端末では下書きを残さない（打った答えは画面の中には残る）
    }
  }, [inputs, question.id, review]);
  const set = (key: string, value: string) =>
    setInputs((all) => ({ ...all, [key]: value }));
  const finish = () => {
    if (!onFinish(graded.score)) return; // 記録できなかった時は下書きを残す
    try {
      localStorage.setItem(answersKey(question.id), JSON.stringify(inputs));
      localStorage.removeItem(draftKey(question.id));
    } catch {
      // 保存できない時は、前回の答えを消して下書きを残す（前の問題に戻ると下書きを見せる）
      localStorage.removeItem(answersKey(question.id));
    }
    localStorage.removeItem(revealedKey(question.id));
  };
  const field = { inputs, set, revealed, result };
  const min = Math.floor(elapsed / 60);
  return (
    <section>
      <div className="q-top">
        <div className="prog">
          <div className="ptrack">
            <i style={{ width: `${total ? (position / total) * 100 : 0}%` }} />
          </div>
          <div className="pc mono">
            {position} / {total}
          </div>
        </div>
        <button className="q-close" aria-label="ホームに戻る" onClick={onBack}>
          ×
        </button>
      </div>
      <div className="q-body">
        <div className="q-meta">
          <span className="chip cat">2級</span>
          <span className="chip src mono">
            第{question.round}回 第{question.no}問
          </span>
          <span className="chip src">{data.title}</span>
          <span className="chip src">{question.points}点</span>
          {review ? (
            <span className="chip src" style={{ marginLeft: "auto" }}>
              振り返り
            </span>
          ) : (
            <span className="chip src mono" style={{ marginLeft: "auto" }}>
              {min}:{String(elapsed % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        {memo && !revealed && (
          <div className="k2-memo-last">
            <div className="k2-ex-h">前回の振り返りメモ</div>
            <p className="k2-p">{memo}</p>
          </div>
        )}
        {data.problem.map((block, b) => (
          <Block block={block} key={b} />
        ))}
        {data.parts.map((part, i) => {
          const unit = result.get(`${i}`);
          return (
            <div className="k2-part" key={i}>
              <div className="k2-label">{part.label}</div>
              {part.prompt && <p className="k2-p">{part.prompt}</p>}
              {part.kind === "journal" && (
                <Journal
                  prefix={`${i}`}
                  unit={unit}
                  pick={setPicking}
                  label={(code) => `${code} ${names.get(code) ?? ""}`}
                  {...field}
                />
              )}
              {part.kind === "table" && isSeisan(part) && !typedIntoTable(inputs, i) && (
                <Seisan
                  part={part}
                  i={i}
                  pick={setPicking}
                  {...field}
                />
              )}
              {part.kind === "table" && (!isSeisan(part) || typedIntoTable(inputs, i)) && (
                <Table
                  part={part}
                  i={i}
                  pick={setPicking}
                  names={names}
                  {...field}
                />
              )}
              {part.kind === "number" && (
                <div className={`k2-num ${revealed ? mark(unit) : ""}`}>
                  {part.prefix}
                  <input
                    className="k2-amt mono"
                    inputMode="decimal"
                    disabled={revealed}
                    value={inputs[`${i}`] ?? ""}
                    onChange={(e) => set(`${i}`, e.target.value)}
                  />
                  {part.suffix}
                  {revealed && unit && !unit.ok && (
                    <span className="k2-expect">
                      正しい答え: {unit.expected}
                    </span>
                  )}
                </div>
              )}
              {part.kind === "symbol" && (
                <div className={`k2-syms ${revealed ? mark(unit) : ""}`}>
                  {/* 3つ以上から選ぶ欄は用語・科目の名前を添える（2択は「借方差異ならＡ」のように用語群と記号が重なる） */}
                  <div className={part.choices.length > 2 && part.choices.every((c) => names.has(c)) ? "k2-acc k2-acc-pick" : "syms"}>
                    {part.choices.map((choice) => (
                      <button
                        key={choice}
                        className={`sym ${revealed ? (choice === part.a ? "ok" : choice === inputs[`${i}`] ? "ng" : "") : choice === inputs[`${i}`] ? "picked" : ""}`}
                        onClick={() => !revealed && set(`${i}`, choice)}
                      >
                        {part.choices.length > 2 && names.has(choice) ? (
                          <>
                            <b>{choice}</b>
                            {names.get(choice)}
                          </>
                        ) : (
                          choice
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {revealed &&
                explained.byPart
                  .get(i)
                  ?.map((section, n) => (
                    <Explain key={n} section={section} onAsk={() => ask(section)} />
                  ))}
            </div>
          );
        })}
        {!revealed ? (
          <button
            className="start-btn"
            style={{ marginTop: 20 }}
            onClick={() => setRevealed(true)}
          >
            答え合わせ
          </button>
        ) : (
          <>
            <div className="k2-score">
              <div className="mono">
                <b>{graded.score}</b> / {question.points}点
              </div>
              <p>
                {graded.total}欄のうち {graded.correct}
                欄が正解。点は欄の数で割った目安です（本番の配点の内訳は公表されていません）。
              </p>
            </div>
            {explained.rest.map((section, n) => (
              <Explain key={n} section={section} onAsk={() => ask(section)} />
            ))}
            {asked?.ok && (
              <p className="k2-note">
                質問の文をコピーしました。Claude の入力欄に入っていなければ、貼り付けてください。
              </p>
            )}
            {asked && !asked.ok && (
              <div className="k2-note">
                コピーできませんでした。下の文を長押しで全部選んでコピーし、
                <a href="https://claude.ai/new" target="_blank" rel="noreferrer">
                  Claude
                </a>
                に貼り付けてください。
                <textarea className="k2-ask-text" readOnly value={asked.text} />
              </div>
            )}
            {!data.explain && question.explain.length > 0 && (
              <div className="explain">
                <strong>解説（TAC）</strong>
                {question.explain.map((src, n) => (
                  <img
                    className="k2-explain"
                    key={n}
                    src={src}
                    alt={`解説${n + 1}`}
                    onClick={() => setZoom(src)}
                  />
                ))}
              </div>
            )}
            <label className="k2-memo">
              <span className="k2-ex-h">振り返りメモ</span>
              <textarea
                value={memo}
                placeholder="間違えた理由・次に気をつけること。次にこの大問を開くと、問題の上に出ます"
                onChange={(e) => writeMemo(e.target.value)}
              />
            </label>
            <button
              className="start-btn"
              style={{ marginTop: 16 }}
              onClick={review ? onNext : finish}
            >
              {review ? "次の問題へ" : "記録して次へ"}
            </button>
          </>
        )}
        {onPrev && (
          <button className="k2-prev" onClick={onPrev}>
            ← 前の問題
          </button>
        )}
      </div>
      {picking && (
        <div className="k2-sheet-bg" onClick={() => setPicking(null)}>
          <div className="k2-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="k2-cap">勘定科目を選ぶ</div>
            <div className="k2-acc k2-acc-pick">
              {pickerOptions(picking).map(([code, name, shown]) => (
                <button
                  key={code}
                  onClick={() => {
                    set(picking, code);
                    setPicking(null);
                  }}
                >
                  {shown && <b>{code}</b>}
                  {name}
                </button>
              ))}
              <button
                onClick={() => {
                  set(picking, "");
                  setPicking(null);
                }}
              >
                消す
              </button>
            </div>
          </div>
        </div>
      )}
      {zoom && (
        <ImageViewer
          src={zoom}
          naturalWidth={1300}
          onClose={() => setZoom(null)}
        />
      )}
    </section>
  );
}
