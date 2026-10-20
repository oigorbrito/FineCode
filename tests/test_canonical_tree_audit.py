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
