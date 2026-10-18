import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

os.environ.setdefault("GITHUB_REPOSITORY", "example/FineCode")
os.environ.setdefault("GITHUB_TOKEN", "offline")
module_path = Path(__file__).resolve().parents[1] / "scripts" / "import_upstream_prs.py"
spec = importlib.util.spec_from_file_location("import_upstream_prs_tested", module_path)
importer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importer)


class ImporterSafetyTests(unittest.TestCase):
    def test_import_scan_paginates_existing_mirrors(self):
        upstream = {"number": 99, "head": {"ref": "feature"}}
        mirrored = [{"number": n, "head": {"ref": f"upstream/pi-pr-{n}"}} for n in range(1, 102)]
        calls = []
        processed = []

        def api(path, method="GET", data=None, accept="application/vnd.github+json"):
            calls.append(path)
            if path.startswith("/repos/earendil-works/pi/pulls?"):
                return [upstream]
            if path.startswith("/repos/example/FineCode/pulls?state=open"):
                page = int(path.rsplit("page=", 1)[1])
                return mirrored[(page - 1) * 100:page * 100]
            if path.startswith("/repos/earendil-works/pi/pulls/"):
                number = int(path.rsplit("/", 1)[1])
                return {"number": number, "head": {"sha": "a" * 40}}
            raise AssertionError(path)

        with patch.object(importer, "TARGET", "example/FineCode"), \
             patch.object(importer, "api", api), \
             patch.object(importer, "git", lambda *a, **k: None), \
             patch.object(importer, "ensure_pr_labels", lambda: None), \
             patch.object(importer, "import_one", lambda pr: processed.append(pr["number"]) or "existing"), \
             patch.dict(os.environ, {"MAX_UPSTREAM_PR_CHECKS": "24", "GITHUB_RUN_NUMBER": "1"}):
            importer.main()

        self.assertTrue(any("state=open&per_page=100&page=2" in x for x in calls))
        self.assertIn(101, processed)
        self.assertNotEqual(processed, [])

    def test_checkpoint_and_no_force_push_in_source(self):
        code = module_path.read_text(encoding="utf-8")
        self.assertIn("actual_tip != expected_tip", code)
        self.assertIn('git("merge-base", "--is-ancestor", old_source, source_sha', code)
        self.assertIn("REBASE_REVIEW upstream", code)
        self.assertNotIn('"--force"', code)
        self.assertNotIn('"--force-with-lease"', code)


if __name__ == "__main__":
    unittest.main()
