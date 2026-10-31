import { queueFor, type Subject } from "../lib/schedule";
import type { RecordsState } from "../lib/records";
import { SUBJECT_LABEL, type FullQuestion, type Grade } from "./types";

// 2級は大問の番号で分ける（仕訳だけ続けて解ける）。第3・4問は回によって中身が入れ替わる
const KYU2_GROUPS: [number, string][] = [
  [1, "第1問 仕訳"],
  [2, "第2問 計算"],
  [3, "第3問 原価計算・勘定記入など"],
  [4, "第4問 原価計算・用語など"],
  [5, "第5問 精算表"],
];

export function Cats({
  questions,
  grade,
  records,
  onBack,
  onStart,
}: {
  questions: FullQuestion[];
  grade: Grade;
  records: RecordsState;
  onBack: () => void;
  onStart: (subject: Subject, no?: number) => void;
}) {
  const groups: { key: string; title: string; subject: Subject; no?: number }[] =
    grade === 1
      ? (["zaibun", "zaihyou", "genka"] as Subject[]).map((subject) => ({
          key: subject,
          title: SUBJECT_LABEL[subject],
          subject,
        }))
      : KYU2_GROUPS.map(([no, title]) => ({ key: `${no}`, title, subject: "kyu2", no }));
  const due = queueFor("review", questions, records.questionRecords, new Date());
  return (
    <section className="home-pad">
      <div className="bar">
        <button className="back" onClick={onBack}>
          ←
        </button>
        <div className="ttl">{grade === 1 ? "科目を選択" : "大問を選択"}</div>
      </div>
      <div className="stack">
        {groups.map((group) => {
          const match = (q: { subject: Subject; no: number }) =>
            q.subject === group.subject && (group.no === undefined || q.no === group.no);
          const all = questions.filter((q) => !q.mock && match(q));
          const done = all.filter((q) => records.questionRecords[q.id]).length;
          const dueCount = due.filter(match).length;
          return (
            <button
              className="card"
              disabled={!all.length}
              key={group.key}
              onClick={() => onStart(group.subject, group.no)}
            >
              <h2>{group.title}</h2>
              <p>
                {all.length
                  ? `${all.length}題中 ${done}題解いた・${dueCount}題は復習の時期`
                  : "収録なし"}
              </p>
              <span className="go">解く →</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
