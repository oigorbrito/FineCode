#!/usr/bin/env python3
"""Import open upstream Pi pull-request patches as DRAFT FineCode PRs.

No merging, no code execution from patches, no force pushes.
Conflicting patches are skipped and reported in the workflow log.
"""
import json
import os
import subprocess
import urllib.request
import urllib.error

SOURCE = "earendil-works/pi"
TARGET = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GITHUB_TOKEN"]
MAX_NEW = int(os.environ.get("MAX_NEW_UPSTREAM_PRS", "3"))
BASE = "main"


def api(path, method="GET", data=None, accept="application/vnd.github+json"):
    payload = None if data is None else json.dumps(data).encode()
    req = urllib.request.Request(
        "https://api.github.com" + path, data=payload, method=method,
        headers={"Authorization": "Bearer " + TOKEN,
                 "Accept": accept,
                 "X-GitHub-Api-Version": "2022-11-28",
                 "User-Agent": "FineCode-upstream-import",
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.load(response) if accept.endswith("+json") else response.read()


def git(*args, ok=True, input_data=None):
    result = subprocess.run(["git", *args], input=input_data, capture_output=True)
    if ok and result.returncode:
        raise RuntimeError(f"git {' '.join(args)} failed: {result.stderr.decode(errors='replace')[-1200:]}")
    return result


def existing_pr(branch):
    q = f"/repos/{TARGET}/pulls?state=all&head={TARGET.split('/')[0]}:{branch}&per_page=10"
    return bool(api(q))


def import_one(pr):
    number = pr["number"]
    branch = f"upstream/pi-pr-{number}"
    if existing_pr(branch):
        return "existing"
    # GitHub provides an authoritative patch built from the upstream PR diff.
    patch = api(f"/repos/{SOURCE}/pulls/{number}",
                accept="application/vnd.github.v3.patch")
    git("checkout", "-B", branch, f"origin/{BASE}")
    applied = git("apply", "--3way", "--index", "-", ok=False, input_data=patch)
    if applied.returncode:
        git("reset", "--hard", f"origin/{BASE}")
        print(f"CONFLICT upstream #{number}: {applied.stderr.decode(errors='replace')[-400:]}", flush=True)
        return "conflict"
    changed = git("diff", "--cached", "--quiet", ok=False).returncode != 0
    if not changed:
        print(f"ALREADY PRESENT upstream #{number}", flush=True)
        return "same"
    git("-c", "user.name=finecode-upstream-bot", "-c",
        "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        "commit", "-m", f"chore(upstream): stage Pi PR #{number} for review")
    git("push", "origin", f"HEAD:refs/heads/{branch}")
    body = (
        f"**Upstream:** {pr['html_url']}\n\n"
        "**Status:** Imported as a draft for manual review only.\n\n"
        "This is a patch transplant onto FineCode's current main, NOT a merge "
        "with the Pi upstream branch. Review the full diff, licensing, "
        "compatibility, tests and provenance before any manual merge.\n\n"
        "No automated merging or automatic closing is authorized."
    )
    api(f"/repos/{TARGET}/pulls", "POST", {
        "title": f"[upstream Pi #{number}] {pr['title']}",
        "head": branch, "base": BASE, "body": body, "draft": True})
    print(f"CREATED DRAFT upstream #{number}", flush=True)
    return "created"


def main():
    git("fetch", "origin", BASE)
    # Do not import from a dirty checkout.
    if git("status", "--porcelain").stdout.strip():
        raise RuntimeError("Refusing to import into a dirty checkout")
    created = 0
    failures = 0
    seen = 0
    for page in range(1, 4):
        items = api(f"/repos/{SOURCE}/pulls?state=open&sort=updated&direction=desc&per_page=100&page={page}")
        if not items:
            break
        for pr in items:
            if created >= MAX_NEW:
                break
            seen += 1
            try:
                result = import_one(pr)
                if result == "created":
                    created += 1
            except (RuntimeError, urllib.error.HTTPError) as exc:
                failures += 1
                print(f"FAILED upstream #{pr['number']}: {exc}", flush=True)
                git("reset", "--hard", f"origin/{BASE}", ok=False)
        if created >= MAX_NEW:
            break
    print(f"Reviewed {seen}; created {created} drafts; failures {failures}", flush=True)


if __name__ == "__main__":
    main()
