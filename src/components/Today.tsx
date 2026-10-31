import type { IndexData } from "../lib/bundles";
import { countModes, SUBJECT_ORDER, type QueueMode } from "../lib/schedule";
import {
  studyMinutesByDay,
  studyStreak,
  type RecordsState,
} from "../lib/records";
import { estimateSubjectScore, countFirstLooks } from "../lib/scoring";
import {
  SHOWN_GRADES,
  type FullQuestion,
  type Grade,
  type Page,
} from "./types";
import { SUBJECT_LABEL } from "./types";

const dateText = (date: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00`));

export function Today({
  index,
  questions,
  grade,
  onGrade,
  records,
  days,
  todayMinutes,
  next,
  onStart,
  onMode,
  onNavigate,
  onGoal,
  onExport,
  onImport,
  onLock,
}: {
  index: IndexData;
  questions: FullQuestion[];
  grade: Grade;
  onGrade: (grade: Grade) => void;
  records: RecordsState;
  days: number;
  todayMinutes: number;
  next?: FullQuestion;
  onStart: (question?: FullQuestion) => void;
  onMode: (mode: QueueMode) => void;
  onNavigate: (page: Page) => void;
  onGoal: (value: number) => void;
  onExport?: () => void;
  onImport?: () => void;
  onLock?: () => void;
}) {
  const eligible = questions.filter((question) => !question.mock);
  const modes = countModes(questions, records.questionRecords, new Date());
  const subjects = SUBJECT_ORDER.filter((s) =>
    grade === 1 ? s !== "kyu2" : s === "kyu2",
  );
  const minutes = studyMinutesByDay(records.studySessions);
  const studied = Math.round(todayMinutes);
  const pct = Math.min(
    100,
    (studied / records.settings.dailyGoalMinutes) * 100,
  );
  const scoring = eligible.map((question) => ({
    ...question,
    firstLook: records.questionRecords[question.id]?.firstLook ?? false,
    score: records.questionRecords[question.id]?.score,
    firstLookScore: records.questionRecords[question.id]?.firstLookScore,
    firstLookPoints: records.questionRecords[question.id]?.firstLookPoints,
  }));
  const rounds = eligible.map((question) => question.round);
  const minRound = Math.min(...rounds);
  const maxRound = Math.max(...rounds);
  const roundText = !rounds.length
    ? "収録なし"
    : minRound === maxRound
      ? `第${minRound}回`
      : `第${minRound}〜${maxRound}回`;
  const mockSubjects = new Set(
    index.exams.filter((exam) => exam.mock).map((exam) => exam.subject),
  ).size;
  return (
    <section className="home-pad">
      <div className="masthead">
        <div>
          <h1>建設業経理士ドリル</h1>
          <p className="sub">
            建設業経理士{grade}級の過去問（{roundText}）
          </p>
        </div>
        <div className="grade">{grade}級・公式過去問</div>
      </div>
      {SHOWN_GRADES.length > 1 && (
        <div className="grade-switch">
          {SHOWN_GRADES.map((value) => (
            <button
              key={value}
              className={`gs ${grade === value ? "on" : ""}`}
              onClick={() => onGrade(value)}
            >
              {value}級
            </button>
          ))}
        </div>
      )}
      <div className="today">
        <div className="today-top">
          <div>
            <div className="cd-label">試験日まで</div>
            <div className="cd-days mono">
              {days}
              <span className="u">日</span>
            </div>
            <div className="cd-date">{dateText(index.examDate)} 実施</div>
          </div>
          <div className="streak">
            <div className="l">連続学習</div>
            <div className="n mono">
              {studyStreak(records.studySessions)}
              <span className="u">日</span>
            </div>
          </div>
        </div>
        <div className="today-goal">
          <div className="goal-row">
            <span className="lbl">今日の学習</span>
            <span className="val mono">
              <b>{studied}</b> / {records.settings.dailyGoalMinutes} 分
            </span>
          </div>
          <div className="pbar">
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="guide">
            {modes.review || modes.unsolved
              ? `今日は復習の時期が来た大問 ${modes.review}題、まだ解いていない大問 ${modes.unsolved}題。`
              : "今日の分は終わりました。科目別で続けられます。"}
          </p>
          <button
            className="start-btn"
            disabled={!next}
            onClick={() => onStart(next)}
          >
            今日の学習を始める
          </button>
        </div>
      </div>
      <div className="slab">学習モード</div>
      <div className="modes">
        <button
          className="mode"
          disabled={!modes.review}
          onClick={() => onMode("review")}
        >
          <div className="m-t">復習</div>
          <div className="m-s">復習の時期が来た大問</div>
          <div className="m-b">{modes.review} 題</div>
        </button>
        <button
          className="mode"
          disabled={!modes.unsolved}
          onClick={() => onMode("unsolved")}
        >
          <div className="m-t">まだ解いていない大問</div>
          <div className="m-s">一度も解いていない大問</div>
          <div className="m-b">{modes.unsolved} 題</div>
        </button>
        <button className="mode" onClick={() => onNavigate("cats")}>
          <div className="m-t">{grade === 1 ? "科目別" : "大問別"}</div>
          <div className="m-s">
            {grade === 1 ? "科目を選んで解く" : "第1〜5問を選んで解く"}
          </div>
          <div className="m-b">{grade === 1 ? "全3科目" : "全5問"}</div>
        </button>
        {grade === 1 && (
          <button
            className="mode"
            disabled={!mockSubjects}
            onClick={() => onNavigate("mock")}
          >
            <div className="m-t">模試</div>
            <div className="m-s">第39回を本番と同じ90分で</div>
            <div className="m-b">{mockSubjects} 科目</div>
          </button>
        )}
      </div>
      <div className="slab">学習状況</div>
      <div className="board">
        <div className="board-head">
          <span>予想点（初見の得点から）</span>
        </div>
        <div className="board-sub">
          解いた大問{" "}
          {eligible.filter((q) => records.questionRecords[q.id]).length}／
          {eligible.length}題
        </div>
        {subjects.map((subject) => {
          const total = eligible.filter((q) => q.subject === subject).length;
          const estimate = estimateSubjectScore(scoring, subject);
          const count = countFirstLooks(scoring, subject);
          return (
            <div key={subject}>
              <div className="subject-row">
                <span>{SUBJECT_LABEL[subject]}</span>
                <span>
                  {count ? (
                    <span className="mono">{estimate.toFixed(1)}点</span>
                  ) : (
                    "まだ解いていない"
                  )}
                </span>
              </div>
              <div className="track">
                <i style={{ width: `${Math.min(100, estimate)}%` }} />
                <b />
              </div>
              <p className="board-note">
                {total ? `${count}／${total}題を初見で解答` : "収録なし"}
              </p>
            </div>
          );
        })}
        <div className="board-sub">直近7日の学習時間</div>
        {Object.entries(minutes)
          .sort()
          .slice(-7)
          .map(([date, value]) => (
            <div className="subject-row" key={date}>
              <span>{date.slice(5)}</span>
              <span className="mono">{Math.round(value)}分</span>
            </div>
          ))}
      </div>
      <div className="slab">設定</div>
      <div className="setting">
        <div className="setting-row">
          <div>
            <strong>1日の目標（分）</strong>
            <p className="board-note">毎日の学習時間の目標</p>
          </div>
          <input
            type="number"
            min="1"
            value={records.settings.dailyGoalMinutes}
            onChange={(event) =>
              onGoal(Math.max(1, Number(event.target.value)))
            }
          />
        </div>
      </div>
      <div className="links">
        <button className="link" onClick={onExport}>
          記録を書き出す
        </button>
        <button className="link" onClick={onImport}>
          記録を読み込む
        </button>
        <button className="link" onClick={onLock}>
          鍵を削除してロック
        </button>
      </div>
      <p className="footnote">
        問題: 一般財団法人 建設業振興基金 公表の試験問題
        {grade === 2 ? "（文字に起こしたもの）。答え・解説" : "。解答・解説"}:
        TAC 解答速報。学習の記録はこの端末のブラウザにだけ保存されます。
      </p>
    </section>
  );
}
