import { useEffect, useState } from "react";
import {
  shouldResumeStudy,
  startStudy,
  touchStudy,
  type ActiveStudy,
} from "./study";

const ACTIVE_STUDY_KEY = "kenkei-drill.active-study.v1";

export function useStudy(page: string, questionId?: string) {
  const [activeStudy, setActiveStudy] = useState<ActiveStudy | null>(() => {
    try {
      const raw = localStorage.getItem(ACTIVE_STUDY_KEY);
      return raw ? (JSON.parse(raw) as ActiveStudy) : null;
    } catch {
      return null;
    }
  });
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const store = (next: ActiveStudy) => {
    setActiveStudy(next);
    localStorage.setItem(ACTIVE_STUDY_KEY, JSON.stringify(next));
  };
  const start = (id: string) => {
    const now = new Date().toISOString();
    const next = startStudy(
      activeStudy?.questionId === id ? activeStudy : null,
      id,
      now,
      crypto.randomUUID(),
    );
    store(next);
    setStartedAt(now);
    setElapsed(0);
  };
  const clear = () => {
    localStorage.removeItem(ACTIVE_STUDY_KEY);
    setActiveStudy(null);
    setStartedAt(null);
  };
  const pause = () => {
    if (!activeStudy || !startedAt) return;
    const now = new Date().toISOString();
    store({
      ...activeStudy,
      segments: activeStudy.segments.map((segment, i, all) =>
        i === all.length - 1 && !segment.completedAt
          ? { ...segment, completedAt: now }
          : segment,
      ),
    });
    setStartedAt(null);
  };
  const resume = () => {
    if (!activeStudy || activeStudy.questionId !== questionId || startedAt)
      return;
    const now = new Date().toISOString();
    store({
      ...activeStudy,
      segments: [...activeStudy.segments, { startedAt: now }],
    });
    setStartedAt(now);
  };

  useEffect(() => {
    if (!startedAt || !activeStudy) return;
    const updateElapsed = () => {
      const completed = activeStudy.segments.reduce(
        (sum, segment) =>
          sum +
          (segment.completedAt
            ? (new Date(segment.completedAt).getTime() -
                new Date(segment.startedAt).getTime()) /
              1000
            : 0),
        0,
      );
      setElapsed(
        Math.min(
          3600,
          Math.floor(
            completed + (Date.now() - new Date(startedAt).getTime()) / 1000,
          ),
        ),
      );
    };
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 1000);
    const activity = window.setInterval(
      () => store(touchStudy(activeStudy, new Date().toISOString())),
      30000,
    );
    return () => {
      window.clearInterval(timer);
      window.clearInterval(activity);
    };
  }, [startedAt, activeStudy]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") pause();
      else if (shouldResumeStudy(page, document.visibilityState)) resume();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [page, questionId, activeStudy, startedAt]);

  return { activeStudy, startedAt, elapsed, start, clear, pause };
}
