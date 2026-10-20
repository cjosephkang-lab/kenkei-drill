import { useEffect, useMemo, useState } from "react";
import { loadExamBundle, loadIndex, verifyPassword, type IndexData } from "./lib/bundles";
import { exportKeyForStorage, importKeyFromStorage } from "./lib/crypto";
import { nextReviewDays, orderTodayQuestions, type Subject } from "./lib/schedule";
import { addStudyRecord, loadRecords, saveRecords, studyMinutesByDay, type RecordsState } from "./lib/records";
import { startStudy, touchStudy, shouldResumeStudy, type ActiveStudy } from "./lib/study";
import { Mock } from "./components/Mock";
import { Question } from "./components/Question";
import { Settings } from "./components/Settings";
import { Shell } from "./components/Shell";
import { Stats } from "./components/Stats";
import { Today } from "./components/Today";
import { Unlock } from "./components/Unlock";
import type { FullQuestion, Page } from "./components/types";

const KEY_STORAGE = "kenkei-drill.key.v1";
const dataDir = import.meta.env.VITE_DATA_DIR || "data";
const dataBaseUrl = `${import.meta.env.BASE_URL}${dataDir}`;
const todayKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const daysUntil = (date: string) => Math.ceil((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayKey()}T00:00:00`).getTime()) / 86400000);
const ACTIVE_STUDY_KEY = "kenkei-drill.active-study.v1";

const makeMetadata = (index: IndexData): FullQuestion[] => index.exams.flatMap((exam) => exam.questions.map((question) => ({ ...question, id: `${exam.id}-${question.no}`, examId: exam.id, round: exam.round, subject: exam.subject, mock: exam.mock, problem: [], answer: [], explain: [], items: [] })));

function App() {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [index, setIndex] = useState<IndexData | null>(null);
  const [questions, setQuestions] = useState<FullQuestion[]>([]);
  const [records, setRecords] = useState<RecordsState>(() => loadRecords());
  const [page, setPage] = useState<Page>("home");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [error, setError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const [activeStudy, setActiveStudy] = useState<ActiveStudy | null>(() => {
    try { const raw = localStorage.getItem(ACTIVE_STUDY_KEY); return raw ? JSON.parse(raw) as ActiveStudy : null; } catch { return null; }
  });
  const [dark, setDark] = useState(() => localStorage.getItem("kenkei-drill.dark") === "1");

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("kenkei-drill.dark", dark ? "1" : "0"); }, [dark]);
  useEffect(() => { loadIndex(dataBaseUrl).then((data) => { setIndex(data); setQuestions(makeMetadata(data)); }).catch(() => setError("データを読み込めません。index.jsonを確認してください。")); }, []);
  useEffect(() => { const stored = localStorage.getItem(KEY_STORAGE); if (stored) importKeyFromStorage(stored).then(setKey).catch(() => localStorage.removeItem(KEY_STORAGE)); }, []);
  useEffect(() => { if (!startedAt || !activeStudy) return undefined; const timer = window.setInterval(() => {
    const completed = activeStudy?.segments.filter((segment) => segment.completedAt).reduce((sum, segment) => sum + (new Date(segment.completedAt as string).getTime() - new Date(segment.startedAt).getTime()) / 1000, 0) ?? 0;
    setElapsed(Math.min(3600, Math.floor(completed + (Date.now() - new Date(startedAt).getTime()) / 1000)));
  }, 1000);
  const activityTimer = window.setInterval(() => {
    const nextActive = touchStudy(activeStudy, new Date().toISOString());
    setActiveStudy(nextActive);
    localStorage.setItem(ACTIVE_STUDY_KEY, JSON.stringify(nextActive));
  }, 30000);
  return () => { window.clearInterval(timer); window.clearInterval(activityTimer); };
  }, [startedAt, activeStudy]);

  useEffect(() => {
    const refresh = () => setScheduleVersion((value) => value + 1);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => { document.removeEventListener("visibilitychange", refresh); window.clearInterval(timer); };
  }, []);

  const schedule = useMemo(() => orderTodayQuestions(questions, records.questionRecords, new Date()) as FullQuestion[], [questions, records.questionRecords, scheduleVersion]);
  const current = questions.find((question) => question.id === selectedId);
  const todayMinutes = studyMinutesByDay(records.studySessions)[todayKey()] ?? 0;

  const unlock = async (password: string) => {
    if (!index?.exams[0]) { setError("データを読み込んでいます。"); return; }
    try { setError(""); const derived = await verifyPassword(dataBaseUrl, index.exams[0], password); setKey(derived); localStorage.setItem(KEY_STORAGE, await exportKeyForStorage(derived)); } catch { setError("パスワードが違います"); }
  };

  const loadQuestion = async (metadata: FullQuestion) => {
    if (!key || !index) return;
    const exam = index.exams.find((candidate) => candidate.id === metadata.examId);
    if (!exam) throw new Error("対象の回が見つかりません");
    const bundle = await loadExamBundle(dataBaseUrl, exam, key);
    const source = bundle.questions.find((question) => question.no === metadata.no);
    if (!source) throw new Error("対象の大問が見つかりません");
    const full = { ...metadata, ...source };
    setQuestions((currentQuestions) => currentQuestions.map((question) => question.id === metadata.id ? full : question));
    return full;
  };

  const persistRecords = (next: RecordsState) => {
    try { saveRecords(next); setRecords(next); setSaveError(""); return true; } catch { setSaveError("保存できませんでした。設定から記録を書き出してください"); return false; }
  };

  const begin = async (metadata: FullQuestion = schedule[0]) => {
    if (!metadata) return;
    const now = new Date().toISOString();
    const previous = activeStudy?.questionId === metadata.id ? activeStudy : null;
    const nextActive = startStudy(previous, metadata.id, now, crypto.randomUUID());
    setActiveStudy(nextActive); localStorage.setItem(ACTIVE_STUDY_KEY, JSON.stringify(nextActive));
    setSelectedId(metadata.id); setSelected({}); setRevealed(false); setStartedAt(now); setElapsed(0); setPage("study"); setLoadingQuestion(true); setError("");
    try { await loadQuestion(metadata); } catch { setError("読み込みに失敗しました。データ束と鍵を確認してください。"); } finally { setLoadingQuestion(false); }
  };

  const startMock = async (subject: Subject) => {
    if (!key || !index) return;
    const exam = index.exams.find((candidate) => candidate.mock && candidate.subject === subject);
    if (!exam) return;
    setLoadingQuestion(true);
    try { const bundle = await loadExamBundle(dataBaseUrl, exam, key); const loaded = bundle.questions.map((question) => ({ ...question, id: `${exam.id}-${question.no}`, examId: exam.id, round: exam.round, subject: exam.subject, mock: exam.mock })); setQuestions((currentQuestions) => [...currentQuestions.filter((question) => question.examId !== exam.id), ...loaded]); } catch { setError("模試データの読み込みに失敗しました。"); } finally { setLoadingQuestion(false); }
  };

  const finish = (value: number) => {
    if (!current || !startedAt) return;
    const ratio = current.points ? value / current.points : 0;
    const previous = records.questionRecords[current.id];
    const firstLook = previous?.firstLook ?? true;
    const streak = ratio >= .7 ? (previous?.streak ?? 0) + 1 : 0;
    const next = new Date(Date.now() + nextReviewDays(ratio, previous?.streak ?? 0) * 86400000).toISOString();
    const now = new Date().toISOString();
    const currentAttemptId = activeStudy?.questionId === current.id ? activeStudy.attemptId ?? crypto.randomUUID() : crypto.randomUUID();
    const currentSegments = (activeStudy?.questionId === current.id ? activeStudy.segments : [{ startedAt }]).map((segment, index, segments) => index === segments.length - 1 && !segment.completedAt ? { ...segment, completedAt: now } : segment);
    const nextRecord = { questionId: current.id, subject: current.subject, answeredAt: now, nextReviewAt: next, score: value, points: current.points, firstLook, streak,
      ...(previous?.firstLookScore !== undefined ? { firstLookScore: previous.firstLookScore, firstLookPoints: previous.firstLookPoints, firstLookAnsweredAt: previous.firstLookAnsweredAt } : firstLook ? { firstLookScore: value, firstLookPoints: current.points, firstLookAnsweredAt: now } : {}) };
    const nextRecords = { ...records, questionRecords: { ...records.questionRecords, [current.id]: nextRecord } };
    const withStudy = currentSegments.reduce((state, segment) => segment.completedAt ? addStudyRecord(state, { questionId: current.id, subject: current.subject, attemptId: currentAttemptId, startedAt: segment.startedAt, completedAt: segment.completedAt, score: value, points: current.points }) : state, nextRecords);
    if (!persistRecords(withStudy)) return;
    localStorage.removeItem(ACTIVE_STUDY_KEY); setActiveStudy(null); setPage("home"); setSelectedId(null); setStartedAt(null);
  };

  const pauseStudy = () => {
    if (!activeStudy || !startedAt) return;
    const pausedAt = new Date().toISOString();
    const nextActive = { ...activeStudy, segments: activeStudy.segments.map((segment, index, segments) => index === segments.length - 1 ? { ...segment, completedAt: pausedAt } : segment) };
    setActiveStudy(nextActive); setStartedAt(null); localStorage.setItem(ACTIVE_STUDY_KEY, JSON.stringify(nextActive));
  };

  const resumeStudy = () => {
    if (!activeStudy || !current || activeStudy.questionId !== current.id || startedAt) return;
    const now = new Date().toISOString(); const nextActive = { ...activeStudy, segments: [...activeStudy.segments, { startedAt: now }] };
    setActiveStudy(nextActive); setStartedAt(now); localStorage.setItem(ACTIVE_STUDY_KEY, JSON.stringify(nextActive));
  };

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") pauseStudy();
      else if (shouldResumeStudy(page, document.visibilityState)) resumeStudy();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [page, activeStudy, current, startedAt]);

  if (!key) return <Unlock dark={dark} error={error} onUnlock={unlock} />;
  if (!index) return <Shell><div className="p-8 text-center">読み込み中</div></Shell>;

  return <Shell><main className="mx-auto min-h-screen max-w-2xl px-4 pb-24"><header className="flex items-center justify-between py-5"><div><p className="text-xs font-bold tracking-[.18em] text-emerald-700 dark:text-emerald-300">KENKEI DRILL</p><p className="text-sm opacity-60">第40回まで、毎日ひとつ。</p></div><button className="rounded-full border border-black/10 px-3 py-2 text-sm dark:border-white/10" onClick={() => setDark(!dark)}>{dark ? "☀︎" : "☾"}</button></header>{(error || saveError) && <p className="mb-4 rounded-xl bg-red-100 p-3 text-sm text-red-800">{error || saveError}</p>}{page === "home" && <Today index={index} days={daysUntil(index.examDate)} todayMinutes={todayMinutes} goal={records.settings.dailyGoalMinutes} next={schedule[0]} onStart={begin} onNavigate={setPage} />}{page === "study" && (loadingQuestion || !current ? <p className="p-8 text-center">読み込み中</p> : <Question question={current} selected={selected} setSelected={setSelected} revealed={revealed} setRevealed={setRevealed} elapsed={elapsed} onFinish={finish} onBack={() => { pauseStudy(); setPage("home"); setSelectedId(null); }} />)}{page === "stats" && <Stats questions={questions} records={records} />}{page === "mock" && <Mock index={index} questions={questions} records={records} setRecords={persistRecords} loading={loadingQuestion} onStart={startMock} />}{page === "settings" && <Settings records={records} setRecords={persistRecords} onLock={() => { localStorage.removeItem(KEY_STORAGE); window.location.reload(); }} />}</main><nav className="fixed inset-x-0 bottom-0 z-10 border-t border-black/10 bg-[#f5f2e9]/90 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur dark:border-white/10 dark:bg-[#101713]/90"><div className="mx-auto grid max-w-2xl grid-cols-4 gap-1">{([ ["home", "今日"], ["stats", "成績"], ["mock", "模試"], ["settings", "設定"]] as [Page, string][]).map(([id, label]) => <button key={id} className={`rounded-xl px-2 py-2 text-xs ${page === id ? "bg-emerald-800 font-bold text-white" : "opacity-65"}`} onClick={() => { if (page === "study") pauseStudy(); setPage(id); }}>{label}</button>)}</div></nav></Shell>;
}

export default App;
