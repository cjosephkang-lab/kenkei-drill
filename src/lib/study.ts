export type StudySegment = { startedAt: string; lastActiveAt?: string; completedAt?: string };
export type ActiveStudy = { questionId: string; attemptId?: string; segments: StudySegment[] };

export const closeOpenStudySegments = (active: ActiveStudy, fallbackTime: string): ActiveStudy => ({
  ...active,
  segments: active.segments.map((segment) => segment.completedAt ? segment : { ...segment, completedAt: segment.lastActiveAt ?? fallbackTime }),
});

export const startStudy = (previous: ActiveStudy | null, questionId: string, now: string, newAttemptId: string): ActiveStudy => {
  const sameQuestion = previous?.questionId === questionId;
  const base = sameQuestion && previous ? closeOpenStudySegments(previous, now) : { questionId, attemptId: newAttemptId, segments: [] };
  return { ...base, questionId, attemptId: base.attemptId ?? newAttemptId, segments: [...base.segments, { startedAt: now }] };
};

export const touchStudy = (active: ActiveStudy, now: string): ActiveStudy => ({
  ...active,
  segments: active.segments.map((segment, index) => index === active.segments.length - 1 && !segment.completedAt ? { ...segment, lastActiveAt: now } : segment),
});

export const shouldResumeStudy = (page: string, visibilityState: string) => page === "study" && visibilityState === "visible";
