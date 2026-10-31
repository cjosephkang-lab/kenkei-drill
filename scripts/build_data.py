#!/usr/bin/env python3
"""原本PDF（公式の問題・TACの解答/解説）を大問ごとに切り出し、暗号化したデータ束を作る。

使い方:
    KENKEI_PASSWORD=... python3 scripts/build_data.py            # public/data/ に index.json と {id}.bin
    python3 scripts/build_data.py --plain                       # 暗号化せず build/plain/ に確認用を出す

原本は source-pdfs/（コミットしない）。仕様: docs/superpowers/specs/2026-10-20-kenkei-drill-design.md
"""
from __future__ import annotations

import argparse
import base64
import html
import io
import json
import os
import re
import subprocess
import sys
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "source-pdfs"
DPI = 144
SCALE = DPI / 72

# 回 → (試験日, 公式PDFの年フォルダ名, TACのファイル記号)
ROUNDS = {
    34: ("2024-03-10", "2023", "2403"),
    35: ("2024-09-08", "2024", "2409"),
    36: ("2025-03-09", "2024", "2503"),
    37: ("2025-09-07", "2025", "2509"),
    38: ("2026-03-08", "2025", "2603"),
    39: ("2026-09-13", "2026", "2609"),
}
MOCK_ROUNDS = {39}
SUBJECTS = {  # 記号: (公式の記号, TACの科目名候補)
    "zaihyou": ("a", ["zaihyou"]),
    "zaibun": ("b", ["zaibun", "zaibunn"]),
    "genka": ("c", ["gennkei", "genkei"]),
}
OLD_TAC = {"zaihyou": "1zaihyok", "zaibun": "1zaibunk", "genka": "1genkeik"}  # 第34回だけ別名

# 2級: 問題と答えは文字に起こした JSON（source-2kyu/<回>/q<番号>.json。docs/kyu2-data-format.md）。
# 解説だけ TAC の PDF（source-pdfs/tac-2kyu/）から大問ごとに画像で切り出す。設計: docs/superpowers/specs/2026-10-31-kyu2-design.md
KYU2_SRC = ROOT / "source-2kyu"
KYU2_ROUNDS = [35, 36, 37, 38]

ZEN = str.maketrans("０１２３４５６７８９", "0123456789")
JUNK = re.compile(r"著作権|\.indd|^\d{4}/\d\d/\d\d|^[0-9０-９\s\-－]+$|^第.{1,3}回建設業経理士")


@dataclass
class Line:
    page: int  # 1始まり
    x0: float
    y0: float
    x1: float
    y1: float
    text: str


@dataclass
class Section:
    no: int
    kind: str  # problem / answer / explain
    pdf: Path
    parts: list = field(default_factory=list)  # (page, y_top, y_bottom)
    text: str = ""


def read_lines(pdf: Path) -> tuple[list[Line], dict[int, tuple[float, float]]]:
    raw = subprocess.run(["pdftotext", "-bbox-layout", str(pdf), "-"], capture_output=True, text=True, errors="ignore").stdout
    lines: list[Line] = []
    sizes: dict[int, tuple[float, float]] = {}
    page = 0
    for m in re.finditer(r'<page width="([\d.]+)" height="([\d.]+)">|<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', raw, flags=re.S):
        if m.group(1):
            page += 1
            sizes[page] = (float(m.group(1)), float(m.group(2)))
            continue
        text = "".join(html.unescape(w) for w in re.findall(r">([^<]*)</word>", m.group(7))).replace(" ", "")
        lines.append(Line(page, float(m.group(3)), float(m.group(4)), float(m.group(5)), float(m.group(6)), text))
    return lines, sizes


def page_kinds(lines: list[Line]) -> dict[int, str]:
    """TACのPDFは各ページに「この解答の著作権…」「この解説の著作権…」がある。"""
    kinds: dict[int, str] = {}
    for ln in lines:
        if "著作権" in ln.text:
            kinds.setdefault(ln.page, "explain" if "解説" in ln.text else "answer")
    return kinds


