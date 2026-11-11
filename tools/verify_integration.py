#!/usr/bin/env python3
"""Jogos SDK integration self-check: scans build output for required integration points and common violations.

Usage:
    python tools/verify_integration.py <dir-or-file>
    python tools/verify_integration.py examples/h5-canvas
    python tools/verify_integration.py dist/ --verbose

Exit code: 0 = no ERROR; 1 = at least one ERROR (must be zero before submission).

Note: this is a static scan and cannot replace on-device acceptance. See docs/acceptance.md.
"""
import argparse
import os
import re
import sys

SKIP_DIRS = {".git", ".svn", "node_modules", "library", "temp", "__pycache__", ".idea", ".vscode"}
EXTS = {".html", ".htm", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".json"}
MAX_BYTES = 4 * 1024 * 1024

THIRD_PARTY_ADS = [
    "adsbygoogle", "googletag", "doubleclick", "adservice.google",
    "pagead2", "amazon-adsystem", "pokimini", "poki.com",
    "yandex", "crazygames", "gamepix", "gamemonetize", "gamedistribution",
]


class Report:
    def __init__(self):
        self.items = []

    def add(self, level, name, detail=""):
        self.items.append((level, name, detail))
        print("[%s] %s" % (level, name))
        if detail:
            print("        " + detail)

    @property
    def errors(self):
        return [i for i in self.items if i[0] == "FAIL"]

    @property
    def warns(self):
        return [i for i in self.items if i[0] == "WARN"]


def collect(target):
    """Return [(path, content), ...]."""
    paths = []
    if os.path.isfile(target):
        paths.append(target)
    else:
        for root, dirs, names in os.walk(target):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for name in names:
                if os.path.splitext(name)[1].lower() in EXTS:
                    paths.append(os.path.join(root, name))

    items = []
    for path in paths:
        try:
            if os.path.getsize(path) > MAX_BYTES:
                continue
            with open(path, "r", encoding="utf-8", errors="ignore") as fh:
                items.append((path, fh.read()))
        except OSError:
            continue
    return items


