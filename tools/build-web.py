#!/usr/bin/env python3
"""Rebuild the inline core/app blocks in index.html."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
CORE = ROOT / "js" / "core.js"
APP = ROOT / "js" / "app.js"


def replace_block(html: str, marker: str, code: str) -> tuple[str, bool]:
    index = html.find(marker)
    if index < 0:
        return html, False
    start = html.find("\n", index) + 1
    end = html.find("</script>", start)
    if end < 0:
        return html, False
    return html[:start] + code.rstrip() + "\n" + html[end:], True


def main() -> None:
    html = INDEX.read_text(encoding="utf-8-sig")
    html, core_ok = replace_block(
        html, "/* 由 js/core.js 内联 */", CORE.read_text(encoding="utf-8")
    )
    html, app_ok = replace_block(
        html, "/* 由 js/app.js 内联 */", APP.read_text(encoding="utf-8")
    )
    if not (core_ok and app_ok):
        raise SystemExit(
            "inline markers not found; expected '/* 由 js/core.js 内联 */' "
            "and '/* 由 js/app.js 内联 */' in index.html"
        )
    INDEX.write_text(html, encoding="utf-8-sig")
    print(f"rebuilt {INDEX} ({len(html):,} chars)")


if __name__ == "__main__":
    main()