# 第34〜36回の公式PDFは、大問見出しの数字が制御文字（0x2→1 … 0x6→5）で埋め込まれている。
# 第34〜36回の財務諸表は、本文の数字がグジャラート文字の位置（U+0A82→0 … U+0A8B→9）に入っている。
# どちらも配点の合計が全回100点になることで対応を確かめた（2026-10-20）。
ODD_DIGITS = {chr(c): str(c - 1) for c in range(0x2, 0xB)} | {chr(0x0A82 + d): str(d) for d in range(10)}


def head_no(text: str) -> int | None:
    m = re.match(r"〔第([0-9０-９\x02-\x0a\u0a82-\u0a8b]+)問〕", text)
    return int("".join(ODD_DIGITS.get(c, c) for c in m.group(1)).translate(ZEN)) if m else None


def sections_of(pdf: Path, kind: str | None) -> list[Section]:
    """kind=None ならページの著作権表示から answer/explain を決める。"""
    lines, sizes = read_lines(pdf)
    kinds = page_kinds(lines) if kind is None else {}
    # ページ下端の印刷所の記録（「問題.indd」・日時）は1語ずつ別の行になるので、位置で外す
    content = [ln for ln in lines if not JUNK.search(ln.text) and ln.y0 < sizes[ln.page][1] * 0.95]
    heads = [ln for ln in content if head_no(ln.text) is not None]
    out: list[Section] = []
    for i, h in enumerate(heads):
        nxt = heads[i + 1] if i + 1 < len(heads) else None
        k = kind or kinds.get(h.page, "answer")
        sec = Section(head_no(h.text), k, pdf)
        last_page = nxt.page if nxt else max(sizes)
        for p in range(h.page, last_page + 1):
            body = [ln for ln in content if ln.page == p]
            if not body:
                continue
            top = h.y0 if p == h.page else min(ln.y0 for ln in body)
            if nxt and p == nxt.page:
                bottom = nxt.y0 - 4
                if bottom - top < 4:
                    continue
            else:
                bottom = max(ln.y1 for ln in body)
            # 次の見出しが別の種類（解答→解説）のページに入る場合、そのページは含めない
            if kind is None and p != h.page and kinds.get(p, k) != k:
                break
            if not (nxt and p == nxt.page):
                bottom += 2
            # 横はページ内の本文の範囲に絞る（端の印刷用の目印＝トンボを入れない）
            x0 = min(ln.x0 for ln in body) - 6
            x1 = max(ln.x1 for ln in body) + 6
            sec.parts.append((p, top - 6, bottom, x0, x1))
        sec.text = "\n".join(ln.text for ln in content if any(ln.page == p and t - 1 <= ln.y0 < b for p, t, b, _, _ in sec.parts))
        out.append(sec)
    return out


def render_pages(pdf: Path, tmp: Path) -> dict[int, Image.Image]:
    prefix = tmp / pdf.stem
    subprocess.run(["pdftoppm", "-r", str(DPI), "-png", str(pdf), str(prefix)], check=True)
    pages = {}
    for f in sorted(tmp.glob(pdf.stem + "-*.png")):
        pages[int(f.stem.rsplit("-", 1)[1])] = Image.open(f).convert("L")
    return pages


