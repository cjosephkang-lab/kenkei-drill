// 2級の問題画面: 問題文と表を文字で出し、答えを欄ごとに打ち込んで端末の中で採点する
import { useEffect, useState } from "react";
import {
  accountNames,
  gradeQuestion,
  journalRows,
  type Kyu2Block,
  type Kyu2Inputs,
  type Kyu2Part,
  type Kyu2Unit,
} from "../lib/kyu2";
import { ImageViewer } from "./ImageViewer";
import type { FullQuestion } from "./types";

const draftKey = (id: string) => `kenkei-drill.kyu2-draft.v1.${id}`;
// 答え合わせをした印。開き直しても答え合わせの後の画面に戻す（答えを見てから直した点を初見の得点にしない）
const revealedKey = (id: string) => `kenkei-drill.kyu2-revealed.v1.${id}`;
const loadDraft = (id: string): Kyu2Inputs => {
  try {
    return JSON.parse(localStorage.getItem(draftKey(id)) ?? "{}");
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

type FieldProps = {
  inputs: Kyu2Inputs;
  set: (key: string, value: string) => void;
  revealed: boolean;
  result: Map<string, Kyu2Unit>;
};

const mark = (unit?: Kyu2Unit) => (unit ? (unit.ok ? "ok" : "ng") : "");

function Journal({
  i,
  inputs,
  set,
  revealed,
  result,
  pick,
  names,
}: FieldProps & {
  i: number;
  pick: (key: string) => void;
  names: Map<string, string>;
}) {
  const unit = result.get(`${i}`);
  const side = (s: "d" | "k", name: string) => {
    const rows = journalRows(inputs, i, s);
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
                ? `${inputs[`${i}:${s}:${r}:c`]} ${names.get(inputs[`${i}:${s}:${r}:c`]) ?? ""}`
                : "記号"}
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
}: FieldProps & {
  part: Extract<Kyu2Part, { kind: "table" }>;
  i: number;
  pick: (key: string) => void;
  names: Map<string, string>;
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
                      disabled={revealed}
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

export function Kyu2Question({
  question,
  elapsed,
  position,
  total,
  onFinish,
  onBack,
}: {
  question: FullQuestion;
  elapsed: number;
  position: number;
  total: number;
  onFinish: (score: number) => boolean;
  onBack: () => void;
}) {
  const data = question.kyu2!;
  const [inputs, setInputs] = useState<Kyu2Inputs>(() =>
    loadDraft(question.id),
  );
  const [revealed, setRevealedState] = useState(
    () => localStorage.getItem(revealedKey(question.id)) === "1",
  );
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
  const names = accountNames(data);
  const graded = gradeQuestion(data, question.points, inputs);
  const result = new Map(graded.units.map((unit) => [unit.key, unit]));
  useEffect(() => {
    try {
      localStorage.setItem(draftKey(question.id), JSON.stringify(inputs));
    } catch {
      // 保存できない端末では下書きを残さない（打った答えは画面の中には残る）
    }
  }, [inputs, question.id]);
  const set = (key: string, value: string) =>
    setInputs((all) => ({ ...all, [key]: value }));
  const finish = () => {
    if (!onFinish(graded.score)) return; // 記録できなかった時は下書きを残す
    localStorage.removeItem(draftKey(question.id));
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
          <span className="chip src mono" style={{ marginLeft: "auto" }}>
            {min}:{String(elapsed % 60).padStart(2, "0")}
          </span>
        </div>
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
                <Journal i={i} pick={setPicking} names={names} {...field} />
              )}
              {part.kind === "table" && (
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
            {question.explain.length > 0 && (
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
            <button
              className="start-btn"
              style={{ marginTop: 16 }}
              onClick={finish}
            >
              記録して次へ
            </button>
          </>
        )}
      </div>
      {picking && (
        <div className="k2-sheet-bg" onClick={() => setPicking(null)}>
          <div className="k2-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="k2-cap">勘定科目を選ぶ</div>
            <div className="k2-acc k2-acc-pick">
              {[...names].map(([code, name]) => (
                <button
                  key={code}
                  onClick={() => {
                    set(picking, code);
                    setPicking(null);
                  }}
                >
                  <b>{code}</b>
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
