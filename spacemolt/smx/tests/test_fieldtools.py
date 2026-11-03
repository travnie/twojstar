import contextlib
import io
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from smx import cli
from smx.cli import BackendResult, main, watch_command_is_read_only
from smx.fieldtools import (MAX_MARKETS, cmd_dry_run, cmd_ids, cmd_inbox, cmd_where_can_i, id_suggestions,
                            learn, load_cache, save_cache)

SYSTEM = {"structuredContent": {"system": {"id": "sol", "name": "Sol", "pois": [
    {"id": "sol_belt", "name": "Main Belt"},
    {"id": "sol_poi", "name": "Central", "base_id": "sol_base", "base_name": "Central Station"},
]}}}
CARGO = {"structuredContent": {"cargo": [{"item_id": "ore_iron", "item_name": "Iron Ore", "quantity": 3}]}}
NEARBY = {"structuredContent": {"nearby": [{"player_id": "p1", "username": "Ace"}]}}
MARKET = {"structuredContent": {"base": "Central Station", "base_id": "sol_base", "items": [
    {"item_id": "ore_iron", "item_name": "Iron Ore", "best_buy": 4, "best_sell": 6},
]}}


class Backend:
    profile = None

    def __init__(self, replies=None):
        self.replies = replies or {}
        self.calls = []

    def json(self, args, *, timeout=None):
        self.calls.append(args)
        reply = self.replies.get(tuple(args))
        if reply is None:
            return BackendResult(1, "", "not docked\n"), None
        return BackendResult(0, "", ""), reply

    def run(self, args, *, json_output=False, timeout=None):
        raise AssertionError(f"must not send {args}")


def capture(function, *args):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = function(*args)
    return code, out.getvalue(), err.getvalue()


