import { useState } from "react";
import { autoScoreItems } from "../lib/scoring";
import { imageWidthPercent } from "../lib/images";
import { ImageViewer } from "./ImageViewer";
import { SUBJECT_LABEL, type FullQuestion } from "./types";

function ImageStack({
  images,
  label,
  onZoom,
}: {
  images: string[];
  label: string;
  onZoom: (src: string, naturalWidth: number) => void;
}) {
  const [widths, setWidths] = useState<Record<string, number>>({});
  if (!images.length) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-bold tracking-widest opacity-50">
        {label}
      </p>
      <div className="space-y-3">
        {images.map((src, index) => (
          <img
            key={`${src}-${index}`}
            className="block h-auto max-w-full cursor-zoom-in rounded-2xl border border-black/10 bg-white shadow-sm"
            style={{
              width: "100%",
              maxWidth: `${imageWidthPercent(widths[src] ?? 1300)}%`,
            }}
            src={src}
            alt={`${label}${index + 1}`}
            onLoad={(event) => {
              const naturalWidth = event.currentTarget.naturalWidth;
              setWidths((current) => ({ ...current, [src]: naturalWidth }));
            }}
            onClick={(event) => onZoom(src, event.currentTarget.naturalWidth)}
          />
        ))}
      </div>
    </div>
  );
}

export function Question({
  question,
  selected,
  setSelected,
  revealed,
  setRevealed,
  elapsed,
  onFinish,
  onBack,
}: {
  question: FullQuestion;
  selected: Record<string, string>;
  setSelected: (value: Record<string, string>) => void;
  revealed: boolean;
  setRevealed: (value: boolean) => void;
  elapsed: number;
  onFinish: (score: number) => void;
  onBack: () => void;
}) {
  const [zoom, setZoom] = useState<{
    src: string;
    naturalWidth: number;
  } | null>(null);
  const auto = autoScoreItems(
    question.items.map((item) => ({
      ...item,
      selected: selected[item.label ?? ""],
    })),
  );
  const suggestedScore = Math.round(auto.ratio * question.points * 10) / 10;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <button className="text-sm opacity-60" onClick={onBack}>
          ← 今日へ
        </button>
        <span className="rounded-full bg-black/5 px-3 py-1 font-mono text-sm dark:bg-white/10">
          {minutes}:{String(seconds).padStart(2, "0")}
        </span>
      </div>
      <div className="mb-5">
        <p className="text-xs font-bold tracking-widest text-emerald-700 dark:text-emerald-300">
          {SUBJECT_LABEL[question.subject]} / 第{question.round}回
        </p>
        <h1 className="text-3xl font-black">
          大問 {question.no}
          <span className="ml-2 text-base font-normal opacity-50">
            {question.points}点
          </span>
        </h1>
      </div>
      <ImageStack
        images={question.problem}
        label="問題"
        onZoom={(src, naturalWidth) => setZoom({ src, naturalWidth })}
      />
      {question.items.length > 0 && (
        <div className="mt-6 rounded-3xl bg-white/60 p-4 dark:bg-white/5">
          <h2 className="mb-3 font-bold">小問を答える</h2>
          {question.items.map((item, index) => {
            const label = item.label ?? String(index + 1);
            const answerVisible = revealed;
            return (
              <div key={label} className="mb-5">
                <p className="mb-2 text-sm font-bold">
                  {label}
                  {answerVisible && (
                    <span
                      className={`ml-2 ${selected[label] === item.answer ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {selected[label] === item.answer ? "○" : "×"} 正解:{" "}
                      {item.answer}
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                  {(item.choices ?? []).map((choice) => (
                    <button
                      key={choice}
                      className={`min-h-9 rounded-lg border px-1 text-sm font-bold ${selected[label] === choice ? "border-emerald-700 bg-emerald-700 text-white" : "border-black/10 bg-white/70 dark:bg-white/10"}`}
                      onClick={() =>
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
      <button
        className="mt-5 w-full rounded-2xl bg-emerald-800 px-4 py-4 font-bold text-white"
        onClick={() => setRevealed(true)}
      >
        解答を見る{" "}
        {question.items.length > 0 && `（${auto.correct}/${auto.total}）`}
      </button>
      {revealed && (
        <div className="mt-5 space-y-5">
          <ImageStack
            images={question.answer}
            label="解答"
            onZoom={(src, naturalWidth) => setZoom({ src, naturalWidth })}
          />
          <ImageStack
            images={question.explain}
            label="解説"
            onZoom={(src, naturalWidth) => setZoom({ src, naturalWidth })}
          />
          <div className="rounded-3xl border border-emerald-700/30 bg-emerald-50 p-4 dark:bg-emerald-950/30">
            <p className="mb-1 font-bold">自己採点</p>
            {question.items.length > 0 && (
              <p className="mb-3 text-sm opacity-75">
                記号の正解率: {Math.round(auto.ratio * 100)}% → 初期提案{" "}
                {suggestedScore}点
              </p>
            )}
            <div className="grid grid-cols-4 gap-2">
              {[
                [question.points, "満点"],
                [question.points * 0.7, "7割"],
                [question.points * 0.5, "半分"],
                [0, "0点"],
              ].map(([value, label]) => (
                <button
                  key={label as string}
                  className="rounded-xl bg-white px-2 py-3 text-sm font-bold dark:bg-white/10"
                  onClick={() => onFinish(value as number)}
                >
                  {label as string}
                  <br />
                  <span className="opacity-60">{value as number}</span>
                </button>
              ))}
            </div>
            <input
              className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-3 dark:bg-white/10"
              type="number"
              min="0"
              max={question.points}
              placeholder="点数を入力"
              onKeyDown={(event) => {
                if (event.key === "Enter")
                  onFinish(
                    Math.max(
                      0,
                      Math.min(
                        question.points,
                        Number(event.currentTarget.value),
                      ),
                    ),
                  );
              }}
            />
          </div>
        </div>
      )}
      {zoom && (
        <ImageViewer
          src={zoom.src}
          naturalWidth={zoom.naturalWidth}
          onClose={() => setZoom(null)}
        />
      )}
    </section>
  );
}
