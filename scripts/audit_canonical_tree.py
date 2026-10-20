#!/usr/bin/env python3
"""Read-only, reproducible full-tree reconciliation against pinned Git refs.

Requires Git and Python 3.10+. No checkout/reset/fetch/write to repository.
Example:
 python scripts/audit_canonical_tree.py --main origin/main --canonical feat/full-upstream-tree-migration --upstream pi-upstream/main --out D:/finecode-reconciliation/tree-audit
"""
from __future__ import annotations

import argparse
import csv
import json
import subprocess
from collections import Counter
from pathlib import Path


def git(*args: str) -> bytes:
    proc = subprocess.run(["git", *args], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=False)
    if proc.returncode:
        raise RuntimeError(f"git {args[0]} failed (exit {proc.returncode}): {proc.stderr.decode(errors='replace').strip()}")
    return proc.stdout


def pin(ref: str) -> str:
    return git("rev-parse", "--verify", f"{ref}^{{commit}}").decode().strip()


def tree(commit: str) -> dict[str, tuple[str, str, str]]:
    """Raw -z protects paths with spaces, tabs, newlines and non-ASCII characters."""
    result = {}
    for rec in git("ls-tree", "-rz", "--full-tree", commit).split(b"\0"):
        if not rec:
            continue
        header, path = rec.split(b"\t", 1)
        mode, kind, oid = header.decode("ascii").split(" ")
        result[path.decode("utf-8", errors="surrogateescape")] = (mode, kind, oid)
    return result


def classify_path(path: str, state: str) -> tuple[str, str]:
    """Prioritize review, never decide equivalence without inspection."""
    parts = path.split("/")
    if parts[0] in ("packages", "apps") and len(parts) > 1:
        subsystem = "/".join(parts[:2])
    elif parts[0] == ".github":
        subsystem = "github-governance"
    else:
        subsystem = parts[0]
    if state == "identical_object":
        priority = "none"
    elif path.endswith((".md", ".mdx")):
        priority = "P2-docs"
    elif "/test/" in path or path.startswith("tests/") or path.endswith((".test.ts", ".spec.ts")):
        priority = "P1-tests"
    else:
        priority = "P0-runtime-or-contract"
    return subsystem, priority


def compare(main: dict, other: dict, main_label: str, other_label: str) -> list[dict]:
    rows = []
    for path in sorted(main.keys() | other.keys()):
        m, o = main.get(path), other.get(path)
        if m == o:
            state = "identical_object"
        elif m is None:
            state = "other_only"
        elif o is None:
            state = "main_only"
        elif m[2] == o[2]:
            state = "mode_or_type_difference"
        else:
            state = "different_object"
        subsystem, priority = classify_path(path, state)
        rows.append({"path": path.encode("utf-8", "surrogateescape").decode("utf-8", "backslashreplace"),
                     "path_bytes_hex": path.encode("utf-8", "surrogateescape").hex(),
                     "state": state, "subsystem": subsystem.encode("utf-8", "surrogateescape").decode("utf-8", "backslashreplace"),
                     "review_priority": priority, f"{main_label}_mode": m[0] if m else "",
                     f"{main_label}_kind": m[1] if m else "", f"{main_label}_oid": m[2] if m else "",
                     f"{other_label}_mode": o[0] if o else "", f"{other_label}_kind": o[1] if o else "",
                     f"{other_label}_oid": o[2] if o else "",
                     "semantic_decision": "not_reviewed" if state != "identical_object" else "object_identical"})
    return rows


def export(path: Path, rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]) if rows else ["path", "state"])
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--main", required=True, help="Main ref, pinned to full SHA during execution")
    ap.add_argument("--canonical", required=True, help="Modified internal canonical branch ref")
    ap.add_argument("--upstream", help="Separate upstream snapshot ref, never implicitly substituted for canonical")
    ap.add_argument("--out", required=True, type=Path)
    args = ap.parse_args()
    # Resolve all refs before generating anything; no implicit remote refresh.
    refs = {"main": pin(args.main), "canonical": pin(args.canonical)}
    if args.upstream:
        refs["upstream"] = pin(args.upstream)
    trees = {key: tree(sha) for key, sha in refs.items()}
    args.out.mkdir(parents=True, exist_ok=True)
    manifest = {"refs": refs, "source_arguments": {"main": args.main, "canonical": args.canonical,
                "upstream": args.upstream}, "scope": "COMMITTED_GIT_TREES_ONLY",
                "notes": ["No worktree/index/stash/untracked examination", "No behavioral parity inferred",
                          "No current-upstream claim without independently verified source SHA"],
                "comparisons": {}}
    for other in [key for key in refs if key != "main"]:
        rows = compare(trees["main"], trees[other], "main", other)
        export(args.out / f"main-vs-{other}.csv", rows)
        manifest["comparisons"][other] = dict(Counter(row["state"] for row in rows))
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
