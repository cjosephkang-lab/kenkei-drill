import os
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
# 元の TTF は施工管理ドリルの fonts/ にある（AICompany の中での位置）。別の場所なら KENKEI_FONT_SRC で渡す
SOURCE = Path(os.environ.get("KENKEI_FONT_SRC", ROOT.parent / "新規事業ネタ/土木施工管理技士アプリ/03_プロトタイプ/sekokan-drill/fonts"))
OUT = ROOT / "public" / "fonts"


def source_characters() -> str:
    text = ""
    for path in (ROOT / "src").rglob("*.ts*"):
        text += path.read_text(encoding="utf-8")
    # 2級は問題文を文字で出すので、文字に起こした問題（コミットしない）の文字も入れる
    for path in (ROOT / "source-2kyu").rglob("*.json"):
        text += path.read_text(encoding="utf-8")
    text += "".join(chr(code) for code in range(0x3040, 0x30A0))
    text += "".join(chr(code) for code in range(0x30A0, 0x30FF))
    text += "０１２３４５６７８９"
    text += "、。！？：；「」『』（）【】・％／＋−×÷←→○△▽"
    text += "".join(chr(code) for code in range(0x20, 0x7F))
    return "".join(sorted(set(text)))


def subset_font(name: str, chars: str) -> None:
    font = TTFont(SOURCE / name, recalcTimestamp=False)  # 作った日時を埋め込まない（ビルドのたびに差分が出ないように）
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=chars)
    subsetter.subset(font)
    font.save(OUT / name.replace(".ttf", ".woff2"))


def main() -> None:
    if not SOURCE.exists():
        if (OUT / "BIZUDPGothic-Regular.woff2").exists():
            print(f"元の書体が無いので、作り済みの {OUT} をそのまま使う: {SOURCE}")
            return
        sys.exit(f"元の書体が見つからない: {SOURCE}（KENKEI_FONT_SRC で場所を渡す）")
    OUT.mkdir(parents=True, exist_ok=True)
    chars = source_characters()
    for name in ("BIZUDPGothic-Regular.ttf", "BIZUDPGothic-Bold.ttf"):
        subset_font(name, chars)
    digits = "0123456789:/.%-"
    for name in ("BIZUDGothic-Regular.ttf", "BIZUDGothic-Bold.ttf"):
        subset_font(name, digits)
    (OUT / "OFL.txt").write_text((SOURCE / "OFL.txt").read_text(encoding="utf-8"), encoding="utf-8")


if __name__ == "__main__":
    main()
