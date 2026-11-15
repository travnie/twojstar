"""MCP probe target and redirect regressions; no real network."""
import importlib.util
import unittest
from pathlib import Path
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parents[1] / "skills/mcp-dev/scripts/mcp_probe.py"
SPEC = importlib.util.spec_from_file_location("mcp_probe", SCRIPT)
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)


class ProbeTargetTests(unittest.TestCase):
    @staticmethod
    def addresses(*ips):
        return [(0, 0, 0, "", (ip, 80)) for ip in ips]

    def test_public_and_private_addresses(self):
        for ip, allowed in [("8.8.8.8", True), ("127.0.0.1", False),
                            ("192.168.1.1", False), ("100.64.0.1", False)]:
            with patch.object(probe.socket, "getaddrinfo", return_value=self.addresses(ip)):
                if allowed:
                    probe.validate_target_url("https://example.test/mcp")
                else:
                    with self.assertRaises(SystemExit):
                        probe.validate_target_url("https://example.test/mcp")

    def test_explicit_loopback(self):
        with patch.object(probe.socket, "getaddrinfo", return_value=self.addresses("127.0.0.1", "::1")):
            probe.validate_target_url("http://localhost:8787/mcp", allow_loopback=True)
            with self.assertRaises(SystemExit):
                probe.validate_target_url("http://example.test/mcp", allow_loopback=True)
            with self.assertRaises(SystemExit):
                probe.validate_target_url("http://localhost:8787/mcp")
        with patch.object(probe.socket, "getaddrinfo", return_value=self.addresses("127.0.0.1", "8.8.8.8")):
            with self.assertRaises(SystemExit):
                probe.validate_target_url("http://localhost:8787/mcp", allow_loopback=True)

    def test_redirect_refused(self):
        with patch.object(probe.socket, "getaddrinfo", return_value=self.addresses("8.8.8.8")):
            opener = probe.Probe("https://example.test/mcp", {}).opener
        handler = next(h for h in opener.handlers if isinstance(h, probe.NoRedirect))
        self.assertIsNone(handler.redirect_request(None, None, 302, "", {}, "http://localhost/"))


if __name__ == "__main__":
    unittest.main()
