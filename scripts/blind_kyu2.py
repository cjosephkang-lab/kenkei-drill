#!/usr/bin/env python3
"""2級の文字起こしの誤りを拾う: 答えを伏せた問題を別の AI に解かせ、TAC の答えと欄ごとに比べる。

    python3 scripts/blind_kyu2.py strip <出力フォルダ>          # 答えを消した q*.json を回ごとに書く
    python3 scripts/blind_kyu2.py compare <解答フォルダ>         # AI が埋めた q*.json と source-2kyu を比べる

AI には strip の出力を渡し、答えの所（journal の debit/credit、number/symbol の a、表の {"a": null}/{"s": null}）を
埋めた同じ形の JSON を <解答フォルダ>/<回>/q<番号>.json に書かせる。食い違った欄は、原本と見比べて
文字起こし（問題文）の誤りか、AI の誤りかを人が決める。設計: docs/superpowers/specs/2026-10-31-kyu2-design.md
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TRUTH = ROOT / "source-2kyu"


def strip(q: dict) -> dict:
    out = json.loads(json.dumps(q))
    for part in out["parts"]:
        if part["kind"] == "journal":
            part["debit"] = part["credit"] = None
        elif part["kind"] in ("number", "symbol"):
            part["a"] = None
        else:
            for row in part["rows"]:
                for c, cell in enumerate(row):
                    if isinstance(cell, dict):
                        row[c] = {"s": None} if "s" in cell else {"a": None}
    return out


def totals(lines) -> dict:
    out: dict = {}
    for code, value in lines or []:
        out[code] = out.get(code, 0) + value
    return out


def compare(truth: dict, solved: dict, where: str) -> list[str]:
    diffs = []
    for i, (t, s) in enumerate(zip(truth["parts"], solved["parts"])):
        at = f"{where} {t['label']}"
        if t["kind"] == "journal":
            if totals(t["debit"]) != totals(s.get("debit")) or totals(t["credit"]) != totals(s.get("credit")):
                diffs.append(f"{at}: TAC 借{t['debit']} 貸{t['credit']} ／ AI 借{s.get('debit')} 貸{s.get('credit')}")
        elif t["kind"] in ("number", "symbol"):
            if t["a"] != s.get("a"):
                diffs.append(f"{at}: TAC {t['a']} ／ AI {s.get('a')}")
        else:
            for r, (trow, srow) in enumerate(zip(t["rows"], s["rows"])):
                for c, (tc, sc) in enumerate(zip(trow, srow)):
                    if not isinstance(tc, dict):
                        continue
                    want = tc.get("s") if "s" in tc else sum(tc["a"])
                    got = sc.get("s") if "s" in tc else sum(sc.get("a") or [])
                    if want != got:
                        diffs.append(f"{at} 行{r}「{trow[0]}」列{c}: TAC {want} ／ AI {got}")
    return diffs


def main() -> int:
    mode, folder = sys.argv[1], Path(sys.argv[2])
    files = sorted(TRUTH.glob("*/q*.json"))
    if mode == "strip":
        for f in files:
            dest = folder / f.parent.name / f.name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(json.dumps(strip(json.loads(f.read_text(encoding="utf-8"))), ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{len(files)} 大問を書いた: {folder}")
        return 0
    diffs, missing = [], []
    for f in files:
        solved = folder / f.parent.name / f.name
        if not solved.exists():
            missing.append(f"{f.parent.name}/{f.name}")
            continue
        diffs += compare(json.loads(f.read_text(encoding="utf-8")), json.loads(solved.read_text(encoding="utf-8")), f"{f.parent.name}/{f.name}")
    for d in diffs:
        print(d)
    print(f"食い違い {len(diffs)} 件・解答なし {missing or 0}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
