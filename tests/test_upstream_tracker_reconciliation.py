import importlib.util
import os
import pathlib
import unittest
from unittest.mock import patch

os.environ.setdefault("GITHUB_REPOSITORY", "example/FineCode")
os.environ.setdefault("GITHUB_TOKEN", "offline-test-token")
MODULE = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "upstream_tracker.py"
spec = importlib.util.spec_from_file_location("upstream_tracker", MODULE)
tracker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tracker)


class MirrorReconciliationTest(unittest.TestCase):
    def test_backfills_old_open_issue_and_tracks_incompatible_pr_idempotently(self):
        stored = {}
        writes = []
        old_issue = {
            "number": 11, "title": "Old unresolved issue", "state": "open",
            "html_url": "https://github.com/earendil-works/pi/issues/11",
            "updated_at": "2024-01-01T00:00:00Z", "labels": [],
        }
        source_pr = {
            "number": 22, "title": "Patch incompatible with FineCode",
            "state": "open", "updated_at": "2024-01-01T00:00:00Z",
            "html_url": "https://github.com/earendil-works/pi/pull/22",
        }

        def fake_pages(path, limit=3):
            if "/example/FineCode/issues?" in path:
                return iter(stored.values())
            if "/earendil-works/pi/issues?" in path:
                return iter([old_issue])
            if "/earendil-works/pi/pulls?" in path:
                return iter([source_pr])
            return iter([])

        def fake_api(path, method="GET", payload=None):
            if method == "POST" and path == "/repos/example/FineCode/issues":
                item = {**payload, "number": 200 + len(stored),
                        "labels": [{"name": name} for name in payload.get("labels", [])]}
                key = next(line.split(": ", 1)[1] for line in item["body"].splitlines()
                           if line.startswith("FineCode-Upstream-Key: "))
                stored[key] = item
                writes.append(("created", key))
                return item
            if method == "PATCH" and "/issues/" in path:
                number = int(path.rsplit("/", 1)[-1])
                entry = next(v for v in stored.values() if v["number"] == number)
                entry.update(payload)
                if "labels" in payload:
                    entry["labels"] = [{"name": name} for name in payload["labels"]]
                writes.append(("updated", number))
                return entry
            raise AssertionError(f"Unexpected API call: {method} {path}")

        with patch.object(tracker, "TARGET", "example/FineCode"), \
             patch.object(tracker, "pages", fake_pages), \
             patch.object(tracker, "api", fake_api), \
             patch.object(tracker, "ensure_labels", lambda: None):
            tracker.main()
            self.assertEqual(set(stored), {"issue:11", "pr:22"})
            self.assertEqual(sum(kind == "created" for kind, _ in writes), 2)
            self.assertEqual(len(writes), 3)  # One label reconciliation after issue creation
            tracker.main()
            self.assertEqual(sum(kind == "created" for kind, _ in writes), 2)
            count_after_labels = len(writes)
            tracker.main()
            self.assertEqual(len(writes), count_after_labels)
            self.assertIn("Não há merge", stored["pr:22"]["body"])

    def test_local_mirror_inventory_paginates_past_first_thousand(self):
        calls = []

        def fake_api(path, method="GET", payload=None):
            calls.append(path)
            page = int(path.rsplit("page=", 1)[-1])
            if page <= 10:
                return [{"number": (page - 1) * 100 + idx} for idx in range(100)]
            if page == 11:
                return [{"number": 1001}]
            return []

        with patch.object(tracker, "api", fake_api):
            entries = list(tracker.pages("/repos/example/FineCode/issues?state=all", limit=None))
        self.assertEqual(len(entries), 1001)
        self.assertEqual(len(calls), 11)
        self.assertEqual(entries[-1]["number"], 1001)

    def test_write_budget_limits_backfill_per_run(self):
        stored = {}
        created = []
        source_issues = [
            {"number": n, "title": f"Issue {n}", "state": "open",
             "html_url": f"https://github.com/earendil-works/pi/issues/{n}",
             "updated_at": "2024-01-01T00:00:00Z", "labels": []}
            for n in range(1, 16)
        ]
        source_prs = [
            {"number": n, "title": f"PR {n}", "state": "open",
             "html_url": f"https://github.com/earendil-works/pi/pull/{n}",
             "updated_at": "2024-01-01T00:00:00Z"}
            for n in range(1, 16)
        ]

        def fake_pages(path, limit=3):
            if "/example/FineCode/issues?" in path:
                return iter(stored.values())
            if "/earendil-works/pi/issues?" in path:
                return iter(source_issues)
            if "/earendil-works/pi/pulls?" in path:
                return iter(source_prs)
            return iter([])

        def fake_api(path, method="GET", payload=None):
            if method == "POST" and path == "/repos/example/FineCode/issues":
                key = payload["body"].splitlines()[0].split(": ", 1)[1]
                item = {**payload, "number": 100 + len(stored), "labels": []}
                stored[key] = item
                created.append(key)
                return item
            raise AssertionError(f"Unexpected API call: {method} {path}")

        with patch.object(tracker, "TARGET", "example/FineCode"), \
             patch.object(tracker, "pages", fake_pages), \
             patch.object(tracker, "api", fake_api), \
             patch.object(tracker, "ensure_labels", lambda: None):
            tracker.main()
        self.assertEqual(sum(k.startswith("issue:") for k in created), 10)
        self.assertEqual(sum(k.startswith("pr:") for k in created), 10)


if __name__ == "__main__":
    unittest.main()
