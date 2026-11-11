#!/usr/bin/env python3
"""Runtime integration test for the Jogos SDK.

It injects tools/jogos_observer.js BEFORE any page script and then checks the
three things that most often break a submission:

  1. JOGOS_SDK.init succeeds, and no localStorage / IndexedDB save access happens
     before that init resolves.
  2. Optional but recommended: game.loadingStart() right after init and
     game.loadingEnd() once the game is really playable.
  3. Losing browser focus calls game.pause() and the game really stops; regaining
     focus calls game.continuePlay().

Usage:
    python tools/jogos_test.py examples/h5-canvas
    python tools/jogos_test.py http://127.0.0.1:8080/examples/threejs-demo/
    python tools/jogos_test.py dist --headful --json report.json
    python tools/jogos_test.py <build-dir> --engine unity

Exit code: 0 = no FAIL; 1 = at least one FAIL.

Notes:
    - This is a runtime smoke test on a desktop browser. It cannot replace a real
      on-device acceptance run (see docs/acceptance.md).
    - Engine pause state is read through engine-specific APIs (Cocos / Phaser /
      the reference bridge). Unity WebGL does not expose Time.timeScale to JS, so
      for Unity the script reports what it can and asks for manual confirmation.
"""
import argparse
import functools
import json
import os
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
OBSERVER_PATH = os.path.join(HERE, "jogos_observer.js")

PASS, FAIL, WARN, SKIP, INFO = "PASS", "FAIL", "WARN", "SKIP", "INFO"


class Report:
    def __init__(self):
        self.items = []

    def add(self, level, name, detail=""):
        self.items.append((level, name, detail))
        print("[%s] %s" % (level, name))
        if detail:
            for line in str(detail).splitlines():
                print("        " + line)

    def count(self, level):
        return sum(1 for item in self.items if item[0] == level)

    @property
    def failed(self):
        return self.count(FAIL) > 0

    def as_dict(self):
        return {
            "items": [{"level": l, "name": n, "detail": d} for l, n, d in self.items],
            "summary": {lvl: self.count(lvl) for lvl in (PASS, FAIL, WARN, SKIP, INFO)},
        }


# --------------------------------------------------------------- static server

class _Handler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        super().end_headers()


def serve(root):
    handler = functools.partial(_Handler, directory=root)
    srv = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return "http://127.0.0.1:%d/" % srv.server_address[1], srv


def resolve_target(target, root=None):
    if target.startswith("http://") or target.startswith("https://"):
        return target, None

    target_abs = os.path.abspath(target)
    if not os.path.isdir(target_abs):
        sys.exit("Not a directory or URL: %s" % target)

    if root:
        root_abs = os.path.abspath(root)
        if not os.path.isdir(root_abs):
            sys.exit("Not a directory: %s" % root)
        base, srv = serve(root_abs)
        rel = os.path.relpath(target_abs, root_abs).replace(os.sep, "/")
        return base + ("" if rel == "." else rel.rstrip("/") + "/"), srv

    if not os.path.isfile(os.path.join(target_abs, "index.html")):
        sys.exit("No index.html in %s (use --root to serve a parent directory)" % target_abs)
    return serve(target_abs)


# ------------------------------------------------------------------- page utils

def snapshot(page):
    try:
        return page.evaluate(
            "() => (window.__JOGOS_OBSERVER__ ? window.__JOGOS_OBSERVER__.snapshot() : null)"
        )
    except Exception:
        return None


def wait_for(page, predicate, timeout, interval=0.15):
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        last = snapshot(page)
        if last and predicate(last):
            return last, True
        time.sleep(interval)
    return last, False


def calls_named(state, name):
    return [c for c in state["calls"] if c["name"] == name]


def first_call(state, name):
    found = calls_named(state, name)
    return found[0] if found else None


def fire(page, script):
    try:
        page.evaluate(script)
    except Exception as exc:
        return str(exc)
    return None


BLUR = "() => window.dispatchEvent(new Event('blur'))"
FOCUS = "() => window.dispatchEvent(new Event('focus'))"

HIDE = """() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
}"""

SHOW = """() => {
    delete document.hidden;
    delete document.visibilityState;
    document.dispatchEvent(new Event('visibilitychange'));
}"""


# ---------------------------------------------------------------------- checks

