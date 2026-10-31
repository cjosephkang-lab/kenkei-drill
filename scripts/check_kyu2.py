#!/usr/bin/env python3
"""2級の大問データ（source-2kyu/<回>/q<番号>.json）の形と、帳簿の釣り合いを検査する。

使い方: python3 scripts/check_kyu2.py source-2kyu [回 ...]
形の決まり: docs/kyu2-data-format.md
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ZEN = str.maketrans("０１２３４５６７８９，", "0123456789,")


def amount(text: str) -> int | None:
    t = str(text).translate(ZEN).replace(",", "").replace("△", "-").strip()
    if not t or t == "―":
        return None
    try:
        return int(t)
    except ValueError:
        return None


def cell_value(cell) -> int:
    if isinstance(cell, dict):
        return sum(cell.get("a", []))
    return amount(cell) or 0


def check_journal(part: dict, codes: set[str], where: str, errors: list[str]) -> None:
    for side in ("debit", "credit"):
        lines = part.get(side)
        if not lines:
            errors.append(f"{where}: {side} が空")
            return
        for code, value in lines:
            if code not in codes:
                errors.append(f"{where}: 記号 {code} が勘定科目群に無い")
            if not isinstance(value, int) or value <= 0:
                errors.append(f"{where}: 金額 {value} が正の整数でない")
    d = sum(v for _, v in part["debit"])
    c = sum(v for _, v in part["credit"])
    if d != c:
        errors.append(f"{where}: 借方 {d:,} と貸方 {c:,} が合わない")


def check_seisanhyo(part: dict, where: str, errors: list[str]) -> None:
    """精算表: 列は 科目, 試算表借貸, 整理借貸, 損益借貸, 貸借借貸 の9列を前提にする。"""
    rows = part["rows"]
    if any(len(r) != 9 for r in rows):
        errors.append(f"{where}: 精算表の列が9でない行がある")
        return
    body = [r for r in rows if isinstance(r[0], str) and r[0].strip() and "当期" not in r[0] and "合計" not in r[0]]
    net = [r for r in rows if isinstance(r[0], str) and "当期" in r[0]]
    col = lambda i: sum(cell_value(r[i]) for r in body)
    if col(1) != col(2):
        errors.append(f"{where}: 残高試算表 借方 {col(1):,} と貸方 {col(2):,} が合わない")
    if col(3) != col(4):
        errors.append(f"{where}: 整理記入 借方 {col(3):,} と貸方 {col(4):,} が合わない")
    pl = col(6) - col(5)
    bs = col(7) - col(8)
    if pl != bs:
        errors.append(f"{where}: 損益計算書の差額 {pl:,} と貸借対照表の差額 {bs:,} が合わない")
    if net:
        stated = cell_value(net[0][5]) or cell_value(net[0][8])
        if stated and stated != abs(pl):
            errors.append(f"{where}: 当期純利益の行 {stated:,} が差額 {pl:,} と合わない")
    for r in body:  # 1つの科目の行で、試算表＋整理記入が損益か貸借の欄に移っているか
        before = cell_value(r[1]) - cell_value(r[2]) + cell_value(r[3]) - cell_value(r[4])
        after = cell_value(r[5]) - cell_value(r[6]) + cell_value(r[7]) - cell_value(r[8])
        if before != after:
            errors.append(f"{where}: 「{r[0]}」の行が釣り合わない（試算表＋整理 {before:,}／損益・貸借 {after:,}）")


def check_question(path: Path, errors: list[str]) -> int:
    q = json.loads(path.read_text(encoding="utf-8"))
    where = f"{path.parent.name}/{path.name}"
    for key in ("round", "no", "points", "title", "problem", "parts"):
        if key not in q:
            errors.append(f"{where}: {key} が無い")
    codes: set[str] = set()
    for block in q.get("problem", []):
        if block.get("t") == "choices":
            codes |= {code for code, _ in block["items"]}
        elif block.get("t") not in ("p", "table"):
            errors.append(f"{where}: 知らない Block {block.get('t')}")
    if not q.get("parts"):
        errors.append(f"{where}: parts が空")
    for i, part in enumerate(q.get("parts", [])):
        at = f"{where} parts[{i}] {part.get('label', '')}"
        kind = part.get("kind")
        if kind == "journal":
            check_journal(part, codes, at, errors)
        elif kind == "number":
            if not isinstance(part.get("a"), (int, float)):
                errors.append(f"{at}: a が数でない")
        elif kind == "symbol":
            if part.get("a") not in part.get("choices", []):
                errors.append(f"{at}: 答え {part.get('a')} が choices に無い")
        elif kind == "table":
            width = {len(r) for r in part.get("rows", [])} | {len(h) for h in part.get("head", [])}
            if len(width) != 1:
                errors.append(f"{at}: 列の数がそろわない {sorted(width)}")
            inputs = [c for r in part.get("rows", []) for c in r if isinstance(c, dict)]
            for c in inputs:
                if "s" in c and c["s"] not in codes:
                    errors.append(f"{at}: 表の記号 {c['s']} が勘定科目群に無い")
            if not any(c.get("a") or c.get("s") for c in inputs):
                errors.append(f"{at}: 答えの入った欄が無い")
            if "精算表" in part.get("label", "") + part.get("title", ""):
                check_seisanhyo(part, at, errors)
        else:
            errors.append(f"{at}: 知らない kind {kind}")
    return q.get("points", 0)


def main() -> int:
    root = Path(sys.argv[1])
    rounds = sys.argv[2:] or sorted(p.name for p in root.iterdir() if p.is_dir())
    errors: list[str] = []
    for r in rounds:
        files = sorted((root / r).glob("q*.json"))
        if len(files) != 5:
            errors.append(f"{r}: 大問が {len(files)} 個（5個のはず）")
        total = sum(check_question(f, errors) for f in files)
        if total != 100:
            errors.append(f"{r}: 配点の合計が {total}（100のはず）")
    for e in errors:
        print(e)
    print(f"{len(rounds)}回分を検査: 問題 {len(errors)} 件")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
