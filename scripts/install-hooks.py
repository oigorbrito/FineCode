#!/usr/bin/env python3
"""Installs repository git hooks directly into .git/hooks."""
import os
import stat
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOOKS_DIR = ROOT / ".git" / "hooks"


def install_pre_push():
    if not HOOKS_DIR.exists():
        print(f"Directory {HOOKS_DIR} does not exist. Is this a Git repository?")
        return False

    pre_push_script = HOOKS_DIR / "pre-push"
    hook_content = """#!/usr/bin/env sh
# Automated repository harness pre-push check
echo "Executing repository evidence harness before push..."
python scripts/harness.py
STATUS=$?
if [ $STATUS -ne 0 ]; then
    echo "Harness verification failed! Resolve gaps before pushing."
    exit 1
fi
"""
    pre_push_script.write_text(hook_content, encoding="utf-8")
    
    # Make executable on unix
    current_stat = os.stat(pre_push_script)
    os.chmod(pre_push_script, current_stat.st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    print(f"[OK] Pre-push hook installed at {pre_push_script}")
    return True


if __name__ == "__main__":
    install_pre_push()
