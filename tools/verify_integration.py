#!/usr/bin/env python3
"""Jogos SDK 接入自检：扫描构建产物，检查必接点与常见违规。

用法：
    python tools/verify_integration.py <目录或文件>
    python tools/verify_integration.py examples/h5-canvas
    python tools/verify_integration.py dist/ --verbose

退出码：0 = 没有 ERROR；1 = 存在 ERROR（提审前必须清零）。

注意：这是静态扫描，不能替代真机验收。规则见 docs/acceptance.md。
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
    """返回 [(path, content), ...]"""
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
    parser = argparse.ArgumentParser(description="Jogos SDK 接入自检")
    parser.add_argument("target", help="构建产物目录或单个文件")
    parser.add_argument("--verbose", action="store_true", help="输出命中的文件列表")
    args = parser.parse_args()

    if not os.path.exists(args.target):
        sys.exit("路径不存在: %s" % args.target)

    items = collect(args.target)
    if not items:
        sys.exit("没有找到可扫描的源码/产物文件: %s" % args.target)

    target_text = "\n".join(content for _, content in items)
    target_low = target_text.lower()

    # 接入层 shared/jogos-bridge.js 被示例引用但不在示例目录内，合并扫描
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
        print("      + shared/ 接入层 %d files" % len(shared_items))
    if args.verbose:
        for path, _ in all_items:
            print("      - %s" % os.path.relpath(path, repo_root))
    print("")

    # ---------------- 1. SDK 引入
    has_sdk = any(kw in all_low for kw in (
        "jogos-sdk-v1.js", "jogos-sdk.esm", "jogossdk", "jogosbridge", "jogos_sdk"))
    report.add("PASS" if has_sdk else "FAIL", "SDK 引入",
               "" if has_sdk else "没有找到 jogos-sdk-v1.js / JogosSDK / JogosBridge 的任何引用")

    # ---------------- 2. 生命周期
    has_init = bool(re.search(r"\.init\s*\(", all_text))
    report.add("PASS" if has_init else "FAIL", "init 调用",
               "" if has_init else "没有找到 SDK init 调用（未 init 调用其它接口会抛 460）")

    has_start = "loadingstart" in all_low
    has_end = "loadingend" in all_low
    report.add("PASS" if has_start else "FAIL", "loadingStart",
               "" if has_start else "缺少 game.loadingStart()，平台无法统计加载开始")
    report.add("PASS" if has_end else "FAIL", "loadingEnd",
               "" if has_end else "缺少 game.loadingEnd()，平台无法判定游戏可玩")

    if has_start and has_end:
        # 只在同一个文件里同时出现时才能判断顺序，避免跨文件误报
        bad = []
        for path, content in all_items:
            low = content.lower()
            a = re.search(r"loadingstart\s*\(", low)
            b = re.search(r"loadingend\s*\(", low)
            if a and b and b.start() < a.start():
                bad.append(os.path.basename(path))
        report.add("FAIL" if bad else "PASS", "loading 顺序",
                   ("%s 中 loadingEnd 出现在 loadingStart 之前" % ", ".join(bad)) if bad else "")

    # ---------------- 3. 暂停/恢复
    has_pause = bool(re.search(r"\.pause\s*\(|['\"]pause['\"]|pausegame", all_low))
    has_continue = "continueplay" in all_low or bool(re.search(r"\.resume\s*\(", all_low))
    report.add("PASS" if has_pause else "WARN", "pause 上报",
               "" if has_pause else "没有找到 pause 调用；关卡结束/菜单/失焦时应上报")
    report.add("PASS" if has_continue else "WARN", "continuePlay 上报",
               "" if has_continue else "没有找到 continuePlay/resume 调用；暂停必须成对恢复")

    # ---------------- 4. 广告
    has_rewarded = "rewarded" in all_low
    has_midgame = "midgame" in all_low or "interstitial" in all_low
    report.add("PASS" if has_rewarded else "WARN", "激励广告",
               "" if has_rewarded else "未检测到激励广告；如果游戏有广告变现，这是主要收入来源")
    report.add("PASS" if has_midgame else "WARN", "插屏广告",
               "" if has_midgame else "未检测到插屏广告；注意只能在关卡结束/死亡/加载时播")

    if has_rewarded:
        has_finished = "onfinished" in all_low
        has_error = "onerror" in all_low
        report.add("PASS" if has_finished and has_error else "FAIL", "广告回调完整性",
                   "" if has_finished and has_error else
                   "激励广告必须同时处理 onfinished（发奖）与 onerror（不发奖）")

    # ---------------- 5. Banner
    has_banner = "requestbanner" in all_low or "showbanner" in all_low
    if has_banner:
        report.add("PASS", "Banner 接入", "")
        if not re.search(r"id=[\"'][^\"']*banner", target_low):
            report.add("WARN", "Banner 容器",
                       "未发现明显的 banner 容器 id；requestBanner(id) 的 id 必须与 DOM 容器一致")
    else:
        report.add("WARN", "Banner 接入", "未检测到 banner；如无 banner 需求可忽略")

    # ---------------- 6. 存档（只看业务代码，不看接入层）
    has_save = "localstorage" in all_low
    report.add("PASS" if has_save else "WARN", "本地存档",
               "" if has_save else "未检测到 localStorage；若游戏有进度，建议使用稳定 key 存档")
    if "synchronizetocloud" in target_low:
        report.add("WARN", "云同步频率",
                   "业务代码里出现 synchronizeToCloud：平台限 1 次/分钟；用稳定 localStorage key 时无需手动调用")
    if re.search(r"localstorage\.setitem\(\s*['\"][^'\"]*(date|time|rand|uuid)", target_low):
        report.add("WARN", "存档 key 稳定性",
                   "存档 key 疑似包含时间/随机值，会导致每次进入都是新档")

    # ---------------- 7. 移动端基础
    has_viewport = re.search(r"name=[\"']viewport", target_low)
    report.add("PASS" if has_viewport else "WARN", "viewport",
               "" if has_viewport else "缺少 viewport meta；移动端会缩放异常")
    has_select = "user-select" in all_low
    report.add("PASS" if has_select else "WARN", "禁止选中",
               "" if has_select else "缺少 user-select:none；移动端长按会弹出选择框")
    has_ctx = "contextmenu" in all_low
    report.add("PASS" if has_ctx else "WARN", "禁用右键菜单",
               "" if has_ctx else "缺少 contextmenu 拦截；桌面右键会弹出浏览器菜单")

    # ---------------- 8. 违规 / 残留（只看业务代码）
    hits = [kw for kw in THIRD_PARTY_ADS if kw in target_low]
    report.add("FAIL" if hits else "PASS", "第三方广告 SDK",
               ("发现疑似第三方广告: %s —— 平台只允许 Jogos SDK 的广告" % ", ".join(hits))
               if hits else "")

    leftovers = [kw for kw in ("debugger", "?mock=1", "127.0.0.1:8080", "localhost:8080")
                 if kw in target_low]
    report.add("WARN" if leftovers else "PASS", "调试残留",
               ("发现调试标记: %s" % ", ".join(leftovers)) if leftovers else "")

    # ---------------- 汇总
    fails, warns = report.errors, report.warns
    print("\nsummary: %d checks, %d FAIL, %d WARN" % (len(report.items), len(fails), len(warns)))
    if fails:
        print("\n必须修复：")
        for _, name, detail in fails:
            print("  - %s%s" % (name, (": " + detail) if detail else ""))
        return 1
    print("结果: PASS（仍需按 docs/acceptance.md 做真机验收）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
