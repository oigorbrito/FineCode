import importlib.util
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

os.environ.setdefault("GITHUB_REPOSITORY", "example/FineCode")
os.environ.setdefault("GITHUB_TOKEN", "offline")
source = Path(__file__).resolve().parents[1] / "scripts" / "import_upstream_prs.py"
spec = importlib.util.spec_from_file_location("upstream_review_import", source)
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)

UPSTREAM = {
    "number": 42, "title": "fix: example", "state": "open", "draft": False,
    "html_url": "https://github.com/earendil-works/pi/pull/42",
    "head": {"sha": "b" * 40}
}

class ReviewDraftTests(unittest.TestCase):
    def test_conflict_creates_draft_without_applying_code(self):
        git_calls, requests = [], []
        def fake_git(*args, **kwargs):
            git_calls.append(args)
            return SimpleNamespace(returncode=0, stdout=b"")
        def fake_api(path, method="GET", data=None, accept=None):
            requests.append((path, method, data))
            if path.endswith("/pulls") and method == "POST":
                return {"number": 777}
            return {}
        with patch.object(importer, "git", fake_git), \
             patch.object(importer, "git_sha", return_value="c" * 40), \
             patch.object(importer, "api", fake_api), \
             patch.object(importer, "sync_pr_labels"), \
             patch.object(importer, "TARGET", "example/FineCode"):
            result = importer.stage_conflict_review(UPSTREAM, "upstream/pi-pr-42")
        self.assertEqual(result, "created")
        created = next(data for path, method, data in requests
                       if method == "POST" and path.endswith("/pulls"))
        self.assertTrue(created["draft"])
        self.assertIn("CODE NOT APPLIED", created["body"])
        self.assertIn("finecode-upstream-review-only:", created["body"])
        self.assertTrue(any(cmd[0] == "push" for cmd in git_calls))
        self.assertFalse(any("--force" in cmd or "--force-with-lease" in cmd for cmd in git_calls))
        self.assertFalse(any(cmd[0] == "apply" for cmd in git_calls))

    def test_review_only_refreshes_upstream_sha_without_force(self):
        old, new, tip = "a" * 40, "b" * 40, "c" * 40
        upstream = dict(UPSTREAM)
        calls, patches = [], []
        def fake_git(*args, **kwargs):
            calls.append(args)
            return SimpleNamespace(returncode=0, stdout=b"")
        def fake_api(path, method="GET", data=None, accept=None):
            if method == "PATCH":
                patches.append(data)
            return {}
        with patch.object(importer, "git", fake_git), \
             patch.object(importer, "git_sha", side_effect=[tip, "d" * 40]), \
             patch.object(importer, "api", fake_api), \
             patch.object(importer, "TARGET", "example/FineCode"):
            result = importer.refresh_conflict_review(
                {"number": 777}, upstream, "upstream/pi-pr-42", old, tip)
        self.assertEqual(result, "updated")
        self.assertEqual(len(patches), 1)
        self.assertIn(new, patches[0]["body"])
        self.assertTrue(any(cmd[0] == "push" for cmd in calls))

    def test_divergence_blocks_refresh(self):
        git_calls = []
        with patch.object(importer, "git", side_effect=lambda *a, **k: git_calls.append(a) or SimpleNamespace(stdout=b"")), \
             patch.object(importer, "git_sha", return_value="d" * 40), \
             patch.object(importer, "api") as api:
            result = importer.refresh_conflict_review(
                {"number": 777}, UPSTREAM, "upstream/pi-pr-42", "a" * 40, "c" * 40)
        self.assertEqual(result, "conflict")
        self.assertFalse(any(cmd[0] == "push" for cmd in git_calls))
        api.assert_not_called()

    def test_import_one_routes_incompatible_initial_patch_to_review_draft(self):
        calls = []
        def fake_git(*args, **kwargs):
            calls.append(args)
            if args[:3] == ("apply", "--3way", "--index"):
                return SimpleNamespace(returncode=1, stdout=b"")
            return SimpleNamespace(returncode=0, stdout=b"")
        def fake_api(path, method="GET", data=None, accept=None):
            if path.endswith("/pulls/42") and method == "GET":
                return UPSTREAM
            if method == "GET" and accept == "application/vnd.github.v3.patch":
                return b"diff --git a/a b/a"
            raise AssertionError((path, method, accept))
        with patch.object(importer, "existing_pr", return_value=None), \
             patch.object(importer, "api", side_effect=fake_api), \
             patch.object(importer, "git", side_effect=fake_git), \
             patch.object(importer, "stage_conflict_review", return_value="created") as stage:
            result = importer.import_one({"number": 42})
        self.assertEqual(result, "created")
        stage.assert_called_once_with(UPSTREAM, "upstream/pi-pr-42")
        self.assertTrue(any(cmd[:3] == ("apply", "--3way", "--index") for cmd in calls))
        self.assertFalse(any(cmd[0] == "push" for cmd in calls))


if __name__ == "__main__":
    unittest.main()