def crop_section(sec: Section, pages: dict[int, Image.Image]) -> list[str]:
    urls = []
    for p, top, bottom, x0, x1 in sec.parts:
        img = pages[p]
        box = (max(0, int(x0 * SCALE)), max(0, int(top * SCALE)), min(img.width, int(x1 * SCALE)), min(img.height, int(bottom * SCALE)))
        part = img.crop(box)
        inv = ImageOps.invert(part)
        bbox = inv.point(lambda v: 255 if v > 40 else 0).getbbox()
        if not bbox:
            continue
        x0, y0, x1, y1 = bbox
        part = part.crop((max(0, x0 - 12), max(0, y0 - 8), min(part.width, x1 + 12), min(part.height, y1 + 8)))
        buf = io.BytesIO()
        part.save(buf, "WEBP", quality=70, method=6)
        urls.append("data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode())
    return urls


KANA = "アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワ"
ONE = str.maketrans("ＡＢＣＤＥＴＦＸＹへ", "ABCDETFXYヘ")  # TACは片仮名の「ヘ」を平仮名で書くことがある
NO_ANSWER = re.compile(r"^[－\-―]?\(?※\)?$|^[－\-―]$|^[－\-―]\(※\)$")


def choices_of(spec: str) -> list[str] | None:
    """「ア～チ」「ＡまたはＢ」「Ａ又はＢ」「ＴまたはＦ」などから選択肢を作る。"""
    spec = spec.translate(ONE)
    m = re.fullmatch(r"([ア-ン])[～~〜]([ア-ン])", spec)
    if m and m.group(1) in KANA and m.group(2) in KANA:
        return list(KANA[KANA.index(m.group(1)): KANA.index(m.group(2)) + 1])
    m = re.fullmatch(r"([A-Z])(?:または|又は|か)([A-Z])", spec)
    if m:
        return [m.group(1), m.group(2)]
    m = re.fullmatch(r"([A-Z])[～~〜]([A-Z])", spec)
    if m:
        return [chr(c) for c in range(ord(m.group(1)), ord(m.group(2)) + 1)]
    return None


def layout_text(sec: Section) -> str:
    out = []
    for p, top, bottom, x0, x1 in sec.parts:
        out.append(subprocess.run(
            ["pdftotext", "-layout", "-f", str(p), "-l", str(p), "-x", str(int(x0)), "-y", str(int(top)),
             "-W", str(int(x1 - x0)), "-H", str(int(bottom - top)), str(sec.pdf), "-"],
            capture_output=True, text=True, errors="ignore").stdout)
    return "\n".join(out)


def items_of(sec: Section) -> list[dict]:
    """解答の「記号（ア～チ）」の表から、番号と正解の記号を取り出す。表が読めなければ空。"""
    lines = [ln.strip() for ln in layout_text(sec).splitlines() if ln.strip()]
    items: list[dict] = []
    prefix = ""
    for i, ln in enumerate(lines):
        q = re.match(r"^問\s*([0-9０-９]+)", ln)
        if q:
            prefix = "問" + q.group(1).translate(ZEN) + " "
        m = re.search(r"記号[（(]\s*(.+?)\s*[）)]", ln.replace(" ", ""))
        if not m or (choices := choices_of(m.group(1))) is None:
            continue
        rest = ln[ln.index("）") + 1:].strip() if "）" in ln else ""
        if rest:  # 「記号（Ａ又はＢ） Ｂ」のような1つだけの記入欄は対象外
            continue
        nums = lines[i + 1].split() if i + 1 < len(lines) else []
        syms = lines[i + 2].split() if i + 2 < len(lines) else []
        nums = [n.translate(ZEN) for n in nums]
        syms = [s.translate(ONE) for s in syms]
        # 正解欄が「※」「－(※)」の小問（TACの注記つきで正解が決まっていない）は出さない
        pairs = [(n, s) for n, s in zip(nums, syms) if not NO_ANSWER.match(s)]
        if len(nums) != len(syms):
            continue
        nums, syms = [n for n, _ in pairs], [s for _, s in pairs]
        # TACの見出しの範囲が問題文より狭いことがある（第39回財務分析: 見出し「ア～モ」、正解に「ヤ」）
        if syms and choices[0] in KANA and all(s in KANA for s in syms):
            last = max([KANA.index(choices[-1])] + [KANA.index(s) for s in syms])
            choices = list(KANA[KANA.index(choices[0]): last + 1])
        if nums and all(n.isdigit() for n in nums) and len(nums) == len(syms) and all(s in choices for s in syms):
            items += [{"label": prefix + n, "answer": s, "choices": choices} for n, s in zip(nums, syms)]
    return items


def problem_pdf(rnd: int, subj: str) -> Path:
    _, year, _ = ROUNDS[rnd]
    code = SUBJECTS[subj][0]
    cands = sorted((SRC / "official").glob(f"*-{rnd}{code}-m*.pdf"))
    if not cands:
        raise FileNotFoundError(f"問題PDFが無い: 第{rnd}回 {subj}")
    return cands[-1]  # m2（差し替え版）があれば後ろに来る


def tac_pdfs(rnd: int, subj: str) -> list[Path]:
    _, _, tag = ROUNDS[rnd]
    files: list[Path] = []
    for name in SUBJECTS[subj][1]:
        files += sorted((SRC / "tac").glob(f"1q_{tag}_{name}_*.pdf"))
    files += sorted((SRC / "tac").glob(f"{OLD_TAC[subj]}_{tag}.pdf"))
    # sokuhou2（訂正版）があれば sokuhou を外す
    if any(f.stem.endswith("sokuhou2") for f in files):
        files = [f for f in files if not f.stem.endswith("_sokuhou")]
    return files


def points_of(text: str) -> int | None:
    text = "".join(ODD_DIGITS.get(c, c) if ord(c) > 0x20 else c for c in text)
    m = re.search(r"[（(]([0-9０-９]+)点[）)]", text)
    return int(m.group(1).translate(ZEN)) if m else None


def build_exam(rnd: int, subj: str, tmp: Path) -> dict:
    exam_id = f"{rnd}{SUBJECTS[subj][0]}"
    prob_pdf = problem_pdf(rnd, subj)
    probs = sections_of(prob_pdf, "problem")
    if len(probs) != 5:
        raise ValueError(f"{exam_id}: 問題の大問見出しが5つでない: {[s.no for s in probs]}")
    # 見出しの数字は回によって埋め込み方が揃っていない（第34回財務諸表は第5問が0x7）ので、出てきた順に振る
    for i, sec in enumerate(probs):
        sec.no = i + 1
    answers: dict[int, Section] = {}
    explains: dict[int, Section] = {}
    pdf_pages: dict[Path, dict[int, Image.Image]] = {prob_pdf: render_pages(prob_pdf, tmp)}
    for pdf in tac_pdfs(rnd, subj):
        for sec in sections_of(pdf, None):
            target = answers if sec.kind == "answer" else explains
            if sec.no not in target:
                target[sec.no] = sec
                if pdf not in pdf_pages:
                    pdf_pages[pdf] = render_pages(pdf, tmp)
    questions = []
    for sec in probs:
        pts = points_of(sec.text)
        if pts is None:
            raise ValueError(f"{exam_id} 第{sec.no}問: 配点が読めない")
        ans = answers.get(sec.no)
        if ans is None:
            raise ValueError(f"{exam_id} 第{sec.no}問: TACの解答が無い")
        exp = explains.get(sec.no)
        if exp and len(exp.text.splitlines()) <= 1 and exp.text.endswith("解答参照"):
            exp = None  # 「〔第１問〕論述問題（…） 解答参照」の1行だけの解説は出さない
        questions.append({
            "no": sec.no,
            "points": pts,
            "problem": crop_section(sec, pdf_pages[prob_pdf]),
            "answer": crop_section(ans, pdf_pages[ans.pdf]),
            "explain": crop_section(exp, pdf_pages[exp.pdf]) if exp else [],
            "answerText": ans.text,
            "items": items_of(ans),
            "sources": {"problem": prob_pdf.name, "answer": ans.pdf.name, "explain": exp.pdf.name if exp else None},
        })
    total = sum(q["points"] for q in questions)
    if total != 100:
        raise ValueError(f"{exam_id}: 配点合計が100でない: {total}")
    return {"id": exam_id, "round": rnd, "date": ROUNDS[rnd][0], "subject": subj, "mock": rnd in MOCK_ROUNDS, "questions": questions}


def build_kyu2(rnd: int, tmp: Path) -> dict:
    exam_id = f"{rnd}2"
    tag = ROUNDS[rnd][2]
    explains: dict[int, Section] = {}
    pages: dict[Path, dict[int, Image.Image]] = {}
    for pdf in sorted((SRC / "tac-2kyu").glob(f"2q_{tag}_kai*.pdf")):
        found = [sec for sec in sections_of(pdf, None) if sec.kind == "explain"]
        # 第36回の解説は第4問の見出しが「第３問」と刷られている。見出しが重なって5つなら、出てきた順に振る
        if len(found) == 5 and len({sec.no for sec in found}) < 5:
            for n, sec in enumerate(found, 1):
                sec.no = n
        for sec in found:
            if sec.no not in explains:
                explains[sec.no] = sec
                if pdf not in pages:
                    pages[pdf] = render_pages(pdf, tmp)
    questions = []
    for no in range(1, 6):
        q = json.loads((KYU2_SRC / str(rnd) / f"q{no}.json").read_text(encoding="utf-8"))
        kyu2 = {"title": q["title"], "problem": q["problem"], "parts": q["parts"]}
        # 解説を文字に起こした物（e<番号>.json）があれば、それを答えの下に出す。画像は入れない
        text = KYU2_SRC / str(rnd) / f"e{no}.json"
        if text.exists():
            sections = json.loads(text.read_text(encoding="utf-8"))["sections"]
            filled = lambda b: (b.get("text") or "").strip() if b["t"] == "p" else any(c.strip() for row in b.get("rows", []) for c in row)
            if not sections or any(not any(filled(b) for b in sec.get("blocks", [])) for sec in sections):
                raise ValueError(f"{text}: 解説の節が空（scripts/check_kyu2_explain.py で確かめる）")
            kyu2["explain"] = sections
        exp = explains.get(no)
        questions.append({
            "no": no,
            "points": q["points"],
            "problem": [],
            "answer": [],
            "explain": crop_section(exp, pages[exp.pdf]) if exp and "explain" not in kyu2 else [],
            "items": [],
            "kyu2": kyu2,
        })
    total = sum(q["points"] for q in questions)
    if total != 100:
        raise ValueError(f"{exam_id}: 配点合計が100でない: {total}")
    return {"id": exam_id, "round": rnd, "date": ROUNDS[rnd][0], "subject": "kyu2", "mock": False, "questions": questions}


class Encryptor:
    """アプリは最初の束で導出した鍵を全部の束に使うので、1回の生成では salt を1つにそろえる。"""

    def __init__(self, password: str, salt: bytes | None = None):
        from cryptography.hazmat.primitives import hashes
        from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

        self.salt = salt or os.urandom(16)
        self.key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=self.salt, iterations=200_000).derive(password.encode())


    def __call__(self, data: bytes) -> bytes:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM

        iv = os.urandom(12)
        return self.salt + iv + AESGCM(self.key).encrypt(iv, data, None)


