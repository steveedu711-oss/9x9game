# -*- coding: utf-8 -*-
"""影片 → 角色序列幀雪碧圖（去背版）

跟 sprite.py 的差別：
- sprite.py 做的是魔法特效，黑底留著、網頁端用 mix-blend-mode:screen 混掉
- 這支做的是角色本體，要疊在場景上，所以黑底一定要真的變透明

去背用「從四邊 flood fill 黑色」而不是單純亮度門檻：
角色身上的黑描邊亮度也很低，用門檻會把描邊一起吃掉，變成鏤空的怪東西。

用法：python tools/sprite_char.py <來源mp4> <輸出名> --start 3.2 --dur 2.4 --fps 12
"""
import os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")


def cut_bg(im, tol=42, feather=1):
    """把黑底挖成透明，角色身上的黑描邊留著。

    兩段一起做，只做其中一段都會壞：
    - 從四邊 flood fill：挖掉外圍的黑
    - 大塊暗區：翅膀底下、四肢之間那種被圍住的黑，flood 進不去，
      改用「侵蝕再膨脹」找——細的黑描邊侵蝕就沒了，大塊的留得住
    """
    rgb = im.convert("RGB")
    w, h = rgb.size
    work = rgb.copy()
    seeds = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
             (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2)]
    for s in seeds:
        if sum(work.getpixel(s)) <= tol * 3:
            ImageDraw.floodfill(work, s, (255, 0, 255), thresh=tol)
    mask = Image.new("L", (w, h), 255)        # 255 = 前景
    px, mx = work.load(), mask.load()
    for y in range(h):
        for x in range(w):
            if px[x, y] == (255, 0, 255):
                mx[x, y] = 0

    # 被圍住的大塊黑
    dark = rgb.convert("L").point(lambda v: 255 if v < 30 else 0)
    core = dark.filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(7))
    dx, cx = dark.load(), core.load()
    for y in range(h):
        for x in range(w):
            if cx[x, y] and dx[x, y]:
                mx[x, y] = 0

    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    out = rgb.convert("RGBA")
    out.putalpha(mask)
    return out


def build(src, name, start, dur, fps, cell, cols=6, crop=None, tol=42):
    tmp = "frames_" + name
    shutil.rmtree(tmp, ignore_errors=True)
    os.makedirs(tmp)
    vf = "fps=%d" % fps
    if crop:
        vf = "crop=%s," % crop + vf
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-ss", str(start),
                    "-t", str(dur), "-i", src, "-vf", vf,
                    os.path.join(tmp, "%03d.png")], check=True)
    files = sorted(os.listdir(tmp))
    ims = []
    for f in files:
        im = Image.open(os.path.join(tmp, f)).resize(cell, Image.LANCZOS)
        ims.append(cut_bg(im, tol=tol))
    n = len(ims)
    rows = (n + cols - 1) // cols
    sheet = Image.new("RGBA", (cell[0] * cols, cell[1] * rows), (0, 0, 0, 0))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % cols) * cell[0], (i // cols) * cell[1]))
    p = os.path.join(OUT, name + ".webp")
    sheet.save(p, "WEBP", quality=86, method=6)
    shutil.rmtree(tmp, ignore_errors=True)
    print("%s  幀數=%d  格=%dx%d  尺寸=%dx%d  %dKB" % (
        os.path.basename(p), n, cols, rows, sheet.width, sheet.height,
        os.path.getsize(p) // 1024))
    return n, cols, rows


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) < 2:
        print(__doc__)
        raise SystemExit(1)

    def opt(flag, dv, cast=float):
        return cast(a[a.index(flag) + 1]) if flag in a else dv

    build(a[0], a[1], opt("--start", 0.0), opt("--dur", 2.5), opt("--fps", 12, int),
          (opt("--cw", 224, int), opt("--ch", 224, int)), opt("--cols", 6, int),
          a[a.index("--crop") + 1] if "--crop" in a else None, opt("--tol", 42, int))