class StateTestCase(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        env = {k: v for k, v in os.environ.items() if k not in {"SMX_PROFILE", "SMX_BACKEND", "SPACEMOLT_SESSION"}}
        patcher = patch.dict(os.environ, {**env, "SMX_STATE_DIR": directory.name}, clear=True)
        patcher.start()
        self.addCleanup(patcher.stop)

    @staticmethod
    def refreshed():
        return Backend({
            ("get_system",): SYSTEM, ("get_cargo",): CARGO, ("get_nearby",): NEARBY,
            ("spacemolt_market/view_market",): MARKET,
        })


class IdsTests(StateTestCase):
    def test_refresh_records_official_ids_and_survives_reload(self):
        code, out, _ = capture(cmd_ids, self.refreshed(), ["--refresh", "--json"])
        rows = {(row["kind"], row["id"]): row["name"] for row in json.loads(out)}
        self.assertEqual(code, 0)
        self.assertEqual(rows[("poi", "sol_belt")], "Main Belt")
        self.assertEqual(rows[("base", "sol_base")], "Central Station")
        self.assertEqual(rows[("item", "ore_iron")], "Iron Ore")
        self.assertEqual(rows[("player", "p1")], "Ace")
        _, out, _ = capture(cmd_ids, Backend(), ["poi", "--search", "belt"])
        self.assertIn("sol_belt", out)
        self.assertNotIn("sol_poi", out)

    def test_refresh_tolerates_undocked_market(self):
        backend = Backend({("get_system",): SYSTEM})
        code, _, _ = capture(cmd_ids, backend, ["--refresh"])
        self.assertEqual(code, 0)
        self.assertEqual(load_cache()["markets"], {})

    def test_refresh_fails_when_nothing_answers(self):
        code, _, err = capture(cmd_ids, Backend(), ["--refresh"])
        self.assertEqual(code, 1)
        self.assertIn("cache unchanged", err)

    def test_profiles_do_not_share_a_cache(self):
        backend = self.refreshed()
        backend.profile = "gremlin"
        capture(cmd_ids, backend, ["--refresh"])
        self.assertTrue(load_cache("gremlin")["ids"])
        self.assertEqual(load_cache("claude")["ids"], {})

    def test_corrupt_cache_reads_as_empty(self):
        save_cache({"ids": {}, "markets": {}})
        with open(os.path.join(os.environ["SMX_STATE_DIR"], "ids.json"), "w", encoding="utf-8") as handle:
            handle.write("{broken")
        self.assertEqual(load_cache(), {"ids": {}, "markets": {}})

    def test_old_markets_are_dropped(self):
        cache = load_cache()
        cache["markets"] = {f"b{i}": {"seen": i, "items": {}} for i in range(MAX_MARKETS + 5)}
        backend = self.refreshed()
        from smx.fieldtools import refresh
        refresh(backend, cache, 10_000)
        self.assertEqual(len(cache["markets"]), MAX_MARKETS)
        self.assertIn("sol_base", cache["markets"])

    def test_suggestions_are_hints_for_unknown_values_only(self):
        capture(cmd_ids, self.refreshed(), ["--refresh"])
        self.assertIn("sol_belt", id_suggestions(None, ["id=sol_blet"])[0])
        self.assertIn("sol_belt", id_suggestions(None, ["Main Belt"])[0])
        self.assertEqual(id_suggestions(None, ["id=sol_belt", "quantity=5", "--json"]), [])

    def test_failed_passthrough_prints_hint_and_runs_nothing_else(self):
        capture(cmd_ids, self.refreshed(), ["--refresh"])
        calls = []

        class Failing:
            profile = None

            @staticmethod
            def run(args, *, json_output=False, timeout=None):
                calls.append(args)
                return BackendResult(1, "", "invalid_target\n")

        code, _, err = capture(cli._passthrough, Failing(), ["travel", "id=sol_blet"])
        self.assertEqual(code, 1)
        self.assertEqual(calls, [["travel", "id=sol_blet"]])
        self.assertIn("not executed", err)


class WhereCanITests(StateTestCase):
    def test_finds_by_id_or_name_with_age(self):
        capture(cmd_ids, self.refreshed(), ["--refresh"])
        for query in (["ore_iron"], ["iron", "ore"]):
            code, out, _ = capture(cmd_where_can_i, Backend(), query)
            self.assertEqual(code, 0)
            self.assertIn("Central Station [sol_base]", out)
            self.assertIn("best_sell=6", out)
            self.assertIn("stale", out)

    def test_unknown_item_explains_local_scope(self):
        _, out, _ = capture(cmd_where_can_i, Backend(), ["unobtanium"])
        self.assertIn("cached market", out)

    def test_recorded_market_needs_only_the_market_reply(self):
        cache = load_cache()
        learn(cache, "spacemolt_market/view_market", MARKET, 1)
        self.assertEqual(cache["markets"]["sol_base"]["items"]["ore_iron"], {"best_buy": 4, "best_sell": 6})


class InboxTests(unittest.TestCase):
    PAYLOAD = {"structuredContent": {"remaining": 2, "notifications": [
        {"type": "chat", "data": {"content": "hello"}},
        {"type": "crafting", "data": {"message": "run 1 of 9"}},
        {"type": "crafting", "data": {"message": "job failed: no input"}},
        {"type": "system", "data": {"message": "tick"}},
    ]}}

    def test_collapses_routine_and_keeps_signal(self):
        backend = Backend({("get_notifications",): self.PAYLOAD})
        code, out, _ = capture(cmd_inbox, backend, [])
        self.assertEqual(code, 0)
        self.assertIn("[chat] hello", out)
        self.assertIn("job failed", out)
        self.assertNotIn("run 1 of 9", out)
        self.assertIn("collapsed: 1 crafting, 1 system", out)
        self.assertIn("2 more queued", out)

    def test_all_prints_everything(self):
        _, out, _ = capture(cmd_inbox, Backend({("get_notifications",): self.PAYLOAD}), ["--all"])
        self.assertIn("run 1 of 9", out)
        self.assertNotIn("collapsed", out)

    def test_peek_keeps_queue(self):
        backend = Backend({("get_notifications", "clear=false", "limit=5"): self.PAYLOAD})
        capture(cmd_inbox, backend, ["--peek", "--limit", "5"])
        self.assertEqual(backend.calls, [["get_notifications", "clear=false", "limit=5"]])

    def test_throttled_is_reported(self):
        payload = {"structuredContent": {"throttled": True, "retry_after": 7}}
        _, out, _ = capture(cmd_inbox, Backend({("get_notifications",): payload}), [])
        self.assertIn("retry after 7s", out)

    def test_failure_propagates(self):
        code, _, err = capture(cmd_inbox, Backend(), [])
        self.assertEqual(code, 1)
        self.assertIn("not docked", err)


class DryRunTests(unittest.TestCase):
    @staticmethod
    def read_only(command, args):
        return watch_command_is_read_only(command, args)

    def test_mutation_is_never_sent(self):
        code, out, _ = capture(cmd_dry_run, Backend(), "self_destruct", [], self.read_only)
        self.assertEqual(code, 0)
        self.assertIn("nothing sent", out)
        self.assertIn("may change game state", out)
        self.assertIn("Destroys the active ship", out)

    def test_read_only_is_labelled(self):
        _, out, _ = capture(cmd_dry_run, Backend(), "get_status", [], self.read_only)
        self.assertIn("read-only query", out)

    def test_buy_uses_read_only_estimate(self):
        reply = {"structuredContent": {"available": 40, "total_cost": 120, "unfilled": 10}}
        for args in (["ore_iron", "50"], ["id=ore_iron", "quantity=50"]):
            backend = Backend({("spacemolt_market/estimate_purchase", "item_id=ore_iron", "quantity=50"): reply})
            code, out, _ = capture(cmd_dry_run, backend, "buy", [*args, "--json"], self.read_only)
            self.assertEqual(code, 0)
            self.assertEqual(json.loads(out)["estimate"], {"available": 40, "total_cost": 120, "unfilled": 10})

    def test_estimate_failure_keeps_preview(self):
        code, out, _ = capture(cmd_dry_run, Backend(), "buy", ["ore_iron", "50"], self.read_only)
        self.assertEqual(code, 0)
        self.assertNotIn("estimate:", out)


class DryRunRoutingTests(StateTestCase):
    def assert_not_sent(self, argv):
        with patch("smx.cli.subprocess.run", side_effect=AssertionError("sent")):
            code, out, _ = capture(main, argv)
        self.assertEqual(code, 0)
        self.assertIn("nothing sent", out)

    def test_flag_blocks_sending_before_or_after_command(self):
        self.assert_not_sent(["--dry-run", "sell", "ore_iron", "5"])
        self.assert_not_sent(["sell", "ore_iron", "5", "--dry-run"])
        self.assert_not_sent(["-p", "gremlin", "self-destruct", "--dry-run"])

    def test_flag_after_separator_is_a_literal_argument(self):
        with patch("smx.cli.Backend.run", return_value=BackendResult(0, "ok\n", "")) as run:
            code, _, _ = capture(main, ["chat", "--", "--dry-run"])
        self.assertEqual(code, 0)
        run.assert_called_once_with(["chat", "--", "--dry-run"])

    def test_local_command_keeps_its_own_preview(self):
        with patch("smx.cli.cmd_sell_all", return_value=0) as sell_all:
            self.assertEqual(capture(main, ["--dry-run", "sell-all"])[0], 0)
        self.assertEqual(sell_all.call_args.args[1], ["--dry-run"])

    def test_flag_alone_is_an_error(self):
        self.assertEqual(capture(main, ["--dry-run"])[0], 2)


if __name__ == "__main__":
    unittest.main()
