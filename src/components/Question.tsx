import { useState } from "react";
import { autoScoreItems } from "../lib/scoring";
import { imageWidthPercent } from "../lib/images";
import { ImageViewer } from "./ImageViewer";
import { SUBJECT_LABEL, type FullQuestion } from "./types";

export function Question({
  question,
  selected,
  setSelected,
  revealed,
  setRevealed,
  elapsed,
  onFinish,
  onBack,
  position,
  total,
}: {
  question: FullQuestion;
  selected: Record<string, string>;
  setSelected: (value: Record<string, string>) => void;
  revealed: boolean;
  setRevealed: (value: boolean) => void;
  elapsed: number;
  onFinish: (score: number) => void;
  onBack: () => void;
  position: number;
  total: number;
}) {
  const [zoom, setZoom] = useState<string | null>(null);
  const auto = autoScoreItems(
    question.items.map((item) => ({
      ...item,
      selected: selected[item.label ?? ""],
    })),
  );
  const min = Math.floor(elapsed / 60);
  const image = (src: string, label: string, index: number) => (
    <img
      className="q-fig"
      key={`${src}-${index}`}
      src={src}
      alt={`${label}${index + 1}`}
      onClick={() => setZoom(src)}
      onLoad={(event) => {
        event.currentTarget.style.maxWidth = `${imageWidthPercent(event.currentTarget.naturalWidth)}%`;
      }}
    />
  );
  const finish = (value: number) =>
    onFinish(Math.max(0, Math.min(question.points, value)));
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
        <button className="q-close" onClick={onBack}>
          ×
        </button>
      </div>
      <div className="q-body">
        <div className="q-meta">
          <span className="chip cat">{SUBJECT_LABEL[question.subject]}</span>
          <span className="chip src mono">
            第{question.round}回 大問{question.no}
          </span>
          <span className="chip src">{question.points}点</span>
          <span className="chip src mono" style={{ marginLeft: "auto" }}>
            {min}:{String(elapsed % 60).padStart(2, "0")}
          </span>
        </div>
        {question.problem.map((src, index) => image(src, "問題", index))}
        <p className="q-fig-hint">図をタップすると大きく表示します</p>
        {question.items.length > 0 && (
          <div className="items">
            <p className="guide">記号の小問</p>
            {question.items.map((item, index) => {
              const label = item.label ?? String(index + 1);
              const picked = selected[label];
              const symState = (choice: string) => {
                if (!revealed) return choice === picked ? "picked" : "";
                if (choice === item.answer) return "ok";
                return choice === picked ? "ng" : "";
              };
              return (
                <div className="item" key={label}>
                  <span className="item-l">{label}</span>
                  <div className="syms">
                    {(item.choices ?? []).map((choice) => (
                      <button
                        key={choice}
                        className={`sym ${symState(choice)}`}
                        onClick={() =>
                          !revealed &&
                          setSelected({ ...selected, [label]: choice })
                        }
                      >
                        {choice}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {question.items.length > 0 && (
          <button
            className="start-btn"
            style={{ marginTop: 20 }}
            onClick={() => setRevealed(true)}
          >
            解答を見る（{auto.correct}/{auto.total}）
          </button>
        )}
        {question.items.length === 0 && (
          <button
            className="start-btn"
            style={{ marginTop: 20 }}
            onClick={() => setRevealed(true)}
          >
            解答を見る
          </button>
        )}
        {revealed && (
          <>
            <div className="explain">
              <strong>解答・解説</strong>
              {question.answer.map((src, index) => image(src, "解答", index))}
              {question.explain.map((src, index) => image(src, "解説", index))}
            </div>
            <div className="score">
              <strong>自己採点</strong>
              <div className="score-grid">
                {[
                  [question.points, "満点"],
                  [question.points * 0.7, "7割"],
                  [question.points * 0.5, "半分"],
                  [0, "0点"],
                ].map(([value, label]) => (
                  <button
                    key={label as string}
                    onClick={() => finish(value as number)}
                  >
                    {label as string}
                    <br />
                    <span className="mono">{value as number}</span>
                  </button>
                ))}
              </div>
              <input
                type="number"
                min="0"
                max={question.points}
                placeholder="点数を入力"
                onKeyDown={(event) => {
                  if (event.key === "Enter")
                    finish(Number(event.currentTarget.value));
                }}
              />
            </div>
          </>
        )}
      </div>
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
