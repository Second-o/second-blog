# ==========================================================
# 二次可能 · B 站投稿更新脚本（本地手动跑）
# ----------------------------------------------------------
# 用途：作品页已经在浏览器里自动检查新视频了，但那份数据存在
#       localStorage 里，换电脑 / 清缓存就没了。想把这些数据
#       固化进 js/videos-data.js，跑一下这个脚本就行。
#
# 用法：
#     python tools/update-videos.py
#
# 它会尝试直连 B 站接口，失败就自动换公共代理；
# 拉到数据后重写 js/videos-data.js（只改数据，不动其它文件）。
# ==========================================================
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone

MID = 1328121264
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "js", "videos-data.js")

API = ("https://api.bilibili.com/x/space/wbi/arc/search"
       "?mid=%d&ps=30&pn=1&order=pubdate" % MID)

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def candidates():
    enc = urllib.parse.quote(API, safe="")
    return [
        ("直连", API),
        ("allorigins", "https://api.allorigins.win/raw?url=" + enc),
        ("codetabs", "https://api.codetabs.com/v1/proxy?quest=" + enc),
        ("corsproxy", "https://corsproxy.io/?url=" + enc),
    ]


def get(url, timeout=15):
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Referer": "https://space.bilibili.com/%d/upload" % MID,
        "Accept": "application/json, text/plain, */*",
    })
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "replace")


def fmt_date(ts):
    try:
        d = datetime.fromtimestamp(int(ts), tz=timezone.utc).astimezone()
    except Exception:
        return ""
    return "%d月%d日" % (d.month, d.day)


def parse_vlist(text):
    try:
        data = json.loads(text)
    except Exception:
        return None
    if isinstance(data, dict) and data.get("code") not in (None, 0):
        return None
    d = data.get("data") if isinstance(data, dict) else None
    vlist = None
    if isinstance(d, dict):
        lst = d.get("list")
        if isinstance(lst, dict):
            vlist = lst.get("vlist")
        elif isinstance(lst, list):
            vlist = lst
    if not vlist:
        return None
    out = []
    for v in vlist:
        bv = v.get("bvid")
        if not bv:
            continue
        out.append({
            "bvid": bv,
            "title": re.sub(r"\s+", " ", str(v.get("title", "")).strip()),
            "plays": int(v.get("play") or 0),
            "length": v.get("length") or "",
            "date": fmt_date(v.get("created")),
            "cover": v.get("pic") or "",
        })
    return out or None


def render_js(videos):
    today = datetime.now().strftime("%Y-%m-%d")
    rows = []
    for v in videos:
        rows.append(
            "    {\n"
            "      bvid: %s,\n"
            "      title: %s,\n"
            "      plays: %d,\n"
            "      length: %s,\n"
            "      date: %s,\n"
            "      cover: %s\n"
            "    }" % (
                json.dumps(v["bvid"], ensure_ascii=False),
                json.dumps(v["title"], ensure_ascii=False),
                v["plays"],
                json.dumps(v["length"], ensure_ascii=False),
                json.dumps(v["date"], ensure_ascii=False),
                json.dumps(v["cover"], ensure_ascii=False),
            )
        )
    body = ",\n".join(rows)
    return (
        "/* ==========================================================\n"
        "   二次可能 · B 站投稿数据快照\n"
        "   ----------------------------------------------------------\n"
        "   本文件由 tools/update-videos.py 自动生成，请勿手改。\n"
        "   更新时间：%s\n"
        "   ========================================================== */\n"
        "window.SECOND_VIDEOS = {\n"
        "  mid: %d,\n"
        "  updatedAt: '%s',\n"
        "  videos: [\n%s\n  ]\n};\n" % (today, MID, today, body)
    )


def main():
    for name, url in candidates():
        try:
            videos = parse_vlist(get(url))
        except Exception as e:
            print("[跳过] %-11s %s" % (name, e))
            continue
        if not videos:
            print("[跳过] %-11s 接口返回没有列表" % name)
            continue
        with open(OUT, "w", encoding="utf-8") as f:
            f.write(render_js(videos))
        print("[成功] %-11s 写入 %d 条 -> %s" % (name, len(videos), OUT))
        return 0
    print("全部方式都失败了（B 站风控）。作品页仍可用本地数据，稍后再试。")
    return 1


if __name__ == "__main__":
    sys.exit(main())
