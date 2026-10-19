"""Git-level proof of the incremental/rebase safety predicates."""
import subprocess
import tempfile
from pathlib import Path
import unittest


class UpstreamHistoryPredicatesTest(unittest.TestCase):
    def test_linear_rebase_equivalent_and_changed_trees(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)

            def git(*args, check=True):
                return subprocess.run(
                    ["git", "-C", str(root), *args], check=check,
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
                )

            git("init", "-q")
            git("config", "user.name", "FineCode CI")
            git("config", "user.email", "ci@example.invalid")
            (root / "change.txt").write_text("base\n", encoding="utf-8")
            git("add", "change.txt")
            git("commit", "-qm", "base")
            base = git("rev-parse", "HEAD").stdout.strip()

            (root / "change.txt").write_text("base\nfeature\n", encoding="utf-8")
            git("commit", "-qam", "original upstream feature")
            old = git("rev-parse", "HEAD").stdout.strip()

            (root / "change.txt").write_text("base\nfeature\nmore\n", encoding="utf-8")
            git("commit", "-qam", "linear update")
            linear = git("rev-parse", "HEAD").stdout.strip()
            self.assertEqual(git("merge-base", "--is-ancestor", old, linear, check=False).returncode, 0)
            self.assertEqual(git("diff", "--quiet", old, linear, check=False).returncode, 1)

            git("checkout", "-q", "--detach", base)
            (root / "change.txt").write_text("base\nfeature\n", encoding="utf-8")
            git("commit", "-qam", "rewritten upstream feature")
            equivalent = git("rev-parse", "HEAD").stdout.strip()
            self.assertNotEqual(old, equivalent)
            self.assertNotEqual(git("merge-base", "--is-ancestor", old, equivalent, check=False).returncode, 0)
            self.assertEqual(git("diff", "--quiet", old, equivalent, check=False).returncode, 0)

            (root / "change.txt").write_text("base\nfeature\nrebased delta\n", encoding="utf-8")
            git("commit", "-qam", "changed after rebase")
            changed = git("rev-parse", "HEAD").stdout.strip()
            self.assertNotEqual(git("merge-base", "--is-ancestor", old, changed, check=False).returncode, 0)
            self.assertEqual(git("diff", "--quiet", old, changed, check=False).returncode, 1)

            self.assertEqual(git("diff", "--quiet", "0" * 40, changed, check=False).returncode, 128)


if __name__ == "__main__":
    unittest.main()