def check_init(page, report, args):
    """Check 1: init succeeds and no save access happens before it."""
    state, ok = wait_for(page, lambda s: s["flags"]["initCalled"], args.init_timeout)
    if not state:
        report.add(FAIL, "1.1 init called", "The observer never attached. It must load before every other script.")
        return None

    if not ok:
        if not state["flags"]["sdkDetected"]:
            report.add(
                FAIL,
                "1.1 init called",
                "window.JOGOS_SDK never appeared. The SDK script is missing, blocked, or the page runs in mock mode.",
            )
        else:
            report.add(FAIL, "1.1 init called", "JOGOS_SDK exists but init() was not called within %ss." % args.init_timeout)
        return state

    init_at = first_call(state, "init")["at"]
    report.add(PASS, "1.1 init called", "%dms after page start" % init_at)

    state, ok = wait_for(page, lambda s: s["flags"]["initSettled"], args.init_timeout)
    flags = (state or {}).get("flags", {})
    if not ok:
        report.add(FAIL, "1.2 init resolved", "init() never settled; a pending init blocks every other SDK call (counted as 460).")
        return state

    if not flags.get("initOk"):
        report.add(FAIL, "1.2 init resolved", "init() rejected: %s" % flags.get("initError"))
        return state

    keys = flags.get("systemInfoKeys") or []
    report.add(PASS, "1.2 init resolved", "systemInfo keys: %s" % (", ".join(keys) if keys else "(empty object)"))

    violations = [
        e for e in state["storage"]
        if e["beforeInit"] and e["origin"] not in ("sdk", "engine") and not e["idbfs"]
    ]
    idbfs = [e for e in state["storage"] if e["beforeInit"] and e["idbfs"]]
    engine_hits = [e for e in state["storage"] if e["beforeInit"] and e["origin"] == "engine"]
    total = len([e for e in state["storage"] if e["origin"] not in ("sdk", "engine")])

    if violations:
        detail = "\n".join(
            "%s(%s) at %dms" % (e["api"], e["key"], e["at"]) for e in violations[:6]
        )
        report.add(FAIL, "1.3 no save access before init", detail)
    else:
        report.add(PASS, "1.3 no save access before init", "%d access(es) after init, 0 before" % total)

    if engine_hits:
        report.add(
            INFO,
            "1.3a engine storage before init",
            "%d access(es) came from the engine boot, not your game code: %s"
            % (len(engine_hits), ", ".join(e["api"] + "(" + str(e["key"]) + ")" for e in engine_hits[:3])),
        )

    if idbfs:
        report.add(
            WARN,
            "1.3b IDBFS mounted before init",
            "Unity/Emscripten mounts /idbfs during engine boot. Confirm your own code did not read "
            "PlayerPrefs or save keys before init resolved.",
        )
    return state


def check_loading(page, report, args, state):
    """Check 2: loadingStart after init, loadingEnd when playable."""
    start = first_call(state, "game.loadingStart")
    end = first_call(state, "game.loadingEnd")

    if not end:
        state, _ = wait_for(page, lambda s: bool(first_call(s, "game.loadingEnd")), args.playable_timeout)
        end = first_call(state, "game.loadingEnd") if state else None

    if not start and not end:
        report.add(SKIP, "2.1 loading lifecycle", "loadingStart/loadingEnd are recommended, not mandatory. Reporting them improves the review pass rate.")
        return state, None

    if start and not end:
        report.add(WARN, "2.1 loading lifecycle", "loadingStart() was called but loadingEnd() never was. The platform loading page can stay visible.")
        return state, start

    if end and not start:
        report.add(WARN, "2.1 loading lifecycle", "loadingEnd() without loadingStart(). Add loadingStart() right after init().")
        return state, end

    if end["at"] < start["at"]:
        report.add(FAIL, "2.1 loading order", "loadingEnd() at %dms is earlier than loadingStart() at %dms." % (end["at"], start["at"]))
        return state, end

    gap = end["at"] - start["at"]
    report.add(PASS, "2.1 loading order", "loadingStart %dms -> loadingEnd %dms" % (start["at"], end["at"]))

    init_at = (first_call(state, "init") or {}).get("at", 0)
    if start["at"] - init_at > 2000:
        report.add(WARN, "2.2 loadingStart timing", "loadingStart() ran %dms after init(). Call it immediately after init resolves." % (start["at"] - init_at))
    else:
        report.add(PASS, "2.2 loadingStart timing", "%dms after init" % max(0, start["at"] - init_at))

    if gap < 300:
        report.add(WARN, "2.3 loadingEnd timing", "loadingEnd() came only %dms after loadingStart(). Make sure this means 'player can act', not first-frame rendering." % gap)
    else:
        report.add(PASS, "2.3 loadingEnd timing", "%dms of real loading" % gap)
    return state, end


