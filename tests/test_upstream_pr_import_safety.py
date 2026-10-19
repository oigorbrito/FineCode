import importlib.util
import io
import json
import tempfile
from contextlib import redirect_stdout
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

os.environ.setdefault("GITHUB_REPOSITORY", "example/FineCode")
os.environ.setdefault("GITHUB_TOKEN", "offline")
module_path = Path(__file__).resolve().parents[1] / "scripts" / "import_upstream_prs.py"
spec = importlib.util.spec_from_file_location("import_upstream_prs_tested", module_path)
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class ImporterSafetyTests(unittest.TestCase):
    def test_rotation_is_stable_and_tracks_inventory_changes(self):
        inventory = list(range(10))
        first = importer.choose_rotating(inventory, 3, 4)
        self.assertEqual(first[:3], [9, 0, 1])
        changed = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10]
        self.assertEqual(importer.choose_rotating(changed, 3, 4)[:3], [10, 0, 1])
        self.assertEqual(importer.choose_rotating(inventory, 0, 4), [])

    def test_decision_classification_distinguishes_mirror_divergence(self):
        self.assertEqual(importer.classify_decision("conflict", "review branch diverged; left untouched"), "MIRROR_DIVERGED")
        self.assertEqual(importer.classify_decision("conflict", "upstream history rewritten and trees differ"), "REBASE_CHANGED_TREE")
        self.assertEqual(importer.classify_decision("conflict", "linear delta could not be applied"), "BLOCKED_CONFLICT")

    def test_checkpoint_parser_and_manifest_writer(self):
        source, tip = "a" * 40, "b" * 40
        self.assertEqual(importer.checkpoint_from_body(
            f"<!-- finecode-upstream-source:{source} tip:{tip} -->"),
            {"source_sha": source, "finecode_tip": tip})
        self.assertIsNone(importer.checkpoint_from_body("no checkpoint"))
        manifest = {"schema_version": 1, "selected": []}
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "manifest.json"
            with patch.dict(os.environ, {"UPSTREAM_IMPORT_MANIFEST": str(path)}):
                importer.write_manifest(manifest)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), manifest)

    def test_import_scan_paginates_existing_mirrors(self):
        upstream = {"number": 99, "head": {"ref": "feature"}}
        mirrored = [{"number": n, "head": {"ref": f"upstream/pi-pr-{n}"}} for n in range(1, 102)]
        calls = []
        processed = []
        manifests = []

        def api(path, method="GET", data=None, accept="application/vnd.github+json"):
            calls.append(path)
            if path.startswith("/repos/earendil-works/pi/pulls?"):
                return [upstream] if path.endswith("&page=1") else []
            if path.startswith("/repos/example/FineCode/pulls?state=open"):
                page = int(path.rsplit("page=", 1)[1])
                return mirrored[(page - 1) * 100:page * 100]
            if path.startswith("/repos/earendil-works/pi/pulls/"):
                number = int(path.rsplit("/", 1)[1])
                return {"number": number, "head": {"sha": "a" * 40}}
            if "pulls?state=all&head=" in path:
                number = int(path.split("upstream/pi-pr-")[1].split("&")[0])
                return [next((item for item in mirrored if item["head"]["ref"] == f"upstream/pi-pr-{number}"), {})]
            raise AssertionError(path)

        with patch.object(importer, "TARGET", "example/FineCode"), \
             patch.object(importer, "api", api), \
             patch.object(importer, "git", lambda *a, **k: SimpleNamespace(stdout=b"", returncode=0)), \
             patch.object(importer, "ensure_pr_labels", lambda: None), \
             patch.object(importer, "import_one", lambda pr: processed.append(pr["number"]) or "existing"), \
             patch.object(importer, "write_manifest", side_effect=lambda value: manifests.append(json.loads(json.dumps(value)))), \
             patch.dict(os.environ, {"MAX_UPSTREAM_PR_CHECKS": "24", "GITHUB_RUN_NUMBER": "1"}):
            importer.main()

        self.assertTrue(any("state=open&per_page=100&page=2" in x for x in calls))
        self.assertTrue(any('pulls/101' in x for x in calls))
        self.assertNotEqual(processed, [])
        final_manifest = manifests[-1]
        self.assertEqual(final_manifest["run_number"], 1)
        self.assertEqual(len(final_manifest["eligible_inventory"]["updates"]), 101)
        self.assertEqual(len(final_manifest["selected"]), 8)
        self.assertEqual(len({event["upstream_pr"] for event in final_manifest["selected"]}), 8)
        self.assertEqual(final_manifest["selected"][0]["inventory_position"], 0)
        self.assertEqual(final_manifest["selected"][0]["classification"], "UNCHANGED")
        self.assertEqual(final_manifest["selected"][0]["finecode_head_before"], None)

    def test_summary_distinguishes_incremental_code_from_equivalent_rebase(self):
        proposals = [{"number": 11}, {"number": 12}]
        def api(path, method="GET", data=None, accept="application/vnd.github+json"):
            if "pulls?state=open&sort=updated" in path:
                return proposals if path.endswith("&page=1") else []
            if "pulls?state=open&per_page=100" in path:
                return [{"number": 201, "head": {"ref": "upstream/pi-pr-11", "sha": "c" * 40}, "body": ""},
                        {"number": 202, "head": {"ref": "upstream/pi-pr-12", "sha": "d" * 40}, "body": ""}]
            if path in ("/repos/earendil-works/pi/pulls/11", "/repos/earendil-works/pi/pulls/12"):
                number = int(path.rsplit("/", 1)[1])
                return {"number": number, "head": {"sha": f"{number:x}" * 40}}
            if "pulls?state=all&head=" in path:
                number = int(path.split("upstream/pi-pr-")[1].split("&")[0])
                return [{"number": 200 + number, "head": {"ref": f"upstream/pi-pr-{number}", "sha": "c" * 40}, "body": ""}]
            raise AssertionError(path)

        results = {11: "updated", 12: "rebase_equivalent"}
        output = io.StringIO()
        manifests = []
        with patch.object(importer, "TARGET", "example/FineCode"), \
             patch.object(importer, "api", side_effect=api), \
             patch.object(importer, "git", return_value=SimpleNamespace(stdout=b"", returncode=0)), \
             patch.object(importer, "ensure_pr_labels"), \
             patch.object(importer, "import_one", side_effect=lambda p: results[p["number"]]), \
             patch.object(importer, "write_manifest", side_effect=lambda value: manifests.append(json.loads(json.dumps(value)))), \
             patch.dict(os.environ, {"MAX_UPSTREAM_PR_CHECKS": "24", "GITHUB_RUN_NUMBER": "1"}), \
             redirect_stdout(output):
            importer.main()
        self.assertIn("code updated 1", output.getvalue())
        self.assertIn("rebase equivalent 1", output.getvalue())
        self.assertIn("failures 0", output.getvalue())

    def test_checkpoint_and_no_force_push_in_source(self):
        code = module_path.read_text(encoding="utf-8")
        self.assertIn("actual_tip != expected_tip", code)
        self.assertIn('git("merge-base", "--is-ancestor", old_source, source_sha', code)
        self.assertIn("REBASE_REVIEW upstream", code)
        self.assertNotIn('"--force"', code)
        self.assertNotIn('"--force-with-lease"', code)

    def test_linear_upstream_commit_updates_existing_mirror_without_force(self):
        old_source, new_source, tip = "a" * 40, "b" * 40, "c" * 40
        branch = "upstream/pi-pr-42"
        local = {"number": 280, "state": "open",
                 "body": f"<!-- finecode-upstream-source:{old_source} tip:{tip} -->",
                 "labels": []}
        upstream = {"number": 42}
        calls = []
        metadata_updates = []
        sha_checks = iter([tip, "d" * 40])

        def fake_api(path, method="GET", data=None, accept="application/vnd.github+json"):
            if path.endswith("/pulls/42"):
                return {"number": 42, "head": {"sha": new_source},
                        "title": "Changed PR", "state": "open", "html_url": "https://github.com/earendil-works/pi/pull/42", "draft": False}
            raise AssertionError(path)

        def fake_git(*args, **kwargs):
            calls.append(args)
            if args[:2] == ("merge-base", "--is-ancestor"):
                return SimpleNamespace(returncode=0, stdout=b"")
            if args[:3] == ("diff", "--cached", "--quiet"):
                return SimpleNamespace(returncode=1, stdout=b"")
            if args[0] == "diff":
                return SimpleNamespace(returncode=0, stdout=b"patch")
            if args[:3] == ("apply", "--3way", "--index"):
                return SimpleNamespace(returncode=0, stdout=b"")
            return SimpleNamespace(returncode=0, stdout=b"")

        with patch.object(importer, "TARGET", "example/FineCode"), \
             patch.object(importer, "existing_pr", return_value=local), \
             patch.object(importer, "api", fake_api), \
             patch.object(importer, "git", fake_git), \
             patch.object(importer, "git_sha", side_effect=lambda ref="HEAD": next(sha_checks)), \
             patch.object(importer, "sync_pr_labels"), \
             patch.object(importer, "update_metadata", side_effect=lambda *a: metadata_updates.append(a)):
            result = importer.import_one(upstream)

        self.assertEqual(result, "updated")
        self.assertTrue(any(c[:2] == ("merge-base", "--is-ancestor") for c in calls))
        self.assertTrue(any(c[0] == "push" and "--force" not in c for c in calls))
        self.assertEqual(len(metadata_updates), 1)

    def test_mirror_branch_divergence_is_reported_without_push(self):
        old_source, new_source, expected_tip = "a" * 40, "b" * 40, "c" * 40
        local = {"number": 280, "state": "open",
                 "body": f"<!-- finecode-upstream-source:{old_source} tip:{expected_tip} -->",
                 "labels": []}
        calls = []
        full = {"number": 42, "head": {"sha": new_source}, "title": "Changed",
                "state": "open", "html_url": "https://github.com/earendil-works/pi/pull/42"}

        def fake_git(*args, **kwargs):
            calls.append(args)
            return SimpleNamespace(returncode=0, stdout=b"")

        with patch.object(importer, "TARGET", "example/FineCode"), \
             patch.object(importer, "existing_pr", return_value=local), \
             patch.object(importer, "api", return_value=full), \
             patch.object(importer, "git", fake_git), \
             patch.object(importer, "git_sha", return_value="d" * 40), \
             patch.object(importer, "sync_pr_labels"), \
             patch.object(importer, "update_metadata") as update:
            result = importer.import_one({"number": 42})

        self.assertEqual(result, "conflict")
        self.assertIn("differs from saved tip checkpoint", importer.LAST_IMPORT_DECISION["reason"])
        self.assertFalse(any(call[0] == "push" for call in calls))
        update.assert_not_called()

    def test_rewritten_upstream_history_preserves_mirror_branch(self):
        old_source, new_source, tip = "a" * 40, "b" * 40, "c" * 40
        local = {"number": 280, "state": "open",
                 "body": f"<!-- finecode-upstream-source:{old_source} tip:{tip} -->",
                 "labels": []}
        calls = []

        def fake_api(path, method="GET", data=None, accept="application/vnd.github+json"):
            return {"number": 42, "head": {"sha": new_source},
                    "title": "Rebased", "state": "open"}

        def fake_git(*args, **kwargs):
            calls.append(args)
            if args[:2] == ("merge-base", "--is-ancestor"):
                return SimpleNamespace(returncode=1, stdout=b"")
            if args[:2] == ("diff", "--quiet"):
                return SimpleNamespace(returncode=1, stdout=b"")
            return SimpleNamespace(returncode=0, stdout=b"")

        with patch.object(importer, "TARGET", "example/FineCode"), \
             patch.object(importer, "existing_pr", return_value=local), \
             patch.object(importer, "api", fake_api), \
             patch.object(importer, "git", fake_git), \
             patch.object(importer, "git_sha", return_value=tip), \
             patch.object(importer, "sync_pr_labels"), \
             patch.object(importer, "update_metadata") as update:
            result = importer.import_one({"number": 42})
        self.assertEqual(result, "conflict")
        self.assertFalse(any(c[0] == "push" for c in calls))
        update.assert_not_called()


    def test_tree_identical_rebase_advances_checkpoint_without_push(self):
        old_source, new_source, tip = "a" * 40, "b" * 40, "c" * 40
        local = {"number": 280, "state": "open",
                 "body": f"<!-- finecode-upstream-source:{old_source} tip:{tip} -->",
                 "labels": []}
        full = {"number": 42, "head": {"sha": new_source},
                "html_url": "https://github.com/earendil-works/pi/pull/42",
                "title": "Rebased without code change", "state": "open"}
        calls, updated = [], []

        def fake_git(*args, **kwargs):
            calls.append(args)
            if args[:2] == ("merge-base", "--is-ancestor"):
                return SimpleNamespace(returncode=1, stdout=b"")
            if args[:2] == ("diff", "--quiet"):
                return SimpleNamespace(returncode=0, stdout=b"")
            return SimpleNamespace(returncode=0, stdout=b"")

        with patch.object(importer, "TARGET", "example/FineCode"), \
             patch.object(importer, "existing_pr", return_value=local), \
             patch.object(importer, "api", return_value=full), \
             patch.object(importer, "git", side_effect=fake_git), \
             patch.object(importer, "git_sha", return_value=tip), \
             patch.object(importer, "sync_pr_labels"), \
             patch.object(importer, "update_metadata", side_effect=lambda *args: updated.append(args)):
            result = importer.import_one({"number": 42})
        self.assertEqual(result, "rebase_equivalent")
        self.assertEqual(len(updated), 1)
        self.assertIn(new_source, updated[0][2])
        self.assertFalse(any(c[0] in ("push", "commit", "apply") for c in calls))

    def test_unverifiable_rebase_fails_closed_without_changing_checkpoint(self):
        old_source, new_source, tip = "a" * 40, "b" * 40, "c" * 40
        local = {"number": 280, "state": "open",
                 "body": f"<!-- finecode-upstream-source:{old_source} tip:{tip} -->",
                 "labels": []}
        full = {"number": 42, "head": {"sha": new_source},
                "html_url": "https://github.com/earendil-works/pi/pull/42",
                "title": "Unverifiable rebase", "state": "open"}
        calls = []
        def fake_git(*args, **kwargs):
            calls.append(args)
            if args[:2] == ("merge-base", "--is-ancestor"):
                return SimpleNamespace(returncode=1, stdout=b"")
            if args[:2] == ("diff", "--quiet"):
                return SimpleNamespace(returncode=128, stdout=b"")
            return SimpleNamespace(returncode=0, stdout=b"")
        with patch.object(importer, "TARGET", "example/FineCode"), \
             patch.object(importer, "existing_pr", return_value=local), \
             patch.object(importer, "api", return_value=full), \
             patch.object(importer, "git", side_effect=fake_git), \
             patch.object(importer, "git_sha", return_value=tip), \
             patch.object(importer, "sync_pr_labels"), \
             patch.object(importer, "update_metadata") as update:
            result = importer.import_one({"number": 42})
        self.assertEqual(result, "conflict")
        update.assert_not_called()
        self.assertFalse(any(c[0] in ("push", "commit", "apply") for c in calls))


if __name__ == "__main__":
    unittest.main()
