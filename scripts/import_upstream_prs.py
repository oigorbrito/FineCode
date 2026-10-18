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


PR_LABELS = {
    "upstream": ("Imported from the upstream Pi project", "2563eb"),
    "bug": ("Bug fix", "d73a4a"),
    "enhancement": ("Feature or enhancement", "a2eeef"),
    "needs-review": ("Pending manual FineCode review", "fbca04"),
    "upstream-conflict": ("Upstream change needs manual adaptation", "e11d48"),
    "finecode-candidate": ("Manually selected for FineCode", "7057ff"),
}

def ensure_pr_labels():
    known = set()
    for page in range(1, 4):
        entries = api(f"/repos/{TARGET}/labels?per_page=100&page={page}")
        known.update(item["name"] for item in entries)
        if len(entries) < 100:
            break
    for name, (description, color) in PR_LABELS.items():
        if name not in known:
            api(f"/repos/{TARGET}/labels", "POST",
                {"name": name, "description": description, "color": color})


def sync_pr_labels(number, upstream, local=None, conflict=False):
    """Preserve local review decisions and unrelated labels."""
    current = {x["name"] for x in (local or {}).get("labels", [])}
    original = {x["name"].lower() for x in upstream.get("labels", [])}
    desired = current | {"upstream"}
    if "bug" in original or "type: bug" in original:
        desired.add("bug")
    elif ("enhancement" in original or "feature" in original
          or "type: feature" in original):
        desired.add("enhancement")
    else:
        # Use explicit conventional-commit prefixes only as fallback.
        subject = upstream.get("title", "").lower().strip()
        if subject.startswith(("fix:", "fix(", "bugfix:", "bug:")):
            desired.add("bug")
        elif subject.startswith(("feat:", "feat(", "feature:")):
            desired.add("enhancement")
    if local is None or not current:
        desired.add("needs-review")
    if conflict:
        desired.add("upstream-conflict")
    # A cleared conflict is not automatically considered resolved.
    if desired != current:
        api(f"/repos/{TARGET}/issues/{number}/labels", "PUT",
            {"labels": sorted(desired)})


def existing_pr(branch):
    q = f"/repos/{TARGET}/pulls?state=all&head={TARGET.split('/')[0]}:{branch}&per_page=20"
    entries = api(q)
    return next((p for p in entries if p.get("head", {}).get("ref") == branch), None)


def git_sha(ref="HEAD"):
    return git("rev-parse", ref).stdout.decode().strip()


