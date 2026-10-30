import { queueFor, type Subject } from "../lib/schedule";
import type { RecordsState } from "../lib/records";
import { SUBJECT_LABEL, type FullQuestion } from "./types";
export function Cats({
  questions,
  records,
  onBack,
  onStart,
}: {
  questions: FullQuestion[];
  records: RecordsState;
  onBack: () => void;
  onStart: (subject: Subject) => void;
}) {
  return (
    <section className="home-pad">
      <div className="bar">
        <button className="back" onClick={onBack}>
          ←
        </button>
        <div className="ttl">科目を選択</div>
      </div>
      <div className="stack">
        {(["zaibun", "zaihyou", "genka"] as Subject[]).map((subject) => {
          const all = questions.filter((q) => !q.mock && q.subject === subject);
          const done = all.filter((q) => records.questionRecords[q.id]).length;
          const due = queueFor(
            "review",
            questions,
            records.questionRecords,
            new Date(),
          ).filter((q) => q.subject === subject).length;
          return (
            <button
              className="card"
              disabled={!all.length}
              key={subject}
              onClick={() => onStart(subject)}
            >
              <h2>{SUBJECT_LABEL[subject]}</h2>
              <p>
                {all.length
                  ? `${all.length}題中 ${done}題解いた・${due}題は復習の時期`
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