def check_pause(page, report, args, state, ready_at):
    """Check 3: blur -> pause (+ game really stops), focus -> continuePlay."""
    # Let the first playable scene settle before testing focus handling.
    wait_ms = int(max(0, ready_at - (state or {}).get("at", 0)) + args.playable_wait * 1000)
    page.wait_for_timeout(min(wait_ms, 15000))

    before = snapshot(page)
    blur_err = fire(page, BLUR)
    page.wait_for_timeout(700)
    after_blur = snapshot(page)

    if not before or not after_blur:
        report.add(FAIL, "3.1 pause on blur", "Observer state unavailable.")
        return

    pause_delta = len(calls_named(after_blur, "game.pause")) - len(calls_named(before, "game.pause"))
    paused = after_blur["engine"]["paused"]

    if blur_err:
        report.add(WARN, "3.1 pause on blur", "Could not dispatch blur: %s" % blur_err)
    elif pause_delta > 0:
        report.add(PASS, "3.1 pause on blur", "game.pause() called")
    else:
        report.add(WARN, "3.1 pause on blur", "blur did not call game.pause(). Some engines only listen to visibilitychange; see 3.3.")

    if paused is True:
        report.add(PASS, "3.2 game actually paused", "%s = true" % (after_blur["engine"]["source"] or "engine"))
    elif paused is False:
        report.add(FAIL, "3.2 game actually paused", "game.pause() ran but the game still reports running (%s)." % (after_blur["engine"]["source"] or "engine"))
    else:
        report.add(WARN, "3.2 game actually paused", "Cannot read pause state (%s). Confirm manually that the game stops and audio is muted." % (after_blur["engine"]["source"] or "unknown engine"))

    # Visual freeze is weak evidence: UI animations keep moving even when gameplay stops.
    if pause_delta > 0:
        page.wait_for_timeout(400)
        shot_a = page.screenshot()
        page.wait_for_timeout(350)
        shot_b = page.screenshot()
        report.add(
            INFO,
            "3.2b visual freeze",
            "frames identical (frozen)" if shot_a == shot_b else "frames still differ (UI/CSS animation may cause this)",
        )

    # Resume
    fire(page, FOCUS)
    page.wait_for_timeout(600)
    after_focus = snapshot(page)
    resume_delta = len(calls_named(after_focus, "game.continuePlay")) - len(calls_named(after_blur, "game.continuePlay"))
    resumed = after_focus["engine"]["paused"]

    if resume_delta > 0:
        report.add(PASS, "3.3 continuePlay on focus", "game.continuePlay() called")
    else:
        report.add(WARN, "3.3 continuePlay on focus", "focus did not call game.continuePlay(); see 3.4.")

    if resumed is False:
        report.add(PASS, "3.4 game resumed", "%s = false" % (after_focus["engine"]["source"] or "engine"))
    elif resumed is True:
        report.add(FAIL, "3.4 game resumed", "continuePlay() ran but the game still reports paused.")
    else:
        report.add(WARN, "3.4 game resumed", "Cannot read resume state. Confirm manually.")

    # Visibility change path (covers engines that do not listen to window blur).
    base = snapshot(page)
    fire(page, HIDE)
    page.wait_for_timeout(700)
    after_hide = snapshot(page)
    hide_delta = len(calls_named(after_hide, "game.pause")) - len(calls_named(base, "game.pause"))

    fire(page, SHOW)
    page.wait_for_timeout(600)
    after_show = snapshot(page)
    show_delta = len(calls_named(after_show, "game.continuePlay")) - len(calls_named(after_hide, "game.continuePlay"))

    if hide_delta > 0 and show_delta > 0:
        report.add(PASS, "3.5 visibilitychange pause/resume", "hidden -> pause, visible -> continuePlay")
    elif hide_delta > 0:
        report.add(WARN, "3.5 visibilitychange pause/resume", "hidden paused the game but visible did not resume it.")
    elif pause_delta > 0:
        report.add(INFO, "3.5 visibilitychange pause/resume", "Not handled; window blur is the only path. Usually fine on mobile browsers.")
    else:
        report.add(FAIL, "3.5 visibilitychange pause/resume", "Neither blur nor visibilitychange pauses the game.")

    if pause_delta == 0 and hide_delta > 0:
        report.add(INFO, "3.6 note", "Only visibilitychange is handled. Desktop tab switching is covered, but window blur (alt-tab without tab switch) is not.")


# ------------------------------------------------------------------------ main

