import { useEffect, useMemo, useState } from "react";
import { verifyPassword } from "./lib/bundles";
import { useExamData, dataBaseUrl } from "./lib/useExamData";
import { exportKeyForStorage, importKeyFromStorage } from "./lib/crypto";
import {
  orderTodayQuestions,
  queueFor,
  type QueueMode,
  type Subject,
} from "./lib/schedule";
import {
  loadRecords,
  saveRecords,
  studyMinutesByDay,
  type RecordsState,
} from "./lib/records";
import { useStudy } from "./lib/useStudy";
import { useSession } from "./lib/useSession";
import { useRecordFiles } from "./lib/useRecordFiles";
import { completeQuestion } from "./lib/session";
import { Cats } from "./components/Cats";
import { Result } from "./components/Result";
import { Mock } from "./components/Mock";
import { Question } from "./components/Question";
import { Kyu2Question } from "./components/Kyu2Question";
import { Shell } from "./components/Shell";
import { Today } from "./components/Today";
import { Unlock } from "./components/Unlock";
import type { FullQuestion, Grade, Page } from "./components/types";
import { SHOWN_GRADES, SUBJECT_LABEL, gradeOf } from "./components/types";

const KEY_STORAGE = "kenkei-drill.key.v1";
const GRADE_STORAGE = "kenkei-drill.grade.v1";
const todayKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const daysUntil = (date: string) =>
  Math.ceil(
    (new Date(`${date}T00:00:00`).getTime() -
      new Date(`${todayKey()}T00:00:00`).getTime()) /
      86400000,
  );

