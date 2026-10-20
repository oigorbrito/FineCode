#!/usr/bin/env python3
"""Reconcile complete Pi metadata inventories; never sync code or local state.

Each mirror's managed block is a durable per-record checkpoint. Complete scans
skip committed records, so neither a write budget nor a failed run loses work.
No cache/artifact is required for correctness.
"""
import itertools
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

SOURCE = "earendil-works/pi"
TARGET = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GITHUB_TOKEN"]
LABELS = {
    "upstream": ("Imported from original Pi", "2563eb"),
    "bug": ("A reported defect", "d73a4a"),
    "enhancement": ("A proposed improvement", "a2eeef"),
    "needs-review": ("Pending FineCode assessment", "fbca04"),
    "upstream-fixed": ("Correction independently verified on upstream", "0e8a16"),
    "finecode-candidate": ("Manually selected for FineCode", "7057ff"),
}
MAX_ISSUE_WRITES = 10
MAX_PR_WRITES = 10
MAX_RELEASE_WRITES = 10
BEGIN = "<!-- finecode-upstream-metadata:start -->"
END = "<!-- finecode-upstream-metadata:end -->"


def api(path, method="GET", payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        "https://api.github.com" + path, data=data, method=method,
        headers={"Accept": "application/vnd.github+json",
                 "Authorization": "Bearer " + TOKEN,
                 "X-GitHub-Api-Version": "2022-11-28",
                 "User-Agent": "FineCode-upstream-tracker",
                 "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def pages(path, limit=None):
    iterator = itertools.count(1) if limit is None else range(1, limit + 1)
    for page in iterator:
        sep = "&" if "?" in path else "?"
        items = api(f"{path}{sep}per_page=100&page={page}")
        yield from items
        if len(items) < 100:
            break


def ensure_labels():
    known = {v["name"] for v in pages(f"/repos/{TARGET}/labels")}
    for name, (description, color) in LABELS.items():
        if name not in known:
            api(f"/repos/{TARGET}/labels", "POST",
                {"name": name, "description": description, "color": color})


def initial_labels(source):
    original = {v["name"].lower() for v in source.get("labels", [])}
    labels = {"upstream", "needs-review"}
    if "bug" in original:
        labels.add("bug")
    if original & {"enhancement", "feature"}:
        labels.add("enhancement")
    return sorted(labels)


def metadata(kind, source):
    ident = source["tag_name"] if kind == "release" else source["number"]
    key = f"{kind}:{ident}"
    name = source.get("name") or ident if kind == "release" else source["title"]
    title = f"[Pi release] {name}" if kind == "release" else f"[Pi {kind if kind == 'issue' else 'PR'} #{ident}] {name}"
    status = "published" if kind == "release" else source["state"]
    if kind == "pr" and source.get("merged_at"):
        status = "merged"
    details = {"labels": sorted(v["name"] for v in source.get("labels", [])),
               "author": (source.get("user") or source.get("author") or {}).get("login")}
    if kind == "pr":
        details.update(draft=source.get("draft", False), merged_at=source.get("merged_at"),
                       head=(source.get("head") or {}).get("sha"),
                       base=(source.get("base") or {}).get("ref"))
    elif kind == "issue":
        details.update(state_reason=source.get("state_reason"),
                       milestone=(source.get("milestone") or {}).get("title"),
                       assignees=sorted(v["login"] for v in source.get("assignees", [])))
    else:
        details.update(tag=ident, prerelease=source.get("prerelease", False),
                       published_at=source.get("published_at"), target=source.get("target_commitish"))
    block = (
        f"{BEGIN}\nFineCode-Upstream-Key: {key}\n\n"
        f"**Origem:** {SOURCE}\n\n**Link original:** {source['html_url']}\n\n"
        f"**Estado no upstream:** {status}\n\n"
        f"**Atualizado/publicado:** {source.get('updated_at') or source.get('published_at')}\n\n"
        f"**Metadados upstream:** {json.dumps(details, ensure_ascii=False, sort_keys=True)}\n\n"
        "Espelho informativo. Não copia código nem altera o estado local. "
        "Não há merge ou fechamento automático. Decisões FineCode são humanas.\n"
        f"{END}"
    )
    return key, title, block


def managed_body(old_body, block):
    if BEGIN in old_body or END in old_body:
        # Malformed or ambiguous ownership must not overwrite human content.
        if old_body.count(BEGIN) != 1 or old_body.count(END) != 1:
            raise ValueError("Ambiguous managed metadata block")
        start, end = old_body.index(BEGIN), old_body.index(END)
        if end < start:
            raise ValueError("Invalid managed metadata block order")
        return old_body[:start] + block + old_body[end + len(END):]
    if not old_body:
        return block
    # Preserve legacy bodies verbatim, including any maintainer annotations.
    return block + "\n\n<details><summary>Registro anterior à reconciliação (histórico)</summary>\n\n" + old_body + "\n</details>"


def reconcile(existing, kind, sources, budget, report):
    # Previously mirrored records first, then oldest pending records. Complete
    # inventories, not a moving time window, are the replay log after failures.
    records = [metadata(kind, item) + (item,) for item in sources]
    records.sort(key=lambda r: (r[0] not in existing,
                              r[3].get("updated_at") or r[3].get("published_at") or "", r[0]))
    stats = {"seen": len(records), "writes": 0, "unchanged": 0, "deferred": 0}
    report["streams"][kind] = stats
    for key, title, block, source in records:
        old = existing.get(key)
        body = managed_body((old or {}).get("body") or "", block)
        if old and old.get("title") == title and old.get("body") == body:
            stats["unchanged"] += 1
            continue
        if stats["writes"] >= budget:
            stats["deferred"] += 1
            continue
        if old:
            # Never send state, labels, assignees or milestone on local updates.
            result = api(f"/repos/{TARGET}/issues/{old['number']}", "PATCH",
                         {"title": title, "body": body})
            action = "updated"
        else:
            result = api(f"/repos/{TARGET}/issues", "POST",
                         {"title": title, "body": body, "labels": initial_labels(source)})
            action = "created"
        existing[key] = result
        stats["writes"] += 1
        report["changes"].append({"key": key, "action": action, "local_issue": result["number"]})
        print(action, key, flush=True)


def main():
    report = {"schema_version": 1, "source": SOURCE, "target": TARGET,
              "run_id": os.environ.get("GITHUB_RUN_ID"), "status": "running",
              "resume": "complete_inventory_per_record_checkpoint", "streams": {}, "changes": []}
    try:
        existing = {}
        for issue in pages(f"/repos/{TARGET}/issues?state=all"):
            if "pull_request" in issue:
                continue
            keys = {line.split(": ", 1)[1].strip() for line in (issue.get("body") or "").splitlines()
                    if line.startswith("FineCode-Upstream-Key: ")}
            if len(keys) > 1:
                raise ValueError(f"Ambiguous upstream identity on local issue {issue['number']}")
            for key in keys:
                if key in existing:
                    raise ValueError(f"Duplicate upstream identity: {key}")
                existing[key] = issue
        # Fetch every page before writing: a partial API inventory is never a
        # successful reconciliation. No temporal cutoff, including releases.
        issues = [v for v in pages(f"/repos/{SOURCE}/issues?state=all&sort=created&direction=asc")
                  if "pull_request" not in v]
        prs = list(pages(f"/repos/{SOURCE}/pulls?state=all&sort=created&direction=asc"))
        releases = [v for v in pages(f"/repos/{SOURCE}/releases")
                    if not v.get("draft") and v.get("published_at")]
        ensure_labels()
        for kind, sources, budget in (("issue", issues, MAX_ISSUE_WRITES),
                                      ("pr", prs, MAX_PR_WRITES),
                                      ("release", releases, MAX_RELEASE_WRITES)):
            reconcile(existing, kind, sources, budget, report)
        report["status"] = "deferred" if any(s["deferred"] for s in report["streams"].values()) else "complete"
    except Exception as exc:
        report["status"] = "failed"
        report["error"] = {"type": type(exc).__name__, "message": str(exc)}
        if isinstance(exc, urllib.error.HTTPError):
            report["error"].update(http_status=exc.code,
                                   retry_after=exc.headers.get("Retry-After"),
                                   rate_limit_reset=exc.headers.get("X-RateLimit-Reset"))
        raise
    finally:
        Path(os.environ.get("UPSTREAM_TRACKER_MANIFEST", "upstream-tracker-manifest.json")).write_text(
            json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps(report, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
