import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from smx.contract import CONTRACT, find_drift, main


def schema_for(fields):
    """Nest dotted/[] field names back into a JSON schema."""
    root = {"type": "object", "properties": {}}
    for field in fields:
        node = root
        for part in field.split("."):
            is_array = part.endswith("[]")
            name = part.removesuffix("[]")
            child = node.setdefault("properties", {}).setdefault(name, {"type": "object"})
            if is_array:
                child = child.setdefault("items", {"type": "object"})
            node = child
    return root


def full_spec():
    paths = {}
    schemas = {}
    for command, needs in CONTRACT.items():
        name = command.replace("/", "_")
        schemas[name] = {
            "allOf": [{"type": "object", "properties": {"structuredContent": schema_for(needs.get("response", ()))}}]
        }
        paths[f"/api/v2/{command}"] = {"post": {
            "requestBody": {"content": {"application/json": {"schema": schema_for(needs.get("request", ()))}}},
            "responses": {"200": {"content": {"application/json": {"schema": {"$ref": f"#/components/schemas/{name}"}}}}},
        }}
    return {"paths": paths, "components": {"schemas": schemas}}


class ContractTests(unittest.TestCase):
    def test_complete_spec_is_clean(self):
        self.assertEqual(find_drift(full_spec()), [])

    def test_reports_removed_endpoint(self):
        spec = full_spec()
        del spec["paths"]["/api/v2/spacemolt/sell"]
        self.assertEqual(find_drift(spec), ["spacemolt/sell: endpoint removed"])

    def test_reports_removed_response_field(self):
        spec = full_spec()
        queue = spec["components"]["schemas"]["spacemolt_get_status"]["allOf"][0]["properties"]["structuredContent"]["properties"]["queue"]
        del queue["properties"]["has_pending"]
        self.assertEqual(find_drift(spec), ["spacemolt/get_status: response field `queue.has_pending` removed"])

    def test_reports_removed_request_field(self):
        spec = full_spec()
        body = spec["paths"]["/api/v2/spacemolt/travel"]["post"]["requestBody"]
        del body["content"]["application/json"]["schema"]["properties"]["id"]
        self.assertEqual(find_drift(spec), ["spacemolt/travel: request field `id` removed"])

    def test_field_outside_structured_content_does_not_count(self):
        spec = full_spec()
        envelope = spec["components"]["schemas"]["spacemolt_sell"]["allOf"][0]["properties"]
        envelope["details"] = envelope["structuredContent"].pop("properties")["details"]
        self.assertIn("spacemolt/sell: response field `details.quantity_sold` removed", find_drift(spec))

    def test_recursive_schema_terminates(self):
        spec = full_spec()
        node = {"type": "object", "properties": {"self": {"$ref": "#/components/schemas/loop"}}}
        spec["components"]["schemas"]["loop"] = node
        spec["components"]["schemas"]["spacemolt_dock"] = {"$ref": "#/components/schemas/loop"}
        self.assertEqual(find_drift(spec), [])

    @staticmethod
    def _main(*args):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            return main(list(args)), out.getvalue(), err.getvalue()

    def test_exit_codes_separate_drift_from_outage(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "spec.json"
            path.write_text(json.dumps(full_spec()))
            self.assertEqual(self._main("--spec", str(path))[0], 0)
            path.write_text(json.dumps({"paths": {}}))
            rc, out, _ = self._main("--spec", str(path))
            self.assertEqual(rc, 1)
            self.assertIn("endpoint removed", out)
        with patch("smx.contract.fetch_spec", side_effect=OSError("down")):
            rc, _, err = self._main()
        self.assertEqual(rc, 2)
        self.assertIn("down", err)

    def test_malformed_spec_is_unavailable_not_drift(self):
        for body in ({"openapi": "3.1.0"}, []):
            with patch("smx.contract.fetch_spec", return_value=body):
                self.assertEqual(self._main()[0], 2)
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "spec.json"
            path.write_text("[]")
            self.assertEqual(self._main("--spec", str(path))[0], 2)


if __name__ == "__main__":
    unittest.main()
