#!/usr/bin/env python3
"""Import open upstream Pi pull-request patches as FineCode PRs.

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
    q = f"/repos/{TARGET}/pulls?state=all&head={TARGET.split('/')[0]}:{branch}&per_page=20"
    entries = api(q)
    return next((p for p in entries if p.get("head", {}).get("ref") == branch), None)


def git_sha(ref="HEAD"):
    return git("rev-parse", ref).stdout.decode().strip()


def metadata(upstream, source_sha, tip_sha):
    state = "merged" if upstream.get("merged_at") else upstream["state"]
    return (
        f"**Upstream:** {upstream['html_url']}\\n\\n"
        f"**Upstream status:** {state}; draft={upstream.get('draft', False)}\\n\\n"
        "Imported for manual review; no automatic merge, close, or force push.\\n\\n"
        f"<!-- finecode-upstream-source:{source_sha} tip:{tip_sha} -->"
    )


def update_metadata(local, upstream, body):
    title = f"[upstream Pi #{upstream['number']}] {upstream['title']}"
    changes = {}
    if local.get("title") != title:
        changes["title"] = title
    if local.get("body") != body:
        changes["body"] = body
    if changes:
        api(f"/repos/{TARGET}/pulls/{local['number']}", "PATCH", changes)


def import_one(pr):
    number = pr["number"]
    branch = f"upstream/pi-pr-{number}"
    local = existing_pr(branch)
    full = api(f"/repos/{SOURCE}/pulls/{number}")
    source_sha = full["head"]["sha"]
    # Do not disturb a locally closed PR.
    if local and local["state"] != "open":
        return "existing"
    git("reset", "--hard", f"origin/{BASE}")
    git("checkout", "-B", "finecode-upstream-working", f"origin/{BASE}")
    if local:
        import re
        found = re.search(r"finecode-upstream-source:([0-9a-f]{40}) tip:([0-9a-f]{40})", local.get("body") or "")
        if not found:
            print(f"REVIEW upstream #{number}: missing sync checkpoint", flush=True)
            return "review"
        old_source, expected_tip = found.groups()
        git("fetch", "origin", branch)
        actual_tip = git_sha("FETCH_HEAD")
        if actual_tip != expected_tip:
            print(f"CONFLICT upstream #{number}: FineCode branch diverged; left untouched", flush=True)
            return "conflict"
        if old_source == source_sha:
            update_metadata(local, full, metadata(full, old_source, actual_tip))
            return "existing"
        # Fetch the exact original PR history, then apply only new upstream commits.
        git("fetch", "--no-tags", "https://github.com/" + SOURCE + ".git",
            f"refs/pull/{number}/head:refs/remotes/pi-upstream/pr-{number}")
        if git("merge-base", "--is-ancestor", old_source, source_sha, ok=False).returncode:
            print(f"CONFLICT upstream #{number}: upstream history rewritten", flush=True)
            return "conflict"
        git("checkout", "-B", "finecode-upstream-working", actual_tip)
        delta = git("diff", "--binary", old_source, source_sha).stdout
        applied = git("apply", "--3way", "--index", "-", ok=False, input_data=delta)
        if applied.returncode:
            print(f"CONFLICT upstream #{number}: incremental patch incompatible", flush=True)
            return "conflict"
        changed = git("diff", "--cached", "--quiet", ok=False).returncode != 0
        if changed:
            git("-c", "user.name=github-actions[bot]", "-c",
                "user.email=41898282+github-actions[bot]@users.noreply.github.com",
                "commit", "-m", f"chore(upstream): update Pi PR #{number}")
        tip = git_sha()
        # No forced update; GitHub rejects non-fast-forward pushes.
        git("push", "origin", f"HEAD:refs/heads/{branch}")
        update_metadata(local, full, metadata(full, source_sha, tip))
        print(f"UPDATED upstream #{number}", flush=True)
        return "updated"
    git("fetch", "--no-tags", "https://github.com/" + SOURCE + ".git",
        f"refs/pull/{number}/head:refs/remotes/pi-upstream/pr-{number}")
    patch = api(f"/repos/{SOURCE}/pulls/{number}",
                accept="application/vnd.github.v3.patch")
    applied = git("apply", "--3way", "--index", "-", ok=False, input_data=patch)
    if applied.returncode:
        print(f"CONFLICT upstream #{number}: initial patch incompatible", flush=True)
        return "conflict"
    if git("diff", "--cached", "--quiet", ok=False).returncode == 0:
        return "existing"
    git("-c", "user.name=github-actions[bot]", "-c",
        "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        "commit", "-m", f"chore(upstream): stage Pi PR #{number} for review")
    tip = git_sha()
    git("push", "origin", f"HEAD:refs/heads/{branch}")
    api(f"/repos/{TARGET}/pulls", "POST", {
        "title": f"[upstream Pi #{number}] {full['title']}",
        "head": branch, "base": BASE,
        "body": metadata(full, source_sha, tip),
        "draft": bool(full.get("draft", False))})
    print(f"CREATED upstream #{number}", flush=True)
    return "created"

def main():
    git("fetch", "origin", BASE)
    # Do not import from a dirty checkout.
    if git("status", "--porcelain").stdout.strip():
        raise RuntimeError("Refusing to import into a dirty checkout")
    created = 0
    failures = 0
    conflicts = 0
    blocked = False
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
                elif result == "updated":
                    print(f"Synced upstream #{pr['number']}", flush=True)
                elif result == "conflict":
                    conflicts += 1
            except urllib.error.HTTPError as exc:
                failures += 1
                detail = exc.read().decode(errors="replace")[:800]
                print(f"API ERROR upstream #{pr['number']}: HTTP {exc.code}: {detail}", flush=True)
                git("reset", "--hard", f"origin/{BASE}", ok=False)
                if exc.code in (403, 429):
                    blocked = True
                    break
            except RuntimeError as exc:
                failures += 1
                print(f"FAILED upstream #{pr['number']}: {exc}", flush=True)
                git("reset", "--hard", f"origin/{BASE}", ok=False)
        if created >= MAX_NEW or blocked:
            break
    print(f"Reviewed {seen}; created {created} PRs; conflicts {conflicts}; failures {failures}; blocked {blocked}", flush=True)
    if created == 0 and (failures or conflicts or blocked):
        raise SystemExit("No PR imported: review API permissions and patch compatibility.")



if __name__ == "__main__":
    main()
