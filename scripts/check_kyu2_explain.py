#!/usr/bin/env python3
"""2級の解説の文字起こし（source-2kyu/<回>/e<番号>.json）を TAC の PDF の文字と突き合わせる。

    python3 scripts/check_kyu2_explain.py [回 ...]

文字起こしにある数（3桁以上か小数）が、PDF のその大問の部分に無ければ「PDFに無い数」として出す（写し間違い・足した数）。
PDF にあって文字起こしに無い数は「落ちた数」として出す（省略）。
文の段落（式でない物）は、空白を除いて PDF の文字にそのまま含まれるかを見て、含まれない物を「PDFと違う段落」として出す（言い換え・写し間違い）。
拾えない物: 仕訳の借方と貸方の取り違え・式の＋と－・表の欄の位置・どの欄の解説かの見出し。これは原本の画像と見比べて確かめる（2026-10-31 は Sonnet が全20大問を画像と照合し、codex が見出しの誤りを拾った）。形の決まり: docs/kyu2-data-format.md の「解説」
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
from build_data import KYU2_ROUNDS, ROUNDS, SRC, ZEN  # noqa: E402

# PDF の文字の層にだけあり、印刷では見えない数（同じ位置に重なった古い文字）。画像で確かめた
HIDDEN = {(37, 2): {"1500"}}  # 第37回 第2問(3)「原価＠1,500円」が「原価＠350円」の下に重なっている（2026-10-31）

# PDF の図（枠の中の項目名と金額）を1段落に並べた物。空白を除いても PDF の文字の並びと一致しない。画像で確かめた
LAYOUT_OK = {
    "期首再振替　3,000円　当期分　148,000円　当期支払額　150,000円　期末前払額　5,000円",  # 第35回 第2問 前払費用の図
    "（＊1）投資有価証券の取得原価",  # 第36回 第1問 PDF は半角の括弧
}

HEAD = re.compile(r"〔第[0-9０-９\x02-\x0a]+問〕")


def numbers(text: str) -> Counter:
    t = text.translate(ZEN).replace("，", ",").replace("．", ".")
    t = re.sub(r"(?<=\d),(?=\d{3})", "", t)
    return Counter(n for n in re.findall(r"\d+(?:\.\d+)?", t) if len(n) >= 3 or "." in n)


def pdf_sections(rnd: int) -> list[str]:
    tag = ROUNDS[rnd][2]
    pdf = next((SRC / "tac-2kyu").glob(f"2q_{tag}_kai*.pdf"))
    pages = subprocess.run(["pdftotext", "-layout", str(pdf), "-"], capture_output=True, text=True).stdout.split("\f")
    text = "\n".join(p for p in pages if "この解説の著作権" in p)
    # 見出しの番号は刷り間違いがある（第36回の第4問が「第３問」）ので、出てきた順に第1問〜第5問とみなす
    return HEAD.split(text)[1:]


def squash(text: str) -> str:
    return re.sub(r"\s+", "", text.translate(ZEN))


def odd_paragraphs(blocks, pdf_text: str) -> list[str]:
    flat = squash(pdf_text)
    out = []
    for b in blocks:
        t = b.get("text", "") if b["t"] == "p" else ""
        if len(squash(t)) < 12 or re.search(r"[×÷＝=]", t):
            continue
        if squash(t) not in flat:
            out.append(t)
    return out


def texts(blocks) -> str:
    out = []
    for b in blocks:
        out.append(b.get("text", "") if b["t"] == "p" else "\n".join(" ".join(r) for r in b["rows"]) + " " + b.get("caption", ""))
    return "\n".join(out)


def main() -> int:
    rounds = [int(r) for r in sys.argv[1:]] or KYU2_ROUNDS
    bad = 0
    for rnd in rounds:
        secs = pdf_sections(rnd)
        if len(secs) != 5:
            print(f"{rnd}: PDF の大問が {len(secs)} 個")
            bad += 1
            continue
        for no in range(1, 6):
            f = ROOT / "source-2kyu" / str(rnd) / f"e{no}.json"
            if not f.exists():
                print(f"{rnd}/e{no}: ファイルが無い")
                bad += 1
                continue
            data = json.loads(f.read_text(encoding="utf-8"))
            labels = {p["label"] for p in json.loads((f.parent / f"q{no}.json").read_text(encoding="utf-8"))["parts"]}
            mine = Counter()
            for s in data["sections"]:
                mine += numbers(texts(s["blocks"]) + " " + s.get("title", ""))
            pdf = numbers(secs[no - 1])
            # 回数まで比べる（同じ金額が2回出る所の片方が落ちた・1回を2回写した、も拾う）
            extra = sorted((mine - pdf).elements())
            lost = sorted((pdf - mine - Counter(HIDDEN.get((rnd, no), set()))).elements())
            # 「問２」は「問２ 1」「問２ 2」…をまとめた解説（src/lib/kyu2Explain.ts の partsOf と同じ決まり）
            unmatched = [s["label"] for s in data["sections"] if s["label"] not in labels and not any(l.startswith(s["label"] + " ") for l in labels)]
            odd = [t for s in data["sections"] for t in odd_paragraphs(s["blocks"], secs[no - 1]) if t not in LAYOUT_OK]
            if extra or lost or odd or not data["sections"]:
                bad += 1
            print(f"{rnd}/e{no}: 節 {len(data['sections'])}（欄に合わない label {unmatched or 'なし'}）"
                  f" PDFに無い数 {extra or 'なし'} 落ちた数 {lost or 'なし'} PDFと違う段落 {len(odd)}")
            for t in odd:
                print(f"    違う段落: {t}")
    print(f"問題のある大問 {bad}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
