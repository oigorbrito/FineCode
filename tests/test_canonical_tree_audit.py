"""Contract tests for the read-only canonical tree comparator."""
import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE = Path(__file__).resolve().parents[1] / "scripts" / "audit_canonical_tree.py"
spec = importlib.util.spec_from_file_location("canonical_tree_audit", MODULE)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class CanonicalTreeAuditTests(unittest.TestCase):
    def test_classifies_objects_modes_and_presence_without_semantic_claims(self):
        main = {"same": ("100644", "blob", "a"), "edited": ("100644", "blob", "b"),
                "mode": ("100644", "blob", "c"), "main-only": ("100644", "blob", "d")}
        other = {"same": ("100644", "blob", "a"), "edited": ("100644", "blob", "e"),
                 "mode": ("100755", "blob", "c"), "other-only": ("100644", "blob", "f")}
        rows = audit.compare(main, other, "main", "canonical")
        states = {row["path"]: row["state"] for row in rows}
        self.assertEqual(states, {"edited": "different_object", "main-only": "main_only",
                                  "mode": "mode_or_type_difference", "other-only": "other_only",
                                  "same": "identical_object"})
        self.assertTrue(all(row["semantic_decision"] == "not_reviewed"
                            for row in rows if row["state"] != "identical_object"))

    def test_triage_priority_does_not_claim_semantic_equivalence(self):
        main = {"packages/ai/src/models.ts": ("100644", "blob", "a")}
        other = {"packages/ai/src/models.ts": ("100644", "blob", "b"),
                 "packages/ai/test/models.test.ts": ("100644", "blob", "t"),
                 "docs/provenance.md": ("100644", "blob", "d")}
        rows = {r["path"]: r for r in audit.compare(main, other, "main", "canonical")}
        self.assertEqual(rows["packages/ai/src/models.ts"]["review_priority"], "P0-runtime-or-contract")
        self.assertEqual(rows["packages/ai/src/models.ts"]["subsystem"], "packages/ai")
        self.assertEqual(rows["packages/ai/test/models.test.ts"]["review_priority"], "P1-tests")
        self.assertEqual(rows["docs/provenance.md"]["review_priority"], "P2-docs")
        self.assertTrue(all(r["semantic_decision"] == "not_reviewed" for r in rows.values()))

    def test_exports_non_utf8_git_names_with_exact_byte_identity(self):
        raw_name = bytes.fromhex("756e757375616c2dff2e747874")
        path = raw_name.decode("utf-8", "surrogateescape")
        rows = audit.compare({}, {path: ("100644", "blob", "a")}, "main", "canonical")
        self.assertEqual(rows[0]["path_bytes_hex"], raw_name.hex())
        self.assertEqual(rows[0]["path"], "unusual-\xff.txt")
        with tempfile.TemporaryDirectory() as d:
            file = Path(d) / "report.csv"
            audit.export(file, rows)
            self.assertEqual(file.read_bytes().decode("utf-8").count(raw_name.hex()), 1)

    def test_csv_handles_ambiguous_path_characters(self):
        rows = audit.compare({}, {"name\twith,comma\nand newline": ("100644", "blob", "a")}, "main", "canonical")
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "report.csv"
            audit.export(p, rows)
            import csv
            with p.open(newline="", encoding="utf-8") as stream:
                loaded = list(csv.DictReader(stream))
            self.assertEqual(loaded[0]["path"], "name\twith,comma\nand newline")


if __name__ == "__main__":
    unittest.main()
