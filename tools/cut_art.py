# -*- coding: utf-8 -*-
"""AI 生的單張素材 → 遊戲用 webp

兩種處理：
- 角色與怪物：去背（生成時多半是純黑底，偶爾會給白底，這裡自己看角落決定挖哪一種）
- 技能特效：黑底留著，網頁端用 mix-blend-mode:screen 混掉，光暈才完整（跟 fx_* 那批一樣）

用法：python tools/cut_art.py <來源資料夾>
"""
import os, sys, glob
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")
KEEP_BG = ("fx_",)          # 這些前綴不去背


def cut(im, tol=46):
    rgb = im.convert("RGB")
    w, h = rgb.size
    corner = rgb.getpixel((2, 2))
    white = sum(corner) > 600                     # 角落很亮＝白底
    fill = (255, 0, 255)
    work = rgb.copy()
    seeds = [(1, 1), (w-2, 1), (1, h-2), (w-2, h-2), (w//2, 1), (w//2, h-2), (1, h//2), (w-2, h//2)]
    for s in seeds:
        px = work.getpixel(s)
        if px == fill:
            continue
        if (sum(px) > 600) == white:
            ImageDraw.floodfill(work, s, fill, thresh=tol)
    mask = Image.new("L", (w, h), 255)
    wp, mp = work.load(), mask.load()
    for y in range(h):
        for x in range(w):
            if wp[x, y] == fill:
                mp[x, y] = 0
    if not white:                                  # 黑底才需要挖被圍住的大塊黑
        dark = rgb.convert("L").point(lambda v: 255 if v < 30 else 0)
        core = dark.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(7))
        dp, cp = dark.load(), core.load()
        for y in range(h):
            for x in range(w):
                if cp[x, y] and dp[x, y]:
                    mp[x, y] = 0
    mask = mask.filter(ImageFilter.GaussianBlur(1))
    out = rgb.convert("RGBA")
    out.putalpha(mask)
    return out.crop(out.getbbox() or (0, 0, w, h))


def main(src):
    for f in sorted(glob.glob(os.path.join(src, "*.png"))):
        name = os.path.splitext(os.path.basename(f))[0]
        im = Image.open(f)
        im.thumbnail((720, 720), Image.LANCZOS)
        if name.startswith(KEEP_BG):
            im = im.convert("RGB")                 # 特效：黑底留著給 screen 混
        else:
            im = cut(im)
        p = os.path.join(OUT, name + ".webp")
        im.save(p, "WEBP", quality=88, method=6)
        print("%-18s %-12s %dKB" % (name + ".webp", "%dx%d" % im.size, os.path.getsize(p)//1024))


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