def main():
    parser = argparse.ArgumentParser(description="Jogos SDK integration self-check")
    parser.add_argument("target", help="Build output directory or a single file")
    parser.add_argument("--verbose", action="store_true", help="List the matched files")
    args = parser.parse_args()

    if not os.path.exists(args.target):
        sys.exit("Path not found: %s" % args.target)

    items = collect(args.target)
    if not items:
        sys.exit("No scannable source/build files found: %s" % args.target)

    target_text = "\n".join(content for _, content in items)
    target_low = target_text.lower()

    # shared/jogos-bridge.js is referenced by the examples but lives outside them, so scan it together
    shared_items = []
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    shared_dir = os.path.join(repo_root, "shared")
    if os.path.isdir(shared_dir) and os.path.abspath(shared_dir) != os.path.abspath(args.target):
        shared_items = collect(shared_dir)

    all_items = items + shared_items
    all_text = "\n".join(content for _, content in all_items)
    all_low = all_text.lower()

    report = Report()
    total_kb = len(all_text) / 1024.0

    print("scan: %s (%d files, %.1f KB)" % (os.path.abspath(args.target), len(all_items), total_kb))
    if shared_items:
        print("      + shared/ integration layer, %d files" % len(shared_items))
    if args.verbose:
        for path, _ in all_items:
            print("      - %s" % os.path.relpath(path, repo_root))
    print("")

    # ---------------- 1. SDK inclusion
    has_sdk = any(kw in all_low for kw in (
        "jogos-sdk-v1.js", "jogos-sdk.esm", "jogossdk", "jogosbridge", "jogos_sdk"))
    report.add("PASS" if has_sdk else "FAIL", "SDK inclusion",
               "" if has_sdk else "No reference to jogos-sdk-v1.js / JogosSDK / JogosBridge found")

    # ---------------- 2. Lifecycle
    has_init = bool(re.search(r"\.init\s*\(", all_text))
    report.add("PASS" if has_init else "FAIL", "init call",
               "" if has_init else "No SDK init call found (calling anything before init throws 460)")

    has_start = "loadingstart" in all_low
    has_end = "loadingend" in all_low
    report.add("PASS", "loadingStart (optional)",
               "integrated" if has_start else "not integrated; no longer mandatory, call it after init")
    report.add("PASS", "loadingEnd (optional)",
               "integrated" if has_end else "not integrated; no longer mandatory, call it when the player can act")

    if has_start and has_end:
        # Only compare order inside the same file to avoid false positives across files
        bad = []
        for path, content in all_items:
            low = content.lower()
            a = re.search(r"loadingstart\s*\(", low)
            b = re.search(r"loadingend\s*\(", low)
            if a and b and b.start() < a.start():
                bad.append(os.path.basename(path))
        report.add("FAIL" if bad else "PASS", "loading order",
                   ("loadingEnd appears before loadingStart in: %s" % ", ".join(bad)) if bad else "")

    # ---------------- 3. Pause/resume
    has_pause = bool(re.search(r"\.pause\s*\(|['\"]pause['\"]|pausegame", all_low))
    has_continue = "continueplay" in all_low or bool(re.search(r"\.resume\s*\(", all_low))
    report.add("PASS" if has_pause else "WARN", "pause report",
               "" if has_pause else "No pause call found; report it on level end / menu / focus loss")
    report.add("PASS" if has_continue else "WARN", "continuePlay report",
               "" if has_continue else "No continuePlay/resume call found; pause must be paired with a resume")

    # ---------------- 4. Ads
    has_rewarded = "rewarded" in all_low
    has_midgame = "midgame" in all_low or "interstitial" in all_low
    report.add("PASS" if has_rewarded else "WARN", "Rewarded ads",
               "" if has_rewarded else "No rewarded ads detected; if the game monetizes with ads this is the main revenue")
    report.add("PASS" if has_midgame else "WARN", "Interstitial ads",
               "" if has_midgame else "No interstitial detected; only show it on level end / death / load")

    if has_rewarded:
        has_finished = "onfinished" in all_low
        has_error = "onerror" in all_low
        report.add("PASS" if has_finished and has_error else "FAIL", "Ad callback completeness",
                   "" if has_finished and has_error else
                   "Rewarded ads must handle both onfinished (grant) and onerror (no grant)")

    # ---------------- 5. Banner
    has_banner = "requestbanner" in all_low or "showbanner" in all_low
    if has_banner:
        report.add("PASS", "Banner integration", "")
        if not re.search(r"id=[\"'][^\"']*banner", target_low):
            report.add("WARN", "Banner container",
                       "No obvious banner container id found; requestBanner(id) must match the DOM container")
    else:
        report.add("WARN", "Banner integration", "No banner detected; ignore if the game does not need one")

    # ---------------- 6. Save (game code only, not the integration layer)
    has_save = "localstorage" in all_low
    report.add("PASS" if has_save else "WARN", "Local save",
               "" if has_save else "No localStorage detected; if the game has progress, use a stable-key save")
    if "synchronizetocloud" in target_low:
        report.add("WARN", "Cloud sync frequency",
                   "synchronizeToCloud found in game code: the platform allows once per minute; "
                   "with a stable localStorage key no manual call is needed")
    if re.search(r"localstorage\.setitem\(\s*['\"][^'\"]*(date|time|rand|uuid)", target_low):
        report.add("WARN", "Save key stability",
                   "Save key seems to contain a time/random value, so every launch creates a new save")

    # ---------------- 7. Mobile basics
    has_viewport = re.search(r"name=[\"']viewport", target_low)
    report.add("PASS" if has_viewport else "WARN", "viewport",
               "" if has_viewport else "Missing viewport meta; mobile scaling will be wrong")
    has_select = "user-select" in all_low
    report.add("PASS" if has_select else "WARN", "Selection disabled",
               "" if has_select else "Missing user-select:none; long press opens a selection box on mobile")
    has_ctx = "contextmenu" in all_low
    report.add("PASS" if has_ctx else "WARN", "Context menu disabled",
               "" if has_ctx else "Missing contextmenu interception; right click opens the browser menu")

    # ---------------- 8. Violations / leftovers (game code only)
    hits = [kw for kw in THIRD_PARTY_ADS if kw in target_low]
    report.add("FAIL" if hits else "PASS", "Third-party ad SDK",
               ("Suspected third-party ads: %s — only Jogos SDK ads are allowed" % ", ".join(hits))
               if hits else "")

    leftovers = [kw for kw in ("debugger", "?mock=1", "127.0.0.1:8080", "localhost:8080")
                 if kw in target_low]
    report.add("WARN" if leftovers else "PASS", "Debug leftovers",
               ("Debug markers found: %s" % ", ".join(leftovers)) if leftovers else "")

    # ---------------- Summary
    fails, warns = report.errors, report.warns
    print("\nsummary: %d checks, %d FAIL, %d WARN" % (len(report.items), len(fails), len(warns)))
    if fails:
        print("\nMust fix:")
        for _, name, detail in fails:
            print("  - %s%s" % (name, (": " + detail) if detail else ""))
        return 1
    print("result: PASS (still complete on-device acceptance per docs/acceptance.md)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