def metadata(upstream, source_sha, tip_sha):
    state = "merged" if upstream.get("merged_at") else upstream["state"]
    return (
        f"**Upstream:** {upstream['html_url']}\n\n"
        f"**Upstream status:** {state}; draft={upstream.get('draft', False)}\n\n"
        "Imported for manual review; no automatic merge, close, or force push.\n\n"
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


def stable_patch_id(diff):
    if not diff:
        return None
    result = git("patch-id", "--stable", input_data=diff)
    tokens = result.stdout.decode().split()
    return tokens[0] if tokens else None


def verify_recovered_checkpoint(number, branch, local, upstream):
    """Adopt legacy PRs only when exact normalized patch identity matches.

    Comparing patch-id (not commit SHA) accounts for transplanting the change
    onto a different FineCode base. Any mismatch remains manual-review only.
    """
    git("fetch", "origin", branch)
    local_tip = git_sha("FETCH_HEAD")
    legacy = __import__("re").search(r"Branch checkpoint:\s*`([0-9a-f]{40})`", local.get("body") or "")
    if legacy and legacy.group(1) != local_tip:
        print(f"REVIEW upstream #{number}: branch changed since recovery", flush=True)
        return False
    git("fetch", "--no-tags", "https://github.com/" + SOURCE + ".git",
        f"refs/pull/{number}/head:refs/remotes/pi-upstream/pr-{number}")
    upstream_base = upstream["base"]["sha"]
    git("fetch", "--no-tags", "https://github.com/" + SOURCE + ".git", upstream_base)
    common = git("merge-base", upstream_base, upstream["head"]["sha"]).stdout.decode().strip()
    source_diff = git("diff", "--binary", common, upstream["head"]["sha"]).stdout
    local_parent = git("rev-parse", f"{local_tip}^").stdout.decode().strip()
    local_diff = git("diff", "--binary", local_parent, local_tip).stdout
    source_id, local_id = stable_patch_id(source_diff), stable_patch_id(local_diff)
    if not source_id or source_id != local_id:
        print(f"REVIEW upstream #{number}: patch identity unverified ({str(source_id)[:12]} vs {str(local_id)[:12]})", flush=True)
        return False
    update_metadata(local, upstream, metadata(upstream, upstream["head"]["sha"], local_tip))
    print(f"VERIFIED upstream #{number}: patch-id {source_id}", flush=True)
    return True



def review_only_body(upstream, tip):
    """A draft review PR is not an imported code patch."""
    sha = upstream["head"]["sha"]
    return (
        f"**REVIEW ONLY — CODE NOT APPLIED**\\n\\n"
        f"Upstream proposal: {upstream['html_url']}\\n\\n"
        "The Pi patch conflicts with FineCode. This draft only contains a "
        "non-executable review manifest, not the upstream implementation. "
        "Do not merge until a human has adapted the code and validated tests.\\n\\n"
        f"<!-- finecode-upstream-review-only:{sha} tip:{tip} -->"
    )


def review_manifest(upstream):
    return (
        "# Upstream proposal awaiting adaptation\\n\\n"
        f"- Source: {upstream['html_url']}\\n"
        f"- Source SHA: `{upstream['head']['sha']}`\\n"
        f"- Title: {upstream['title']}\\n\\n"
        "No upstream code has been applied. Manually port and test the changes "
        "before marking this draft ready for review.\\n"
    )


def stage_conflict_review(upstream, branch):
    """Create a distinct draft PR with review metadata, never a code import."""
    number = upstream["number"]
    git("reset", "--hard", f"origin/{BASE}")
    git("checkout", "-B", "finecode-upstream-working", f"origin/{BASE}")
    import pathlib
    dest = pathlib.Path("upstream-review") / f"pi-pr-{number}.md"
    dest.parent.mkdir(exist_ok=True)
    dest.write_text(review_manifest(upstream), encoding="utf-8")
    git("add", "--", str(dest))
    git("-c", "user.name=github-actions[bot]", "-c",
        "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        "commit", "-m", f"docs(upstream): record incompatible Pi PR #{number}")
    tip = git_sha()
    git("push", "origin", f"HEAD:refs/heads/{branch}")
    created = api(f"/repos/{TARGET}/pulls", "POST", {
        "title": f"[review-only Pi #{number}] {upstream['title']}",
        "head": branch, "base": BASE,
        "body": review_only_body(upstream, tip), "draft": True})
    sync_pr_labels(created["number"], upstream, conflict=True)
    print(f"REVIEW_ONLY_CREATED upstream #{number}", flush=True)
    return "created"


def refresh_conflict_review(local, upstream, branch, saved_sha, expected_tip):
    """Fast-forward manifest update only when our branch has not diverged."""
    number = upstream["number"]
    git("fetch", "origin", branch)
    actual_tip = git_sha("FETCH_HEAD")
    if actual_tip != expected_tip:
        print(f"CONFLICT upstream #{number}: review branch diverged; left untouched", flush=True)
        return "conflict"
    if saved_sha == upstream["head"]["sha"]:
        return "existing"
    git("checkout", "-B", "finecode-upstream-working", actual_tip)
    import pathlib
    dest = pathlib.Path("upstream-review") / f"pi-pr-{number}.md"
    dest.write_text(review_manifest(upstream), encoding="utf-8")
    git("add", "--", str(dest))
    git("-c", "user.name=github-actions[bot]", "-c",
        "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        "commit", "-m", f"docs(upstream): refresh Pi PR #{number} review")
    tip = git_sha()
    git("push", "origin", f"HEAD:refs/heads/{branch}")
    api(f"/repos/{TARGET}/pulls/{local['number']}", "PATCH", {
        "title": f"[review-only Pi #{number}] {upstream['title']}",
        "body": review_only_body(upstream, tip)})
    print(f"REVIEW_ONLY_UPDATED upstream #{number}", flush=True)
    return "updated"

def import_one(pr):
    number = pr["number"]
    branch = f"upstream/pi-pr-{number}"
    local = existing_pr(branch)
    full = api(f"/repos/{SOURCE}/pulls/{number}")
    source_sha = full["head"]["sha"]
    if local:
        sync_pr_labels(local["number"], full, local)
    # Resume a branch pushed by a previous run that failed before opening a PR.
    # Do not rewrite it or claim its upstream SHA is verified.
    if not local:
        remote = git("ls-remote", "--heads", "origin", f"refs/heads/{branch}").stdout.decode().strip()
        if remote:
            tip = remote.split()[0]
            if not __import__("re").fullmatch(r"[0-9a-f]{40}", tip):
                raise RuntimeError("Unexpected remote branch SHA")
            created_pr = api(f"/repos/{TARGET}/pulls", "POST", {
                "title": f"[upstream Pi #{number}] {full['title']}",
                "head": branch, "base": BASE,
                "body": (f"**Upstream:** {full['html_url']}\\n\\n"
                         "**Recovery:** Existing branch imported without rewriting it. "
                         "Source commit mapping and compatibility are UNVERIFIED. "
                         "Manual review required before enabling incremental updates.\\n\\n"
                         f"**Branch checkpoint:** `{tip}`\\n\\n"
                         "No automatic merge, closure or force push."),
                "draft": True})
            sync_pr_labels(created_pr["number"], full)
            print(f"RECOVERED upstream #{number}: existing branch {tip}", flush=True)
            return "created"
    # Do not disturb a locally closed PR.
    if local and local["state"] != "open":
        return "existing"
    git("reset", "--hard", f"origin/{BASE}")
    git("checkout", "-B", "finecode-upstream-working", f"origin/{BASE}")
    if local:
        import re
        review = re.search(r"finecode-upstream-review-only:([0-9a-f]{40}) tip:([0-9a-f]{40})", local.get("body") or "")
        if review:
            return refresh_conflict_review(local, full, branch, *review.groups())
        found = re.search(r"finecode-upstream-source:([0-9a-f]{40}) tip:([0-9a-f]{40})", local.get("body") or "")
        if not found:
            if verify_recovered_checkpoint(number, branch, local, full):
                return "verified"
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
            print(f"REBASE_REVIEW upstream #{number}: upstream history rewritten; preserved FineCode branch; manual adaptation required", flush=True)
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
        return stage_conflict_review(full, branch)
    if git("diff", "--cached", "--quiet", ok=False).returncode == 0:
        return "existing"
    git("-c", "user.name=github-actions[bot]", "-c",
        "user.email=41898282+github-actions[bot]@users.noreply.github.com",
        "commit", "-m", f"chore(upstream): stage Pi PR #{number} for review")
    tip = git_sha()
    git("push", "origin", f"HEAD:refs/heads/{branch}")
    created_pr = api(f"/repos/{TARGET}/pulls", "POST", {
        "title": f"[upstream Pi #{number}] {full['title']}",
        "head": branch, "base": BASE,
        "body": metadata(full, source_sha, tip),
        "draft": bool(full.get("draft", False))})
    sync_pr_labels(created_pr["number"], full)
    print(f"CREATED upstream #{number}", flush=True)
    return "created"

def main():
    git("fetch", "origin", BASE)
    # Do not import from a dirty checkout.
    if git("status", "--porcelain").stdout.strip():
        raise RuntimeError("Refusing to import into a dirty checkout")
    ensure_pr_labels()
    created = 0
    failures = 0
    conflicts = 0
    blocked = False
    seen = 0
    # Gather open upstream PRs and all still-open FineCode mirrors, including
    # counterparts already closed or merged upstream.
    items = []
    for page in range(1, 4):
        group = api(f"/repos/{SOURCE}/pulls?state=open&sort=updated&direction=desc&per_page=100&page={page}")
        if not group:
            break
        items.extend(group)
    known = {p["number"] for p in items}
    local = []
    for page in range(1, 101):
        batch = api(f"/repos/{TARGET}/pulls?state=open&per_page=100&page={page}")
        local.extend(batch)
        if len(batch) < 100:
            break
    import re
    for mirror in local:
        match = re.match(r"upstream/pi-pr-([0-9]+)$", mirror.get("head", {}).get("ref", ""))
        if match and int(match.group(1)) not in known:
            original = api(f"/repos/{SOURCE}/pulls/{match.group(1)}")
            items.append(original)
            known.add(original["number"])
    # Prioritize already-imported PRs before attempting additional imports.
    existing_numbers = set()
    for mirror in local:
        match = re.match(r"upstream/pi-pr-([0-9]+)$", mirror.get("head", {}).get("ref", ""))
        if match:
            existing_numbers.add(int(match.group(1)))
    pending_updates = [p for p in items if p["number"] in existing_numbers]
    pending_new = [p for p in items if p["number"] not in existing_numbers]
    max_checked = max(1, int(os.environ.get("MAX_UPSTREAM_PR_CHECKS", "10")))

    def choose_rotating(values, count):
        if not values or count <= 0:
            return []
        offset = ((int(os.environ.get("GITHUB_RUN_NUMBER", "1")) - 1) * count) % len(values)
        return (values[offset:] + values[:offset])[:count]

    update_count = min(len(pending_updates), max(1, max_checked // 3))
    selected = choose_rotating(pending_updates, update_count)
    selected += choose_rotating(pending_new, max_checked - update_count)
    for pr in selected:
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
        if created >= MAX_NEW:
            break
    print(f"Reviewed {seen}; created {created} PRs; conflicts {conflicts}; failures {failures}; blocked {blocked}; updates are logged as UPDATED upstream; conflicts require manual review", flush=True)
    if failures or blocked:
        raise SystemExit("Upstream synchronization encountered operational failures; review logs.")



if __name__ == "__main__":
    main()