def existing_salt(out_dir: Path, password: str) -> bytes | None:
    """公開済みの束があれば、その salt を引き継ぐ。端末に保存済みの鍵（salt から作る）がそのまま使えるように。
    パスワードが既存の束と合わなければ止める（違う鍵の束を混ぜない）。"""
    index_file = out_dir / "index.json"
    if not index_file.exists():
        print("公開済みの束が無いので新しい salt で作る（端末に保存済みの鍵では読めなくなる）", file=sys.stderr)
        return None
    exams = json.loads(index_file.read_text(encoding="utf-8")).get("exams", [])
    first = out_dir / f"{exams[0]['id']}.bin" if exams else None
    if not first or not first.exists():
        print("公開済みの束が無いので新しい salt で作る（端末に保存済みの鍵では読めなくなる）", file=sys.stderr)
        return None
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    raw = first.read_bytes()
    enc = Encryptor(password, raw[:16])
    try:
        AESGCM(enc.key).decrypt(raw[16:28], raw[28:], None)
    except Exception:
        sys.exit(f"KENKEI_PASSWORD が公開済みの束（{first.name}）と合わない")
    return raw[:16]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--plain", action="store_true", help="暗号化せず build/plain/ に出す（確認用）")
    ap.add_argument("--only", help="例: 39b")
    args = ap.parse_args()
    if args.only and not args.plain:
        # 公開用は全部の束を同じ salt でそろえ、目次も全件で作り直す必要がある（一部だけ作ると鍵と目次がずれる）
        sys.exit("--only は --plain と一緒にだけ使える")
    password = os.environ.get("KENKEI_PASSWORD")
    if not args.plain and not password:
        sys.exit("KENKEI_PASSWORD が無い")
    items_file = ROOT / "data-src" / "items.json"
    items = json.loads(items_file.read_text(encoding="utf-8")) if items_file.exists() else {}
    out_dir = ROOT / ("build/plain" if args.plain else "public/data")
    encrypt = None if args.plain else Encryptor(password, existing_salt(out_dir, password))
    out_dir.mkdir(parents=True, exist_ok=True)
    index = {"version": 1, "examDate": "2027-03-14", "exams": []}
    for rnd in ROUNDS:
        for subj in SUBJECTS:
            exam_id = f"{rnd}{SUBJECTS[subj][0]}"
            if args.only and exam_id != args.only:
                continue
            with tempfile.TemporaryDirectory() as t:
                exam = build_exam(rnd, subj, Path(t))
            for q in exam["questions"]:  # data-src/items.json があれば自動抽出より優先する
                q["items"] = items.get(exam_id, {}).get(str(q["no"]), q["items"])
            index["exams"].append({
                "id": exam_id, "round": rnd, "date": exam["date"], "subject": subj, "mock": exam["mock"],
                "questions": [{"no": q["no"], "points": q["points"]} for q in exam["questions"]],
            })
            payload = {"id": exam_id, "questions": [{k: q[k] for k in ("no", "points", "problem", "answer", "explain", "items")} for q in exam["questions"]]}
            if args.plain:
                (out_dir / f"{exam_id}.json").write_text(json.dumps(exam, ensure_ascii=False), encoding="utf-8")
            else:
                (out_dir / f"{exam_id}.bin").write_bytes(encrypt(json.dumps(payload, ensure_ascii=False).encode()))
            size = sum(len(u) for q in exam["questions"] for k in ("problem", "answer", "explain") for u in q[k])
            print(f"{exam_id}: 配点 {[q['points'] for q in exam['questions']]} 画像 {size/1e6:.1f}MB "
                  f"解説なし {[q['no'] for q in exam['questions'] if not q['explain']]}", flush=True)
    for rnd in KYU2_ROUNDS:
        exam_id = f"{rnd}2"
        if args.only and exam_id != args.only:
            continue
        with tempfile.TemporaryDirectory() as t:
            exam = build_kyu2(rnd, Path(t))
        index["exams"].append({
            "id": exam_id, "round": rnd, "date": exam["date"], "subject": "kyu2", "mock": False,
            "questions": [{"no": q["no"], "points": q["points"]} for q in exam["questions"]],
        })
        payload = {"id": exam_id, "questions": exam["questions"]}
        if args.plain:
            (out_dir / f"{exam_id}.json").write_text(json.dumps(exam, ensure_ascii=False), encoding="utf-8")
        else:
            (out_dir / f"{exam_id}.bin").write_bytes(encrypt(json.dumps(payload, ensure_ascii=False).encode()))
        size = sum(len(u) for q in exam["questions"] for u in q["explain"])
        print(f"{exam_id}: 配点 {[q['points'] for q in exam['questions']]} 解説の画像 {size/1e6:.1f}MB "
              f"解説が文字 {[q['no'] for q in exam['questions'] if 'explain' in q['kyu2']]} "
              f"解説なし {[q['no'] for q in exam['questions'] if not q['explain'] and 'explain' not in q['kyu2']]}", flush=True)
    (out_dir / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")


if __name__ == "__main__":
    main()
