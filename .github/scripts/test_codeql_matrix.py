"""Regression coverage for repository-aware CodeQL selection."""

import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location(
    "codeql_matrix", Path(__file__).with_name("codeql_matrix.py")
)
codeql_matrix = importlib.util.module_from_spec(spec)
spec.loader.exec_module(codeql_matrix)


def names(paths):
    return [row["language"] for row in codeql_matrix.choose(paths)]


class MatrixSelectionTests(unittest.TestCase):
    def test_spacemolt_skips_keyboard(self):
        self.assertEqual(names(["spacemolt/smx/src/smx/contract.py",
                                "plugins/spacemolt/skills/spacemolt/SKILL.md"]), ["python"])

    def test_keyboard_runs_kotlin_and_swift(self):
        self.assertEqual(names(["intent-keyboard/core/src/commonMain/kotlin/Foo.kt"]),
                         ["java-kotlin", "swift"])

    def test_xiaomi_runs_kotlin_only(self):
        self.assertEqual(names(["xiaomi-adb-tools/src/main/kotlin/Foo.kt"]), ["java-kotlin"])

    def test_other_sources(self):
        self.assertEqual(names(["addons/test/a.cpp", "benches/docbench/app.tsx", "misc/x.cs"]),
                         ["c-cpp", "csharp", "javascript-typescript"])

    def test_composite_actions(self):
        self.assertEqual(names([".github/actions/smx-python/action.yml"]), ["actions"])

    def test_html_inline_scripts(self):
        self.assertEqual(names(["benches/codebench/public/index.html"]),
                         ["javascript-typescript"])

    def test_actions_workflow(self):
        self.assertEqual(names([".github/workflows/codeql.yml"]), ["actions"])

    def test_selector_script(self):
        self.assertEqual(names([".github/scripts/codeql_matrix.py"]), ["python"])

    def test_docs_only_skips_analysis(self):
        self.assertEqual(names(["README.md", "plugins/spacemolt/README.md"]), [])

    def test_keyboard_readme_does_not_build(self):
        self.assertEqual(names(["intent-keyboard/README.md"]), [])

    def test_deletion_passes_through_planner(self):
        from unittest.mock import patch
        with patch.object(codeql_matrix.subprocess, "run") as run:
            run.return_value.stdout = "xiaomi-adb-tools/src/main/kotlin/Old.kt\\n"
            selected = codeql_matrix.plan("pull_request", "abc123")
            self.assertEqual([row["language"] for row in selected], ["java-kotlin"])
            args = run.call_args.args[0]
            self.assertIn("--no-renames", args)
            self.assertFalse(any(arg.startswith("--diff-filter") for arg in args))

    def test_stale_event_base_does_not_scan_unrelated_main_changes(self):
        from unittest.mock import patch
        with patch.object(codeql_matrix.subprocess, "run") as run:
            run.return_value.stdout = "spacemolt/smx/src/smx/contract.py\\n"
            selected = codeql_matrix.plan("pull_request", "stale-base-sha")
            self.assertEqual([row["language"] for row in selected], ["python"])
            self.assertEqual(run.call_args.args[0][-2:], ["HEAD^1", "HEAD"])

    def test_full_scans_outside_pull_requests(self):
        for event in ("push", "schedule", "workflow_dispatch"):
            self.assertEqual(len(codeql_matrix.plan(event, "")), 7)


if __name__ == "__main__":
    unittest.main()
