import { useEffect, useState } from "react";
import { imageWidthPercent } from "../lib/images";
import { ImageViewer } from "./ImageViewer";
import type { RecordsState } from "../lib/records";
import type { Subject } from "../lib/schedule";
import { SUBJECT_LABEL, type FullQuestion, type IndexData } from "./types";

const LIMIT_SECONDS = 5400;
type Phase = "pick" | "running" | "grading";

function Figure({
  src,
  alt,
  onZoom,
}: {
  src: string;
  alt: string;
  onZoom: (src: string) => void;
}) {
  const [naturalWidth, setNaturalWidth] = useState(1300);
  return (
    <button className="q-fig" onClick={() => onZoom(src)}>
      <img
        src={src}
        alt={alt}
        style={{ maxWidth: `${imageWidthPercent(naturalWidth)}%` }}
        onLoad={(event) => setNaturalWidth(event.currentTarget.naturalWidth)}
      />
    </button>
  );
}

export function Mock({
  index,
  questions,
  records,
  setRecords,
  loading,
  onStart,
  onBack,
}: {
  index: IndexData;
  questions: FullQuestion[];
  records: RecordsState;
  setRecords: (value: RecordsState) => boolean;
  loading: boolean;
  onStart: (subject: Subject) => void;
  onBack: () => void;
}) {
  const [subject, setSubject] = useState<Subject | null>(null);
  const [phase, setPhase] = useState<Phase>("pick");
  const [started, setStarted] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(LIMIT_SECONDS);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);

  const mockExams = index.exams.filter((exam) => exam.mock);
  const mock = questions.filter(
    (question) => question.mock && question.subject === subject,
  );

  useEffect(() => {
    if (phase !== "running" || !started) return;
    const timer = window.setInterval(() => {
      const left = Math.max(
        0,
        LIMIT_SECONDS - Math.floor((Date.now() - started) / 1000),
      );
      setRemaining(left);
      if (left === 0) setPhase("grading");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [phase, started]);

  const start = (next: Subject) => {
    onStart(next);
    setSubject(next);
    setScores({});
    setMessage("");
    setStarted(Date.now());
    setRemaining(LIMIT_SECONDS);
    setPhase("running");
  };

  const leave = () => {
    if (
      phase === "running" &&
      !window.confirm("模試を中断してホームに戻りますか？")
    )
      return;
    setPhase("pick");
    onBack();
  };

  const save = () => {
    if (!subject || mock.length === 0) return;
    const values = mock.map((question) => Number(scores[question.id]));
    const invalid = values.some(
      (value, i) =>
        scores[mock[i].id] === undefined ||
        scores[mock[i].id] === "" ||
        !Number.isFinite(value) ||
        value < 0 ||
        value > mock[i].points,
    );
    if (invalid) {
      setMessage("すべての大問に、0から配点までの点数を入れてください。");
      return;
    }
    const total = values.reduce((sum, value) => sum + value, 0);
    const saved = setRecords({
      ...records,
      mockScores: { ...records.mockScores, [`39-${subject}`]: total },
    });
    if (!saved) return;
    setMessage(`${total}点を記録しました。`);
  };

  const mm = Math.floor(remaining / 60);
  const ss = String(remaining % 60).padStart(2, "0");
  const total = mock.reduce(
    (sum, question) => sum + Number(scores[question.id] || 0),
    0,
  );

  return (
    <section className="home-pad">
      <div className="bar">
        <button className="back" onClick={leave} aria-label="ホームに戻る">
          ←
        </button>
        <div className="ttl">
          {phase === "pick" || !subject
            ? "模試"
            : `模試・${SUBJECT_LABEL[subject]}`}
        </div>
      </div>

      {phase === "pick" && (
        <>
          <p className="note">
            第39回を本番と同じ90分で通して解きます。終わったら解答と解説を見て、まとめて自己採点します。普段のドリルには出しません。
          </p>
          {mockExams.length === 0 && (
            <p className="note">模試用の回が収録されていません。</p>
          )}
          {mockExams.map((exam) => {
            const recorded = records.mockScores[`39-${exam.subject}`];
            return (
              <button
                className="card"
                key={exam.id}
                onClick={() => start(exam.subject)}
              >
                <h2>
                  第{exam.round}回 {SUBJECT_LABEL[exam.subject]}
                </h2>
                <p>
                  {exam.questions.length}題・90分
                  {recorded !== undefined ? `・記録 ${recorded}点` : ""}
                </p>
                <span className="go">始める →</span>
              </button>
            );
          })}
        </>
      )}

      {phase === "running" && (
        <>
          <div className="mock-timer">
            <span className="mono">
              残り {mm}:{ss}
            </span>
            <button className="link" onClick={() => setPhase("grading")}>
              終了して採点
            </button>
          </div>
          {loading && <p className="note">読み込み中</p>}
          {!loading &&
            mock.map((question) => (
              <div className="card" key={question.id}>
                <h2>
                  大問{question.no}
                  <span className="mock-pts">{question.points}点</span>
                </h2>
                {question.problem.map((src, i) => (
                  <Figure
                    key={`${src}-${i}`}
                    src={src}
                    alt={`問題${question.no}-${i + 1}`}
                    onZoom={setZoom}
                  />
                ))}
              </div>
            ))}
        </>
      )}

      {phase === "grading" && (
        <>
          <p className="note">
            解答と解説を見て、大問ごとに点数を入れてください。
          </p>
          {mock.map((question) => (
            <div className="card" key={question.id}>
              <h2>
                大問{question.no}
                <span className="mock-pts">{question.points}点</span>
              </h2>
              {[...question.answer, ...question.explain].map((src, i) => (
                <Figure
                  key={`${src}-${i}`}
                  src={src}
                  alt={`解答・解説${question.no}-${i + 1}`}
                  onZoom={setZoom}
                />
              ))}
              <div className="score-grid">
                {[
                  [question.points, "満点"],
                  [question.points * 0.7, "7割"],
                  [question.points * 0.5, "半分"],
                  [0, "0点"],
                ].map(([value, label]) => (
                  <button
                    key={label}
                    onClick={() =>
                      setScores({ ...scores, [question.id]: String(value) })
                    }
                  >
                    {label}
                    <br />
                    <span className="mono">{value}</span>
                  </button>
                ))}
              </div>
              <input
                className="score-input"
                type="number"
                min="0"
                max={question.points}
                placeholder="点数を入力"
                value={scores[question.id] ?? ""}
                onChange={(event) =>
                  setScores({ ...scores, [question.id]: event.target.value })
                }
              />
            </div>
          ))}
          {message && <p className="note">{message}</p>}
          <button className="start-btn" onClick={save}>
            合計 {total}点を記録する
          </button>
        </>
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
