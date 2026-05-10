"""On-site chat assistant smoke test.

Required by the hackathon submission spec: "On-site assistant test script
covering consultation, custom order, complaint, status, and escalation
paths." Hits POST /api/chat with five scenarios and asserts the right
escalation marker (or absence) plus a non-empty reply.

Run against a live wrapper (uvicorn must be up):

    .venv/bin/python scripts/test_chat.py
    .venv/bin/python scripts/test_chat.py --base-url http://localhost:8080

Exit code is non-zero if any scenario fails.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.error
import urllib.request


SCENARIOS = [
    {
        "name": "consultation",
        "message": (
            "Hi! I'm hosting 8 people for a small dinner — what would you "
            "recommend that's ready today?"
        ),
        "expect_escalation": None,  # None means no escalation expected
        "expect_reply_contains_any": ["honey", "pistachio", "$"],
    },
    {
        "name": "custom_order",
        "message": (
            "I'd like a custom birthday cake for my daughter on Saturday — "
            "pink frosting, name on top. Can you set that up?"
        ),
        "expect_escalation": "custom_order",
        # No reply-text check: the escalation marker is the meaningful signal.
        # Reply tone varies turn-to-turn ("happy to help" vs "passing to the
        # team") and over-checking strings makes the test brittle.
        "expect_reply_contains_any": [],
    },
    {
        "name": "complaint",
        "message": (
            "I picked up a honey cake yesterday and it was dry. Pretty "
            "disappointed."
        ),
        "expect_escalation": "complaint",
        "expect_reply_contains_any": ["sorry", "apologi", "make this right", "team"],
    },
    {
        "name": "status",
        "message": (
            "Hey, is order sq_order_1778378933107 ready for pickup yet?"
        ),
        "expect_escalation": None,
        "expect_reply_contains_any": ["order", "honey", "ready", "queue", "sq_order"],
    },
    {
        "name": "general_question",
        # Cleanly answerable from square_list_catalog → no fabrication risk,
        # no escalation expected. (Allergen-style questions probe a real
        # gap — MCP catalog doesn't carry allergen fields — and the agent
        # correctly refuses to fabricate; that's a different test.)
        "message": "What whole cakes do you have on the menu, and what do they cost?",
        "expect_escalation": None,
        "expect_reply_contains_any": ["honey", "$", "55"],
    },
]


def post_chat(base_url: str, message: str, timeout: int = 180) -> dict:
    body = json.dumps({"message": message, "history": []}).encode("utf-8")
    req = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/chat",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)


def evaluate(scenario: dict, response: dict) -> tuple[bool, list[str]]:
    failures: list[str] = []

    if not response.get("ok"):
        failures.append(f"response.ok is false: {response}")
        return False, failures

    reply = (response.get("reply") or "").strip()
    if not reply:
        failures.append("reply is empty")

    expected = scenario["expect_escalation"]
    actual = response.get("escalation_type")
    if expected is None:
        if response.get("escalated") or actual:
            failures.append(
                f"unexpected escalation: expected none, got escalation_type={actual!r}"
            )
    else:
        if not response.get("escalated"):
            failures.append(f"missing escalation: expected {expected!r}, escalated=False")
        if actual != expected:
            failures.append(f"wrong escalation_type: expected {expected!r}, got {actual!r}")

    needles = [n.lower() for n in scenario["expect_reply_contains_any"]]
    if needles and not any(n in reply.lower() for n in needles):
        failures.append(
            f"reply doesn't mention any of {scenario['expect_reply_contains_any']!r}; "
            f"reply={reply[:200]!r}"
        )

    return (not failures), failures


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base-url", default="http://localhost:8080")
    parser.add_argument("--timeout", type=int, default=180)
    parser.add_argument(
        "--only",
        help="Comma-separated scenario names to run (default: all). "
             "Names: " + ", ".join(s["name"] for s in SCENARIOS),
    )
    args = parser.parse_args()

    selected = SCENARIOS
    if args.only:
        wanted = {n.strip() for n in args.only.split(",") if n.strip()}
        selected = [s for s in SCENARIOS if s["name"] in wanted]
        if not selected:
            print(f"no scenarios match --only={args.only!r}", file=sys.stderr)
            return 2

    overall_pass = True
    print(f"running {len(selected)} scenario(s) against {args.base_url}\n")

    for s in selected:
        print(f"── {s['name']:<18} → POST /api/chat")
        print(f"   asked:   {s['message']!r}")
        t0 = time.time()
        try:
            resp = post_chat(args.base_url, s["message"], timeout=args.timeout)
        except urllib.error.HTTPError as exc:
            print(f"   ✗ FAIL  HTTP {exc.code}: {exc.read().decode('utf-8', 'replace')[:300]}")
            overall_pass = False
            continue
        except Exception as exc:
            print(f"   ✗ FAIL  request crashed: {exc!r}")
            overall_pass = False
            continue

        dt = time.time() - t0
        ok, failures = evaluate(s, resp)
        reply = (resp.get("reply") or "").replace("\n", " ")[:160]
        meta = (
            f"escalated={resp.get('escalated')} type={resp.get('escalation_type')!r} "
            f"turns={resp.get('num_turns')} dur={dt:.1f}s"
        )
        if ok:
            print(f"   ✓ PASS  {meta}")
            print(f"   reply:  {reply}")
        else:
            overall_pass = False
            print(f"   ✗ FAIL  {meta}")
            print(f"   reply:  {reply}")
            for f in failures:
                print(f"            · {f}")
        print()

    print("=" * 60)
    if overall_pass:
        print(f"ALL {len(selected)} SCENARIO(S) PASSED")
        return 0
    else:
        print("ONE OR MORE SCENARIOS FAILED")
        return 1


if __name__ == "__main__":
    sys.exit(main())
