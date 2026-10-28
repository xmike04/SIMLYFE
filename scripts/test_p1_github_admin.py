"""Exercise the real shell script with a stateful GitHub CLI double and real jq."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("p1-github-admin.sh")
MOCK = r'''#!/usr/bin/env python3
import json, os, pathlib, subprocess, sys
p = pathlib.Path(os.environ["P1_MOCK_STATE"])
s = json.loads(p.read_text())
a = sys.argv[1:]
if a[:2] == ["auth", "status"]:
    sys.exit(0)
if a[:2] == ["auth", "login"]:
    raise SystemExit("Unexpected login")
assert a.pop(0) == "api"
opts = {}; positional = []
while a:
    k = a.pop(0)
    if k in ("--hostname", "-H", "--method", "--input", "--jq", "-f"):
        v = a.pop(0)
        if k == "-f": opts.setdefault(k, []).append(v)
        else: opts[k] = v
    elif k in ("--paginate", "--silent"):
        opts[k] = True
    else: positional.append(k)
assert opts["--hostname"] == "github.com"
assert len(positional) == 1, positional
path = positional[0]; method = opts.get("--method", "GET")
if method != "GET":
    s["writes"].append({"method": method, "path": path})
if path == "user": data = {"login": s.get("login", "xmike04")}
else:
    parts = path.split("/"); assert parts[:2] == ["repos", "xmike04"]
    repo = parts[2]; tail = "/".join(parts[3:]).split("?")[0]
    if not tail:
        if method == "PATCH": s["description"] = opts["-f"][0].split("=",1)[1]
        data = {"permissions":{"admin": s.get("admin", True)}, "default_branch":"main", "archived":False, "description":s["description"]}
    elif tail == "branches/main": data = {"commit":{"sha":"a"*40}}
    elif tail.endswith("check-runs"):
        names = (["Lint, unit tests, build, docs", "Desktop and mobile browser smoke"] if repo == "SIMLYFE" else ["Backend quality", "Frontend quality", "Retrieval benchmark integrity", "Container configuration"])
        data = {"check_runs":[{"name":n,"app":{"id":15368,"slug":"github-actions"},"status":"completed","conclusion":"failure" if s.get("bad_ci") and repo == "RAG_OPS" else "success"} for n in names]}
    elif tail == "rulesets":
        if method == "POST":
            value = json.loads(pathlib.Path(opts["--input"]).read_text())
            value.update(id=100 + len(s["rules"]), source="xmike04/"+repo)
            s["rules"][repo] = value
            data = {"id": value["id"]}
        else: data = [s["rules"][repo]] if repo in s["rules"] else []
    elif tail.startswith("rulesets/"):
        data = s["rules"][repo].copy()
        if s.get("bad_readback") and method == "GET": data["bypass_actors"] = [{"actor_type":"RepositoryRole","actor_id":5}]
    elif tail.endswith("/alerts"):
        if s.get("unavailable_alerts"):
            p.write_text(json.dumps(s)); print("Unavailable", file=sys.stderr); sys.exit(1)
        data = []
        if tail == "secret-scanning/alerts": data = [{"number":1,"state":"open","secret_type_display_name":"Example","html_url":"https://github.com/example","secret":"DO_NOT_PRINT_SECRET_SENTINEL"}]
    else: raise SystemExit("Unhandled route: " + path)
p.write_text(json.dumps(s))
if "--silent" not in opts:
    if "--jq" in opts:
        # Pretty output matches valid gh JSON output and catches unsafe sed replacement.
        result = subprocess.run(["jq", "-r", opts["--jq"]], input=json.dumps(data), text=True, capture_output=True)
        sys.stdout.write(result.stdout); sys.stderr.write(result.stderr); sys.exit(result.returncode)
    print(json.dumps(data))
'''
OLD = "AI-assisted life simulator with deterministic game logic, authenticated OpenAI events, Firebase cloud saves, and 350+ Vitest assertions."

class AdminScriptTests(unittest.TestCase):
    def run_script(self, mode="--apply", **extra):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        root = Path(directory.name)
        (root / "gh").write_text(MOCK)
        (root / "gh").chmod(0o755)
        state = root / "state.json"
        state.write_text(json.dumps({"description": OLD, "writes": [], "rules": {}, **extra}))
        result = subprocess.run(["bash", str(SCRIPT), mode], cwd=root, env={**os.environ, "PATH":str(root)+os.pathsep+os.environ["PATH"], "P1_MOCK_STATE":str(state)}, text=True, capture_output=True)
        reports = list(root.glob("p1-github-report.*"))
        return result, json.loads(state.read_text()), reports[0].read_text() if reports else ""

    def test_apply_exact_policy_and_safe_report(self):
        result, state, report = self.run_script()
        self.assertEqual(result.returncode, 0, result.stderr + result.stdout)
        self.assertEqual(len(state["writes"]), 3)
        self.assertNotIn("DO_NOT_PRINT_SECRET_SENTINEL", result.stdout + report)
        for repo, rule in state["rules"].items():
            self.assertEqual(rule["enforcement"], "active")
            self.assertEqual(rule["bypass_actors"], [])
            self.assertEqual(rule["conditions"]["ref_name"], {"include":["refs/heads/main"], "exclude":[]})
            self.assertEqual({r["type"] for r in rule["rules"]}, {"deletion","non_fast_forward","pull_request","required_status_checks"})
            checks = next(r["parameters"] for r in rule["rules"] if r["type"] == "required_status_checks")
            self.assertTrue(checks["strict_required_status_checks_policy"])
            self.assertTrue(all(c["integration_id"] == 15368 for c in checks["required_status_checks"]))
            self.assertEqual(len(checks["required_status_checks"]), 2 if repo == "SIMLYFE" else 4)
            self.assertNotIn("deploy", [c["context"] for c in checks["required_status_checks"]])
        self.assertNotIn("350+", state["description"])

    def test_check_does_not_write(self):
        result, state, _ = self.run_script("--check")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(state["writes"], [])

    def test_matching_rulesets_and_about_are_idempotent(self):
        first, applied, _ = self.run_script()
        self.assertEqual(first.returncode, 0, first.stderr)
        result, state, _ = self.run_script(rules=applied["rules"], description=applied["description"])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(state["writes"], [])

    def test_conflicting_existing_rule_is_never_overwritten(self):
        first, applied, _ = self.run_script()
        self.assertEqual(first.returncode, 0, first.stderr)
        applied["rules"]["SIMLYFE"]["enforcement"] = "disabled"
        result, state, _ = self.run_script(rules=applied["rules"])
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(state["writes"], [])
        self.assertEqual(state["rules"]["SIMLYFE"]["enforcement"], "disabled")

    def test_wrong_account_stops_without_writes(self):
        result, state, _ = self.run_script(login="someone-else")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(state["writes"], [])

    def test_failed_ci_or_missing_admin_stops_before_any_write(self):
        for settings in ({"bad_ci":True}, {"admin":False}):
            result, state, _ = self.run_script(**settings)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(state["writes"], [])

    def test_changed_about_stops_before_any_write(self):
        result, state, _ = self.run_script(description="Owner changed this")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(state["writes"], [])

    def test_bad_readback_stops_remaining_writes(self):
        result, state, _ = self.run_script(bad_readback=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(state["writes"]), 1)
        self.assertEqual(state["description"], OLD)

    def test_unavailable_alerts_are_unknown_not_zero(self):
        result, state, report = self.run_script(unavailable_alerts=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(report.count("UNAVAILABLE (not zero"), 12)

if __name__ == "__main__": unittest.main()
