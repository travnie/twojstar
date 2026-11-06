#!/usr/bin/env python3
"""Probe a remote MCP server (streamable HTTP), stdlib only.

  python3 mcp_probe.py URL                      # identify, list tools, lint annotations
  python3 mcp_probe.py URL --call NAME '{...}'  # call one tool
  python3 mcp_probe.py URL --header 'Authorization: Bearer X'

Tries the 2026-07-28 stateless era first (server/discover), falls back to the
initialize handshake (2025-xx). Lint covers the Claude directory rules that can
be checked mechanically: title, readOnlyHint/destructiveHint, name length,
instruction-like descriptions.
"""

import json
import re
import sys
import urllib.request
import urllib.error

CLIENT = {"name": "mcp-probe", "version": "1.0"}
OLD = "2025-06-18"
INSTRUCTY = re.compile(
    r"\b(always|never|you must|ignore (previous|other)|before (calling|using) any|do not use other)\b",
    re.I,
)


class Probe:
    def __init__(self, url, headers):
        self.url, self.extra, self.session, self.version, self.stateless, self.n = (
            url,
            headers,
            None,
            OLD,
            False,
            0,
        )

    def rpc(self, method, params=None, notify=False):
        self.n += 1
        body = {"jsonrpc": "2.0", "method": method}
        if not notify:
            body["id"] = self.n
        params = dict(params or {})
        if self.stateless:
            meta = params.setdefault("_meta", {})
            meta.update(
                {
                    "io.modelcontextprotocol/protocolVersion": self.version,
                    "io.modelcontextprotocol/clientCapabilities": {},
                    "io.modelcontextprotocol/clientInfo": CLIENT,
                }
            )
        if params:
            body["params"] = params
        h = {
            "user-agent": "mcp-probe/1.0",
            "content-type": "application/json",
            "accept": "application/json, text/event-stream",
            "mcp-protocol-version": self.version,
            "mcp-method": method,
            **self.extra,
        }
        if "name" in params:
            h["mcp-name"] = str(params["name"])
        if self.session:
            h["mcp-session-id"] = self.session
        req = urllib.request.Request(
            self.url, json.dumps(body).encode(), h, method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                self.session = r.headers.get("mcp-session-id") or self.session
                raw = r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return {
                "error": {
                    "code": e.code,
                    "message": e.read().decode("utf-8", "replace")[:300],
                }
            }
        if notify or not raw.strip():
            return {}
        msgs = [
            json.loads(line[5:])
            for line in raw.splitlines()
            if line.startswith("data:") and line[5:].strip()
        ] or [json.loads(raw)]
        return next((m for m in msgs if m.get("id") == body.get("id")), msgs[-1])

    def connect(self):
        self.stateless, self.version = True, "2026-07-28"
        r = self.rpc("server/discover")
        res = r.get("result") or {}
        vers = res.get("supportedVersions") or res.get("protocolVersions") or []
        if "result" in r and (not vers or "2026-07-28" in vers):
            return "2026-07-28 (stateless)", res
        self.stateless, self.version = False, OLD
        r = self.rpc(
            "initialize",
            {"protocolVersion": OLD, "capabilities": {}, "clientInfo": CLIENT},
        )
        if "error" in r:
            sys.exit(f"initialize failed: {r['error']}")
        res = r["result"]
        self.version = res.get("protocolVersion", OLD)
        self.rpc("notifications/initialized", notify=True)
        return f"{self.version} (initialize)", res


def lint(tools):
    issues = []
    names = [t["name"] for t in tools]
    for t in tools:
        a, n = t.get("annotations") or {}, t["name"]
        if len(n) > 64:
            issues.append(f"{n}: name > 64 chars")
        if not (a.get("title") or t.get("title")):
            issues.append(f"{n}: no title")
        if "readOnlyHint" not in a and "destructiveHint" not in a:
            issues.append(f"{n}: no readOnlyHint/destructiveHint")
        d = t.get("description") or ""
        if not d:
            issues.append(f"{n}: empty description")
        elif INSTRUCTY.search(d):
            issues.append(
                f"{n}: description may read as an instruction — check wording ('{INSTRUCTY.search(d).group(0)}')"
            )
        props = (t.get("inputSchema") or {}).get("properties") or {}
        undocumented = [
            p
            for p, s in props.items()
            if not (isinstance(s, dict) and s.get("description"))
        ]
        if undocumented:
            issues.append(f"{n}: params without description: {', '.join(undocumented)}")
        if re.search(r"\bmethod\b", json.dumps(props)) and re.search(
            r"(GET|POST|DELETE)", json.dumps(props)
        ):
            issues.append(f"{n}: looks like a catch-all HTTP tool (split read/write)")
    if len(names) > 30:
        issues.append(f"{len(names)} tools: consider search+execute")
    return issues


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith("-"):
        sys.exit(__doc__)
    url, headers, call = a[0], {}, None
    i = 1
    while i < len(a):
        if a[i] == "--header":
            k, _, v = a[i + 1].partition(":")
            headers[k.strip()] = v.strip()
            i += 2
        elif a[i] == "--call":
            call = (a[i + 1], json.loads(a[i + 2]) if i + 2 < len(a) else {})
            i += 3
        else:
            i += 1
    p = Probe(url, headers)
    era, info = p.connect()
    si = (
        info.get("serverInfo")
        or (info.get("_meta") or {}).get("io.modelcontextprotocol/serverInfo")
        or {}
    )
    print(f"server: {si.get('name', '?')} {si.get('version', '')} | protocol {era}")
    if info.get("instructions"):
        print(f"instructions: {info['instructions'][:200]}")
    if call:
        r = p.rpc("tools/call", {"name": call[0], "arguments": call[1]})
        res = r.get("result") or r
        for c in res.get("content", []) if isinstance(res, dict) else []:
            print(c.get("text", json.dumps(c))[:4000])
        if isinstance(res, dict) and res.get("isError"):
            print("isError: true")
            sys.exit(1)
        if "error" in r:
            print(r["error"])
            sys.exit(1)
        return
    r = p.rpc("tools/list")
    tools = (r.get("result") or {}).get("tools", [])
    if "error" in r:
        sys.exit(f"tools/list failed: {r['error']}")
    for t in tools:
        an = t.get("annotations") or {}
        flags = "".join(
            f
            for f, k in (
                ("R", "readOnlyHint"),
                ("D", "destructiveHint"),
                ("I", "idempotentHint"),
            )
            if an.get(k)
        )
        ui = (
            " ui" if ((t.get("_meta") or {}).get("ui") or {}).get("resourceUri") else ""
        )
        print(
            f"  {t['name']:<40} [{flags or '-'}]{ui}  {(t.get('description') or '').splitlines()[0][:70] if t.get('description') else ''}"
        )
    issues = lint(tools)
    print(f"{len(tools)} tools, {len(issues)} lint issue(s)")
    for x in issues:
        print("  LINT", x)


if __name__ == "__main__":
    main()
