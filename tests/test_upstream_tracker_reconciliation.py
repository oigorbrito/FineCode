import contextlib
import copy
import importlib.util
import io
import json
import os
import pathlib
import tempfile
import unittest
import urllib.error
from unittest.mock import patch

os.environ.setdefault("GITHUB_REPOSITORY", "example/FineCode")
os.environ.setdefault("GITHUB_TOKEN", "offline-test-token")
MODULE = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "upstream_tracker.py"
spec = importlib.util.spec_from_file_location("upstream_tracker", MODULE)
tracker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(tracker)


def source(number, **changes):
    return {"number": number, "title": f"Proposal {number}", "state": "open",
            "html_url": f"https://github.com/earendil-works/pi/issues/{number}",
            "updated_at": "2024-01-01T00:00:00Z", "labels": [], **changes}


class MirrorReconciliationTest(unittest.TestCase):
    def setUp(self):
        self.stored = {}
        self.calls = []
        self.issues = [source(11)]
        self.prs = [source(22)]
        self.releases = [{"id": 1, "name": "Initial", "tag_name": "v1",
                          "html_url": "https://example.com/v1", "published_at": "2020-01-01T00:00:00Z"}]
        self.failure = None
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.manifest = pathlib.Path(self.temp.name) / "manifest.json"
        patches = [patch.object(tracker, "TARGET", "example/FineCode"),
                   patch.object(tracker, "api", self.api),
                   patch.object(tracker, "ensure_labels", lambda: None),
                   patch.dict(os.environ, {"UPSTREAM_TRACKER_MANIFEST": str(self.manifest)})]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def api(self, path, method="GET", payload=None):
        if self.failure:
            self.failure(path, method, payload)
        if method == "GET":
            if "/example/FineCode/issues?" in path:
                items = list(self.stored.values())
            elif "/earendil-works/pi/issues?" in path:
                self.assertIn("state=all", path)
                items = self.issues
            elif "/earendil-works/pi/pulls?" in path:
                self.assertIn("state=all", path)
                items = self.prs
            elif "/earendil-works/pi/releases?" in path:
                items = self.releases
            else:
                raise AssertionError(path)
            page = int(path.rsplit("page=", 1)[-1])
            return copy.deepcopy(items[(page - 1) * 100:page * 100])
        self.calls.append((path, method, copy.deepcopy(payload)))
        self.assertNotIn("state", payload)
        if method == "POST":
            self.assertEqual(path, "/repos/example/FineCode/issues")
            key = next(line.split(": ", 1)[1] for line in payload["body"].splitlines()
                       if line.startswith("FineCode-Upstream-Key: "))
            self.assertNotIn(key, self.stored)
            item = {**payload, "number": 200 + len(self.stored), "state": "open",
                    "labels": [{"name": name} for name in payload.get("labels", [])]}
            self.stored[key] = item
        else:
            self.assertEqual(method, "PATCH")
            self.assertEqual(set(payload), {"title", "body"})
            item = next(v for v in self.stored.values() if path.endswith(f"/issues/{v['number']}"))
            item.update(payload)
        return copy.deepcopy(item)

    def run_tracker(self):
        with contextlib.redirect_stdout(io.StringIO()):
            tracker.main()
        return json.loads(self.manifest.read_text(encoding="utf-8"))

    def test_create_update_close_reopen_and_idempotency(self):
        self.assertEqual(self.run_tracker()["status"], "complete")
        self.assertEqual(set(self.stored), {"issue:11", "pr:22", "release:v1"})
        self.assertEqual(len(self.calls), 3)
        self.run_tracker()
        self.assertEqual(len(self.calls), 3)
        self.issues[0].update(state="closed", title="Resolved", state_reason="completed")
        self.prs[0].update(state="closed", merged_at="2024-02-01T00:00:00Z")
        self.run_tracker()
        self.assertIn("**Estado no upstream:** closed", self.stored["issue:11"]["body"])
        self.assertIn("**Estado no upstream:** merged", self.stored["pr:22"]["body"])
        self.assertEqual(self.stored["issue:11"]["state"], "open")
        self.issues[0]["state"] = "open"
        self.prs[0].update(state="open", merged_at=None)
        self.run_tracker()
        self.assertIn("**Estado no upstream:** open", self.stored["issue:11"]["body"])
        self.prs[0]["state"] = "closed"
        self.run_tracker()
        self.assertIn("**Estado no upstream:** closed", self.stored["pr:22"]["body"])
        writes = len(self.calls)
        self.run_tracker()
        self.assertEqual(len(self.calls), writes)

    def test_budget_resume_across_more_than_ten_pages_and_old_releases(self):
        self.issues = [source(n) for n in range(1, 1002)]
        self.prs = [source(n, state="closed") for n in range(1, 16)]
        self.releases = [{**self.releases[0], "tag_name": f"v{n}"} for n in range(16)]
        first = self.run_tracker()
        self.assertEqual(first["streams"]["issue"], {"seen": 1001, "writes": 10, "deferred": 991, "unchanged": 0})
        self.assertEqual(first["streams"]["pr"]["writes"], 10)
        self.assertEqual(first["streams"]["release"]["writes"], 10)
        second = self.run_tracker()
        self.assertEqual(second["streams"]["issue"]["unchanged"], 10)
        self.assertEqual(second["streams"]["pr"]["writes"], 5)
        self.assertEqual(second["streams"]["release"]["writes"], 6)
        # Resume solely from persisted mirrors, with no cache or manifest.
        self.manifest.unlink()
        self.run_tracker()
        self.assertEqual(sum(k.startswith("issue:") for k in self.stored), 30)
        self.assertEqual(sum(k.startswith("pr:") for k in self.stored), 15)

    def test_closed_local_mirror_labels_and_human_notes_are_preserved(self):
        self.run_tracker()
        item = self.stored["issue:11"]
        item.update(state="closed", labels=[{"name": "finecode-candidate"}, {"name": "bug"}])
        item["body"] = "Human decision before\n" + item["body"] + "\nHuman decision after"
        self.issues[0].update(title="Renamed", labels=[{"name": "enhancement"}])
        self.run_tracker()
        self.assertEqual(item["state"], "closed")
        self.assertEqual(item["labels"], [{"name": "finecode-candidate"}, {"name": "bug"}])
        self.assertTrue(item["body"].startswith("Human decision before"))
        self.assertTrue(item["body"].endswith("Human decision after"))
        self.assertIn('"enhancement"', item["body"])

    def test_legacy_checkpoint_and_annotations_are_preserved(self):
        self.stored["issue:11"] = {"number": 100, "title": "Legacy", "state": "open", "labels": [],
                                    "body": "FineCode-Upstream-Key: issue:11\n\nManual assessment: decline"}
        self.run_tracker()
        self.assertIn("Manual assessment: decline", self.stored["issue:11"]["body"])
        calls = len(self.calls)
        self.run_tracker()
        self.assertEqual(len(self.calls), calls)

    def test_rate_limit_after_committed_write_resumes_without_duplicate(self):
        def fail(path, method, payload):
            if method == "POST" and len(self.calls) == 1:
                raise urllib.error.HTTPError(path, 429, "rate limited", {"Retry-After": "60"}, None)
        self.failure = fail
        with self.assertRaises(urllib.error.HTTPError):
            self.run_tracker()
        report = json.loads(self.manifest.read_text())
        self.assertEqual(report["status"], "failed")
        self.assertEqual(report["error"]["retry_after"], "60")
        self.assertEqual(len(report["changes"]), 1)
        self.failure = None
        self.run_tracker()
        self.assertEqual(len(self.calls), 3)

    def test_ambiguous_post_response_resumes_from_server_inventory(self):
        original = self.api
        def lose_response(path, method="GET", payload=None):
            result = original(path, method, payload)
            if method == "POST":
                raise TimeoutError("response lost after server committed")
            return result
        with patch.object(tracker, "api", lose_response), self.assertRaises(TimeoutError):
            self.run_tracker()
        self.run_tracker()
        self.assertEqual(len(self.calls), 3)

    def test_partial_read_failure_does_not_write(self):
        self.issues = [source(n) for n in range(101)]
        def fail(path, method, payload):
            if "/pi/issues?" in path and path.endswith("page=2"):
                raise urllib.error.URLError("network unavailable")
        self.failure = fail
        with self.assertRaises(urllib.error.URLError):
            self.run_tracker()
        self.assertEqual(self.calls, [])
        self.assertEqual(json.loads(self.manifest.read_text())["status"], "failed")
        self.failure = None
        self.assertEqual(self.run_tracker()["status"], "deferred")

    def test_release_edit_draft_exclusion_and_metadata_changes(self):
        self.releases.append({**self.releases[0], "tag_name": "draft", "draft": True})
        self.run_tracker()
        self.releases[0].update(name="Corrected release", prerelease=True)
        self.issues[0].update(assignees=[{"login": "maintainer"}], milestone={"title": "next"})
        self.prs[0].update(draft=True, head={"sha": "abc"})
        self.run_tracker()
        self.assertNotIn("release:draft", self.stored)
        self.assertIn("Corrected release", self.stored["release:v1"]["title"])
        self.assertIn('"prerelease": true', self.stored["release:v1"]["body"])
        self.assertIn('"milestone": "next"', self.stored["issue:11"]["body"])
        self.assertIn('"head": "abc"', self.stored["pr:22"]["body"])

    def test_duplicate_identity_fails_closed(self):
        self.run_tracker()
        self.stored["duplicate"] = {**self.stored["issue:11"], "number": 999}
        calls = len(self.calls)
        with self.assertRaises(ValueError):
            self.run_tracker()
        self.assertEqual(len(self.calls), calls)

    def test_malformed_managed_block_is_not_overwritten(self):
        self.run_tracker()
        self.stored["issue:11"]["body"] += tracker.BEGIN
        calls = len(self.calls)
        with self.assertRaises(ValueError):
            self.run_tracker()
        self.assertEqual(len(self.calls), calls)

    def test_local_inventory_paginates_past_first_thousand(self):
        calls = []
        def fake_api(path, method="GET", payload=None):
            calls.append(path)
            page = int(path.rsplit("page=", 1)[-1])
            return [{"number": (page - 1) * 100 + n} for n in range(100 if page <= 10 else 1)]
        with patch.object(tracker, "api", fake_api):
            entries = list(tracker.pages("/repos/example/FineCode/issues?state=all"))
        self.assertEqual(len(entries), 1001)
        self.assertEqual(len(calls), 11)


if __name__ == "__main__":
    unittest.main()
