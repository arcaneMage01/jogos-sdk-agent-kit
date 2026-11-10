#!/usr/bin/env python3
"""本地静态服务器（禁用缓存，避免改完代码刷新不生效）。

用法：
    python tools/serve.py                    # 服务仓库根目录，默认 8080
    python tools/serve.py --port 8090
    python tools/serve.py --root examples/cocos-demo/build

为什么不用 `python -m http.server`：
    默认实现会返回 304/强缓存，改完 JS 刷新看不到变化，容易误判“接入没生效”。
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
    parser = argparse.ArgumentParser(description="Jogos SDK agent kit 本地静态服务器")
    parser.add_argument("--root", default=repo_root, help="要服务的目录（默认仓库根）")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()

    root = os.path.abspath(args.root)
    if not os.path.isdir(root):
        sys.exit("目录不存在: %s" % root)

    handler = functools.partial(NoStoreHandler, directory=root)
    try:
        httpd = ThreadingHTTPServer((args.host, args.port), handler)
    except OSError as exc:
        sys.exit("端口 %s 不可用: %s" % (args.port, exc))

    base = "http://%s:%d" % (args.host, args.port)
    print("serving: %s" % root)
    print("ready:   %s/" % base)
    for name, sub in (
        ("H5 demo", "examples/h5-canvas/"),
        ("three.js demo", "examples/threejs-demo/"),
        ("Cocos demo (源码工程，需用 Creator 打开)", "examples/cocos-demo/"),
    ):
        print("  %-42s %s/%s" % (name, base, sub))
    print("  %-42s %s/?mock=1" % ("H5 offline mock", base + "/examples/h5-canvas/"))
    print("Ctrl+C 退出\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
