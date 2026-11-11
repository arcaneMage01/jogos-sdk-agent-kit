#!/usr/bin/env python3
"""Local static server with caching disabled, so code edits take effect on refresh.

Usage:
    python tools/serve.py                    # serve the repo root on port 8080
    python tools/serve.py --port 8090
    python tools/serve.py --root examples/cocos-demo/build

Why not `python -m http.server`:
    The default implementation returns 304/strong cache headers, so edited JS does not show up on
    refresh and you may wrongly conclude "the integration did not take effect".
"""
import argparse
import functools
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoStoreHandler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".wasm": "application/wasm",
        ".json": "application/json",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("  %s - %s\n" % (self.address_string(), fmt % args))


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    parser = argparse.ArgumentParser(description="Jogos SDK agent kit local static server")
    parser.add_argument("--root", default=repo_root, help="Directory to serve (default: repo root)")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        sys.exit("Directory not found: %s" % root)

    handler = functools.partial(NoStoreHandler, directory=root)
    try:
        httpd = ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as exc:
        sys.exit("Port %s is not available: %s" % (args.port, exc))

    base = "http://%s:%d" % (args.host, args.port)
    print("serving: %s" % root)
    print("ready:   %s/" % base)
    for name, sub in (
        ("H5 demo", "examples/h5-canvas/"),
        ("three.js demo", "examples/threejs-demo/"),
        ("Cocos demo (source project, open with Cocos Creator)", "examples/cocos-demo/"),
    ):
        print("  %-52s %s/%s" % (name, base, sub))
    print("  %-52s %s/?mock=1" % ("H5 offline mock", base + "/examples/h5-canvas/"))
    print("Press Ctrl+C to stop\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
