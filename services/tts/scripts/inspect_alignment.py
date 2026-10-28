#!/usr/bin/env python3
"""Xuất báo cáo text nhẹ để Director kiểm tra alignment."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path


def _ms_to_s(ms: int) -> str:
    return f"{ms / 1000:.3f}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("alignment_json", type=Path)
    parser.add_argument("--out", type=Path, default=None)
    args = parser.parse_args()

    data = json.loads(args.alignment_json.read_text(encoding="utf-8"))
    lines: list[str] = []
    lines.append(f"audioId={data.get('audioId')}")
    lines.append(f"engine={data.get('engine')} model={data.get('modelId')}")
    lines.append(f"durationMs={data.get('durationMs')}")
    val = data.get("validation", {})
    lines.append(f"validationOk={val.get('ok')}")
    for err in val.get("errors", []):
        lines.append(f"ERROR: {err}")
    for warn in val.get("warnings", []):
        lines.append(f"WARN: {warn}")
    lines.append("")
    lines.append("# index | start | end | text")
    for i, w in enumerate(data.get("words", [])):
        flag = ""
        if w.get("endMs", 0) <= w.get("startMs", 0):
            flag = " [MISSING]"
        lines.append(
            f"{i:4d} | {_ms_to_s(w['startMs']):>7} | {_ms_to_s(w['endMs']):>7} | {w['text']}{flag}"
        )

    text = "\n".join(lines) + "\n"
    if args.out:
        args.out.write_text(text, encoding="utf-8")
        print(f"path={args.out}")
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
