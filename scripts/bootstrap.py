#!/usr/bin/env python3
"""Project bootstrap script for new repositories created from this template.

Configures project metadata, updates README.md, establishes policy/project-state.json,
and validates the repository harness.
"""
from __future__ import annotations

import argparse
import datetime
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATE_FILE = ROOT / "policy" / "project-state.json"
README_FILE = ROOT / "README.md"
LICENSE_FILE = ROOT / "LICENSE"


def create_license_stub(spdx_id: str, author: str, year: int) -> str:
    return (
        f"SPDX-License-Identifier: {spdx_id}\n"
        f"Copyright (c) {year} {author}\n\n"
        f"Refer to https://spdx.org/licenses/{spdx_id}.html for full legal text.\n"
    )


def update_project_state(name: str, maintainer: str, description: str) -> None:
    if not STATE_FILE.exists():
        return
    state = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    state["notes"] = f"{name}: {description}"
    STATE_FILE.write_text(json.dumps(state, indent=2) + "\n", encoding="utf-8")


def update_readme(name: str, description: str) -> None:
    if not README_FILE.exists():
        return
    content = README_FILE.read_text(encoding="utf-8")
    content = content.replace("**STATUS: UNDEFINED**\n\nDescreva o projeto aqui antes que a implementação seja considerada estabelecida.", description)
    content = content.replace("# Template de Repositório Orientado por Evidências", f"# {name}")
    README_FILE.write_text(content, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Bootstrap a repository initialized from this template.")
    parser.add_argument("--name", required=False, default="", help="Project name")
    parser.add_argument("--description", required=False, default="", help="Brief project description")
    parser.add_argument("--author", required=False, default="Igor Brito", help="Author/Maintainer name")
    parser.add_argument("--spdx", required=False, default="MIT", help="SPDX license identifier (e.g. MIT, Apache-2.0)")

    args = parser.parse_args()

    name = args.name.strip() or input("Nome do projeto: ").strip()
    description = args.description.strip() or input("Descrição do projeto: ").strip()
    author = args.author.strip()
    spdx = args.spdx.strip()

    if not name:
        print("Erro: O nome do projeto é obrigatório.", file=sys.stderr)
        return 1

    year = datetime.date.today().year

    # 1. License file
    if not LICENSE_FILE.exists():
        LICENSE_FILE.write_text(create_license_stub(spdx, author, year), encoding="utf-8")
        print(f"[OK] Arquivo LICENSE criado com SPDX-License-Identifier: {spdx}")

    # 2. Update state & docs
    update_project_state(name, author, description)
    print("[OK] policy/project-state.json atualizado.")

    update_readme(name, description)
    print("[OK] README.md atualizado.")

    print("\nExecutando verificação do harness:")
    import subprocess
    res = subprocess.run([sys.executable, str(ROOT / "scripts" / "harness.py")])
    return res.returncode


if __name__ == "__main__":
    sys.exit(main())
