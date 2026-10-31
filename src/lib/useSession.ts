import { useState } from "react";
import type { FullQuestion } from "../components/types";
import {
  advanceSession,
  backSession,
  forwardSession,
  type SessionResult,
  type SessionState,
} from "./session";

export function useSession() {
  const [session, setSession] = useState<SessionState>({
    queue: [],
    index: 0,
    results: [],
    name: "今日の学習",
  });
  const begin = (queue: FullQuestion[], name: string) => {
    setSession({ queue, index: 0, results: [], name });
  };
  const advance = (result: SessionResult) => {
    const next = advanceSession(session, result);
    setSession(next);
    return next.queue[next.index];
  };
  const back = () => {
    const next = backSession(session);
    setSession(next);
    return next.queue[next.index];
  };
  const forward = () => {
    const next = forwardSession(session);
    setSession(next);
    return next.queue[next.index];
  };
  return { session, begin, advance, back, forward };
}
