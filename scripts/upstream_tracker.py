#!/usr/bin/env python3
"""Mirror Pi upstream tracker metadata to FineCode issues; never sync code."""
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

SOURCE = "earendil-works/pi"
TARGET = os.environ["GITHUB_REPOSITORY"]
TOKEN = os.environ["GITHUB_TOKEN"]
CUTOFF = datetime.now(timezone.utc) - timedelta(days=7)


def api(path, method="GET", payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        "https://api.github.com" + path,
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": "Bearer " + TOKEN,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "FineCode-upstream-tracker",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.load(response)


def pages(path, limit=3):
    for page in range(1, limit + 1):
        sep = "&" if "?" in path else "?"
        items = api(f"{path}{sep}per_page=100&page={page}")
        if not items:
            break
        yield from items
        if len(items) < 100:
            break


def recent(value):
    if not value:
        return False
    return datetime.fromisoformat(value.replace("Z", "+00:00")) >= CUTOFF


def main():
    # Existing mirrored issues are keyed by an immutable upstream identifier.
    existing = {}
    for issue in pages(f"/repos/{TARGET}/issues?state=all", limit=10):
        if "pull_request" in issue:
            continue
        body = issue.get("body") or ""
        for line in body.splitlines():
            if line.startswith("FineCode-Upstream-Key: "):
                existing[line.split(": ", 1)[1].strip()] = issue

    records = []
    for issue in pages(f"/repos/{SOURCE}/issues?state=all&sort=updated&direction=desc"):
        if not recent(issue.get("updated_at")):
            break
        if "pull_request" in issue:
            continue
        number = issue["number"]
        kind = "issue"
        status = issue["state"]
        records.append((f"{kind}:{number}", f"[Pi issue #{number}] {issue['title']}",
                        issue["html_url"], status, issue.get("updated_at")))

    for release in pages(f"/repos/{SOURCE}/releases", limit=1):
        if not recent(release.get("published_at")):
            continue
        tag = release["tag_name"]
        records.append((f"release:{tag}", f"[Pi release] {release['name'] or tag}",
                        release["html_url"], "published", release.get("published_at")))

    for key, title, url, status, updated in records:
        body = (
            f"FineCode-Upstream-Key: {key}\n\n"
            f"**Origem:** {SOURCE}\n\n"
            f"**Link original:** {url}\n\n"
            f"**Estado no upstream:** {status}\n\n"
            f"**Atualizado/publicado:** {updated}\n\n"
            "Espelho informativo. Não copia código, não sincroniza branches "
            "e não autoriza merge automático. Examine a origem antes de adotar alterações."
        )
        old = existing.get(key)
        if old:
            if old.get("title") != title or (old.get("body") or "") != body:
                api(f"/repos/{TARGET}/issues/{old['number']}", "PATCH",
                    {"title": title, "body": body})
                print("Updated", key)
        else:
            created = api(f"/repos/{TARGET}/issues", "POST",
                          {"title": title, "body": body})
            existing[key] = created
            print("Created", key)


if __name__ == "__main__":
    main()
