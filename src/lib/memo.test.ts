import { beforeEach, describe, expect, it } from "vitest";
import { loadMemo, saveMemo } from "./memo";

describe("振り返りメモ", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
      },
    });
  });

  it("大問ごとに残し、空にしたら消す", () => {
    saveMemo("382-5", "減価償却の月割りを忘れた");
    saveMemo("382-1", "社債は払込額で");
    expect(loadMemo("382-5")).toBe("減価償却の月割りを忘れた");
    saveMemo("382-5", "  ");
    expect(loadMemo("382-5")).toBe("");
    expect(loadMemo("382-1")).toBe("社債は払込額で");
  });

  it("壊れた保存は空として読む", () => {
    localStorage.setItem("kenkei-drill.memo.v1", "{");
    expect(loadMemo("382-5")).toBe("");
  });
});