function App() {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [records, setRecords] = useState<RecordsState>(() => loadRecords());
  const [page, setPage] = useState<Page>("home");
  const [grade, setGradeState] = useState<Grade>(() => {
    const stored = Number(localStorage.getItem(GRADE_STORAGE)) as Grade;
    return SHOWN_GRADES.includes(stored) ? stored : SHOWN_GRADES[0];
  });
  const setGrade = (value: Grade) => {
    setGradeState(value);
    try {
      localStorage.setItem(GRADE_STORAGE, String(value));
    } catch {
      // 保存できない端末では、開き直すと1級に戻るだけ
    }
  };
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const { session, begin: beginSession, advance } = useSession();
  const study = useStudy(page, selectedId ?? undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { index, questions, loadQuestion, startMock, mockLoading } =
    useExamData(key, setError);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  useEffect(() => {
    const stored = localStorage.getItem(KEY_STORAGE);
    if (stored)
      importKeyFromStorage(stored)
        .then(setKey)
        .catch(() => localStorage.removeItem(KEY_STORAGE));
  }, []);
  useEffect(() => {
    const refresh = () => setScheduleVersion((value) => value + 1);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
    };
  }, []);
  const visible = useMemo(
    () => questions.filter((question) => gradeOf(question.subject) === grade),
    [questions, grade],
  );
  const schedule = useMemo(
    () =>
      orderTodayQuestions(
        visible,
        records.questionRecords,
        new Date(),
      ) as FullQuestion[],
    [visible, records.questionRecords, scheduleVersion],
  );
  const current = questions.find((question) => question.id === selectedId);
  const todayMinutes =
    studyMinutesByDay(records.studySessions)[todayKey()] ?? 0;
  const persist = (next: RecordsState) => {
    try {
      saveRecords(next);
      setRecords(next);
      setError("");
      return true;
    } catch {
      setError("保存できませんでした。記録を書き出してください");
      return false;
    }
  };
  const files = useRecordFiles(records, persist, setError);
  const lock = () => {
    if (!window.confirm("鍵を削除してロックしますか？")) return;
    localStorage.removeItem(KEY_STORAGE);
    window.location.reload();
  };
  const unlock = async (password: string) => {
    if (!index?.exams[0]) return setError("データを読み込んでいます。");
    try {
      const derived = await verifyPassword(
        dataBaseUrl,
        index.exams[0],
        password,
      );
      setKey(derived);
      localStorage.setItem(KEY_STORAGE, await exportKeyForStorage(derived));
    } catch {
      setError("パスワードが違います");
    }
  };
  const openQuestion = async (metadata: FullQuestion) => {
    study.start(metadata.id);
    setSelectedId(metadata.id);
    setSelected({});
    setRevealed(false);
    setPage("study");
    setLoading(true);
    setError("");
    try {
      await loadQuestion(metadata);
    } catch {
      setError("読み込みに失敗しました。データ束と鍵を確認してください。");
    } finally {
      setLoading(false);
    }
  };
  const begin = (items: FullQuestion[], name: string) => {
    if (!items[0]) return;
    beginSession(items, name);
    void openQuestion(items[0]);
  };
  const beginMode = (mode: QueueMode, subject?: Subject, no?: number) => {
    const items = queueFor(
      mode,
      visible,
      records.questionRecords,
      new Date(),
      subject,
      no,
    ) as FullQuestion[];
    begin(
      items,
      mode === "subject" && subject
        ? `科目別：${SUBJECT_LABEL[subject]}${no ? ` 第${no}問` : ""}`
        : mode === "review"
          ? "復習"
          : mode === "unsolved"
            ? "まだ解いていない大問"
            : "今日の学習",
    );
  };
  const finish = (value: number) => {
    if (!current || !study.startedAt) return false;
    const updated = completeQuestion(
      records,
      current,
      value,
      study.activeStudy,
      study.startedAt,
      new Date().toISOString(),
    );
    if (!persist(updated)) return false;
    study.clear();
    const next = advance({ score: value, points: current.points });
    if (next) void openQuestion(next);
    else setPage("result");
    return true;
  };
  if (!key) return <Unlock error={error} onUnlock={unlock} />;
  if (!index)
    return (
      <Shell>
        <div className="wrap">
          <p className="q-body">読み込み中</p>
        </div>
      </Shell>
    );
  // 2級の束が読めなかった時に、1級の自己採点の画面へ落ちないようにする
  if (
    page === "study" &&
    (loading || !current || (current.subject === "kyu2" && !current.kyu2))
  )
    return (
      <Shell>
        <div className="wrap">
          <div className="q-top">
            <div className="prog" />
            <button
              className="q-close"
              aria-label="ホームに戻る"
              onClick={() => {
                study.pause();
                setPage("home");
              }}
            >
              ×
            </button>
          </div>
          <p className="q-body">{error || "読み込み中"}</p>
        </div>
      </Shell>
    );
  const body =
    page === "home" ? (
      <Today
        index={index}
        questions={visible}
        grade={grade}
        onGrade={setGrade}
        records={records}
        days={daysUntil(index.examDate)}
        todayMinutes={todayMinutes}
        next={schedule[0]}
        onStart={() => beginMode("today")}
        onMode={beginMode}
        onNavigate={setPage}
        onGoal={(value) =>
          persist({ ...records, settings: { dailyGoalMinutes: value } })
        }
        onExport={files.download}
        onImport={() => files.fileInput.current?.click()}
        onLock={lock}
      />
    ) : page === "cats" ? (
      <Cats
        questions={visible}
        grade={grade}
        records={records}
        onBack={() => setPage("home")}
        onStart={(subject, no) => beginMode("subject", subject, no)}
      />
    ) : page === "mock" ? (
      <Mock
        index={index}
        questions={questions}
        records={records}
        setRecords={persist}
        loading={mockLoading}
        onStart={startMock}
        onBack={() => setPage("home")}
      />
    ) : page === "study" && current?.kyu2 ? (
      <Kyu2Question
        key={current.id}
        question={current}
        elapsed={study.elapsed}
        onFinish={finish}
        position={session.index + 1}
        total={session.queue.length}
        onBack={() => {
          study.pause();
          setPage("home");
        }}
      />
    ) : page === "study" ? (
      <Question
        question={current as FullQuestion}
        selected={selected}
        setSelected={setSelected}
        revealed={revealed}
        setRevealed={setRevealed}
        elapsed={study.elapsed}
        onFinish={finish}
        position={session.index + 1}
        total={session.queue.length}
        onBack={() => {
          study.pause();
          setPage("home");
        }}
      />
    ) : (
      <Result
        session={session}
        records={records}
        todayMinutes={todayMinutes}
        onContinue={() => beginMode("today")}
        onHome={() => setPage("home")}
      />
    );
  return (
    <Shell>
      <div className="wrap">
        {error && (
          <p className="q-body" role="alert">
            {error}
          </p>
        )}
        {body}
        <input
          ref={files.fileInput}
          type="file"
          accept="application/json"
          hidden
          onChange={(event) => {
            void files.upload(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
      </div>
    </Shell>
  );
}
export default App;
