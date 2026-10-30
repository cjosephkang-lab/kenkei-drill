import { sessionScore } from "../lib/scoring";
import { studyStreak, type RecordsState } from "../lib/records";
import type { SessionState } from "../lib/session";
export function Result({
  session,
  records,
  todayMinutes,
  onContinue,
  onHome,
}: {
  session: SessionState;
  records: RecordsState;
  todayMinutes: number;
  onContinue: () => void;
  onHome: () => void;
}) {
  const { name: sessionName, results: sessionResults } = session;
  return (
    <section className="result">
      <h1>おつかれさまでした</h1>
      <p>{sessionName}</p>
      <div className="circle">
        <strong>{Math.round(sessionScore(sessionResults) * 100)}%</strong>
        <span>
          {sessionResults.reduce((sum, result) => sum + result.score, 0)} /{" "}
          {sessionResults.reduce((sum, result) => sum + result.points, 0)}
        </span>
      </div>
      <div className="tiles">
        <div className="tile">
          <strong>{sessionResults.length}</strong>
          <span>解いた大問</span>
        </div>
        <div className="tile">
          <strong>{studyStreak(records.studySessions)}</strong>
          <span>連続学習（日）</span>
        </div>
        <div className="tile">
          <strong>{Math.round(todayMinutes)}</strong>
          <span>今日の学習（分）</span>
        </div>
      </div>
      <p className="result-note">
        {sessionScore(sessionResults) >= 0.7
          ? "合格ラインの70%を超えました。この調子で続けましょう。"
          : "70%未満の大問は明日もう一度出ます。"}
      </p>
      <button className="start-btn" onClick={onContinue}>
        続けて学習する
      </button>
      <button className="home-btn" onClick={onHome}>
        ホームに戻る
      </button>
    </section>
  );
}