def parse_args():
    parser = argparse.ArgumentParser(description="Runtime integration test for the Jogos SDK.")
    parser.add_argument("target", help="Build directory (with index.html) or a full URL")
    parser.add_argument("--root", help="Serve this directory instead of the target (needed when the page references ../shared)")
    parser.add_argument("--headful", action="store_true", help="Show the browser window")
    parser.add_argument("--json", help="Write the report as JSON to this path")
    parser.add_argument("--channel", help="Playwright browser channel (chrome / msedge). Falls back to bundled Chromium")
    parser.add_argument("--timeout", type=float, default=60, help="Page load timeout in seconds (default 60)")
    parser.add_argument("--init-timeout", type=float, default=45, help="How long to wait for init to settle (default 45)")
    parser.add_argument("--playable-timeout", type=float, default=45, help="How long to wait for loadingEnd (default 45)")
    parser.add_argument("--playable-wait", type=float, default=3, help="Extra seconds to let the game settle before pause tests (default 3)")
    parser.add_argument("--engine", help="Hint only, echoed in the report (unity / cocos / three / phaser / h5)")
    return parser.parse_args()


LAUNCH_ARGS = [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--autoplay-policy=no-user-gesture-required",
]


def launch_browser(playwright, headless, channel=None):
    """Prefer an explicit channel, then the bundled Chromium, then a local Chrome/Edge."""
    wanted = [channel] if channel else []
    wanted += [None, "chrome", "msedge"]
    last = None
    for name in wanted:
        kwargs = {"headless": headless, "args": LAUNCH_ARGS}
        if name:
            kwargs["channel"] = name
        try:
            return playwright.chromium.launch(**kwargs)
        except Exception as exc:
            last = exc
    raise last


def main():
    args = parse_args()

    if not os.path.isfile(OBSERVER_PATH):
        sys.exit("Missing observer script: %s" % OBSERVER_PATH)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("Playwright is required: pip install playwright && playwright install chromium")

    url, srv = resolve_target(args.target, args.root)
    observer_src = open(OBSERVER_PATH, "r", encoding="utf-8").read()
    report = Report()

    print("Jogos SDK integration test")
    print("  target : %s" % args.target)
    print("  url    : %s" % url)
    if args.engine:
        print("  engine : %s (hint)" % args.engine)
    print("")

    try:
        with sync_playwright() as p:
            browser = launch_browser(p, not args.headful, args.channel)
            context = browser.new_context(viewport={"width": 960, "height": 600})
            context.add_init_script(script=observer_src)
            page = context.new_page()

            console_errors = []
            bad_responses = []
            page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
            page.on("pageerror", lambda e: console_errors.append(str(e)))
            page.on(
                "response",
                lambda r: bad_responses.append("%s %s" % (r.status, r.url)) if r.status >= 400 else None,
            )

            try:
                page.goto(url, wait_until="domcontentloaded", timeout=args.timeout * 1000)
            except Exception as exc:
                report.add(FAIL, "0. page load", str(exc))

            print("1. INIT")
            state = check_init(page, report, args)

            engine = (snapshot(page) or {}).get("engine", {})
            print("\n2. LOADING")
            state, ready = check_loading(page, report, args, state or {"calls": [], "storage": [], "flags": {}})

            ready_at = (ready or {}).get("at", 0)
            print("\n3. PAUSE / RESUME")
            check_pause(page, report, args, snapshot(page), ready_at)

            if console_errors:
                print("\n4. CONSOLE")
                uniq = []
                for text in console_errors:
                    if text in uniq or "Failed to load resource" in text:
                        continue
                    uniq.append(text)
                if uniq:
                    report.add(WARN, "4.1 console errors", "\n".join(uniq[:5]))

            if bad_responses:
                print("\n5. NETWORK")
                uniq = []
                for text in bad_responses:
                    if "/favicon" in text or text in uniq:
                        continue
                    uniq.append(text)
                if uniq:
                    report.add(FAIL, "5.1 failed requests", "\n".join(uniq[:8]))

            final = snapshot(page) or {}
            print("")
            print("-" * 72)
            print("Engine detected : %s (paused signal: %s)" % (
                (final.get("engine") or {}).get("engine", engine.get("engine", "unknown")),
                (final.get("engine") or {}).get("source", "n/a") or "n/a",
            ))
            print("Summary         : %d PASS / %d WARN / %d FAIL / %d SKIP" % (
                report.count(PASS), report.count(WARN), report.count(FAIL), report.count(SKIP),
            ))
            print("Result          : %s" % ("FAIL" if report.failed else "PASS"))
            if report.failed:
                print("")
                print("See docs/acceptance.md and docs/pitfalls.md for the failing items.")

            browser.close()
    finally:
        if srv is not None:
            srv.shutdown()

    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(report.as_dict(), fh, indent=2, ensure_ascii=False)
        print("JSON report     : %s" % args.json)

    return 1 if report.failed else 0


if __name__ == "__main__":
    sys.exit(main())
