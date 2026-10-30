import { useEffect, useState } from "react";
import { loadExamBundle, loadIndex, type IndexData } from "./bundles";
import type { FullQuestion } from "../components/types";
import type { Subject } from "./schedule";
const dataDir = import.meta.env.VITE_DATA_DIR || "data";
export const dataBaseUrl = `${import.meta.env.BASE_URL}${dataDir}`;
const makeMetadata = (index: IndexData): FullQuestion[] =>
  index.exams.flatMap((exam) =>
    exam.questions.map((question) => ({
      ...question,
      id: `${exam.id}-${question.no}`,
      examId: exam.id,
      round: exam.round,
      subject: exam.subject,
      mock: exam.mock,
      problem: [],
      answer: [],
      explain: [],
      items: [],
    })),
  );

export function useExamData(
  key: CryptoKey | null,
  setError: (error: string) => void,
) {
  const [index, setIndex] = useState<IndexData | null>(null);
  const [questions, setQuestions] = useState<FullQuestion[]>([]);
  const [mockLoading, setMockLoading] = useState(false);
  useEffect(() => {
    loadIndex(dataBaseUrl)
      .then((data) => {
        setIndex(data);
        setQuestions(makeMetadata(data));
      })
      .catch(() =>
        setError("データを読み込めません。index.jsonを確認してください。"),
      );
  }, []);
  const loadQuestion = async (metadata: FullQuestion) => {
    if (!key || !index) return;
    const exam = index.exams.find(
      (candidate) => candidate.id === metadata.examId,
    );
    if (!exam) throw new Error("対象の回が見つかりません");
    const bundle = await loadExamBundle(dataBaseUrl, exam, key);
    const source = bundle.questions.find(
      (question) => question.no === metadata.no,
    );
    if (!source) throw new Error("対象の大問が見つかりません");
    const full = { ...metadata, ...source };
    setQuestions((all) =>
      all.map((question) => (question.id === metadata.id ? full : question)),
    );
  };
  const startMock = async (subject: Subject) => {
    if (!key || !index) return;
    const exam = index.exams.find(
      (candidate) => candidate.mock && candidate.subject === subject,
    );
    if (!exam) return;
    setMockLoading(true);
    setError("");
    try {
      const bundle = await loadExamBundle(dataBaseUrl, exam, key);
      const loaded = bundle.questions.map((question) => ({
        ...question,
        id: `${exam.id}-${question.no}`,
        examId: exam.id,
        round: exam.round,
        subject: exam.subject,
        mock: exam.mock,
      }));
      setQuestions((all) => [
        ...all.filter((q) => q.examId !== exam.id),
        ...loaded,
      ]);
    } catch {
      setError("模試データの読み込みに失敗しました。");
    } finally {
      setMockLoading(false);
    }
  };

  return { index, questions, loadQuestion, startMock, mockLoading };
}
