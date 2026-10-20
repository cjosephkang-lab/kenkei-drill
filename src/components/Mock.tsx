import { useEffect, useState } from "react";
import { imageWidthPercent } from "../lib/images";
import type { RecordsState } from "../lib/records";
import type { Subject } from "../lib/schedule";
import type { FullQuestion, IndexData } from "./types";

function MockImage({ src, alt }: { src: string; alt: string }) {
  const [naturalWidth, setNaturalWidth] = useState(1300);
  return <img className="block h-auto max-w-full rounded-2xl border border-black/10 bg-white shadow-sm" style={{ width: "100%", maxWidth: `${imageWidthPercent(naturalWidth)}%` }} src={src} alt={alt} onLoad={(event) => setNaturalWidth(event.currentTarget.naturalWidth)} />;
}

export function Mock({ index, questions, records, setRecords, loading, onStart }: { index: IndexData; questions: FullQuestion[]; records: RecordsState; setRecords: (value: RecordsState) => void; loading: boolean; onStart: (subject: Subject) => void }) {
  const [subject, setSubject] = useState<Subject>("zaibun");
  const [running, setRunning] = useState(false);
  const [started, setStarted] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(5400);
  const [score, setScore] = useState("");
  const mock = questions.filter((question) => question.mock && question.subject === subject);
  useEffect(() => { if (!running || !started) return undefined; const timer = window.setInterval(() => setRemaining(Math.max(0, 5400 - Math.floor((Date.now() - started) / 1000))), 1000); return () => window.clearInterval(timer); }, [running, started]);
  const start = () => { onStart(subject); setStarted(Date.now()); setRemaining(5400); setRunning(true); };
  const save = () => { const value = Number(score); if (!Number.isFinite(value)) return; const next = { ...records, mockScores: { ...records.mockScores, [`39-${subject}`]: value } }; setRecords(next); setRunning(false); };
  const mm = Math.floor(remaining / 60);
  return <section><h1 className="mb-2 text-3xl font-black">模試</h1><p className="mb-6 opacity-60">第39回・90分。大問を通しで解き、最後にまとめて自己採点します。</p>{!running ? <><div className="rounded-3xl bg-emerald-950 p-5 text-white"><label className="text-sm text-emerald-200">科目を選ぶ<select className="mt-2 block w-full rounded-xl bg-white/10 p-3 text-white" value={subject} onChange={(event) => setSubject(event.target.value as Subject)}><option value="zaibun">財務分析</option><option value="zaihyou">財務諸表</option><option value="genka">原価計算</option></select></label><p className="mt-4 text-2xl font-bold">{loading ? "読み込み中" : `${mock.length}題 / 90:00`}</p><button className="mt-4 rounded-xl bg-lime-300 px-4 py-3 font-bold text-emerald-950" onClick={start} disabled={loading}>模試を開始</button></div><div className="mt-5 rounded-3xl bg-white/70 p-5 dark:bg-white/5"><p className="text-sm opacity-60">記録済み</p><p className="text-3xl font-black">{records.mockScores[`39-${subject}`] ?? "—"}<span className="text-sm"> / 100点</span></p></div></> : <><div className="sticky top-2 z-10 mb-4 flex items-center justify-between rounded-2xl bg-red-800 p-4 font-mono text-xl text-white"><span>残り {mm}:{String(remaining % 60).padStart(2, "0")}</span><button className="rounded-xl bg-white/20 px-3 py-2 text-sm font-sans" onClick={() => setRunning(false)}>終了して採点</button></div>{loading ? <p className="rounded-2xl bg-white/70 p-5">読み込み中</p> : <div className="space-y-8">{mock.map((question) => <div key={question.id}><p className="mb-2 font-bold">大問 {question.no} / {question.points}点</p>{question.problem.map((src, index) => <MockImage key={`${src}-${index}`} src={src} alt={`問題${question.no}-${index + 1}`} />)}</div>)}</div>}</>}{!running && started && <div className="mt-5 rounded-3xl border border-emerald-700/30 bg-emerald-50 p-5 dark:bg-emerald-950/30"><p className="font-bold">模試の自己採点</p><input className="mt-3 w-full rounded-xl border border-black/10 bg-white px-3 py-3 dark:bg-white/10" placeholder="点数" value={score} onChange={(event) => setScore(event.target.value)} /><button className="mt-3 w-full rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white" onClick={save}>模試の点数を保存</button></div>}<p className="mt-5 text-xs opacity-50">{index.exams.filter((exam) => exam.mock).length ? "第39回は通常ドリルから除外されています。" : "mock=true のデータがありません。"}</p></section>;
}
