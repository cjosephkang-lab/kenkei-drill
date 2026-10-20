import { estimateSubjectScore, countFirstLooks } from "../lib/scoring";
import { studyMinutesByDay, type RecordsState } from "../lib/records";
import type { Subject } from "../lib/schedule";
import { SUBJECT_LABEL, type FullQuestion } from "./types";

export function Stats({ questions, records }: { questions: FullQuestion[]; records: RecordsState }) {
  const scoring = questions.map((question) => ({ ...question, firstLook: records.questionRecords[question.id]?.firstLook ?? false, score: records.questionRecords[question.id]?.score }));
  const days = studyMinutesByDay(records.studySessions);
  return <section><h1 className="mb-6 text-3xl font-black">成績</h1><div className="space-y-3">{(["zaibun", "zaihyou", "genka"] as Subject[]).map((subject) => <div key={subject} className="rounded-3xl bg-white/70 p-5 dark:bg-white/5"><div className="flex items-end justify-between"><h2 className="font-bold">{SUBJECT_LABEL[subject]}</h2><strong className="text-3xl">{estimateSubjectScore(scoring, subject).toFixed(1)}<span className="text-sm">点</span></strong></div><div className="mt-3 h-2 rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-emerald-700" style={{ width: `${Math.min(100, estimateSubjectScore(scoring, subject))}%` }} /><div className="relative -top-2 border-t border-dashed border-red-500" style={{ marginLeft: "70%" }} /></div><p className="mt-3 text-sm opacity-60">初見 {countFirstLooks(scoring, subject)}問 / 全{questions.filter((question) => question.subject === subject && !question.mock).length}問　合格ライン 70点　模試 {records.mockScores[`39-${subject}`] ?? "—"}点</p></div>)}</div><div className="mt-6 rounded-3xl bg-white/70 p-5 dark:bg-white/5"><h2 className="mb-3 font-bold">日ごとの学習時間</h2>{Object.entries(days).sort().slice(-7).map(([day, minutes]) => <div className="flex justify-between border-b border-black/5 py-2 text-sm dark:border-white/5" key={day}><span>{day}</span><span>{Math.round(minutes)}分</span></div>)}</div></section>;
}
