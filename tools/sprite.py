# -*- coding: utf-8 -*-
"""影片 → 序列幀雪碧圖（黑底保留，網頁端用 mix-blend-mode:screen 讓黑色自然透掉）"""
import io, os, subprocess, sys, shutil
from PIL import Image

SRC = r"D:\ClaudeOnly\tools\gemini-auto\2026-08-21\9x9game"
OUT = r"D:\ClaudeOnly\games\9x9game\assets"

def build(name, start, dur, fps, crop, cell, cols=6):
    tmp = os.path.join("frames_" + name)
    shutil.rmtree(tmp, ignore_errors=True); os.makedirs(tmp)
    vf = "fps=%d" % fps
    if crop: vf = "crop=%s," % crop + vf
    subprocess.run(["ffmpeg","-hide_banner","-loglevel","error","-ss",str(start),"-t",str(dur),
                    "-i", os.path.join(SRC, name + ".mp4"), "-vf", vf,
                    os.path.join(tmp, "%03d.png")], check=True)
    files = sorted(os.listdir(tmp))
    ims = []
    for f in files:
        im = Image.open(os.path.join(tmp, f)).convert("RGB").resize(cell, Image.LANCZOS)
        ims.append(im)
    # 砍掉尾端幾乎全黑的幀（消散完就沒必要留）
    def bright(im):
        g = im.convert("L").resize((32,32))
        return max(g.getdata())
    while len(ims) > 6 and bright(ims[-1]) < 26:
        ims.pop()
    n = len(ims)
    rows = (n + cols - 1)//cols
    sheet = Image.new("RGB", (cell[0]*cols, cell[1]*rows), (0,0,0))
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % cols)*cell[0], (i//cols)*cell[1]))
    p = os.path.join(OUT, "fxs_" + name.replace("fx_","") + ".webp")
    sheet.save(p, "WEBP", quality=80, method=6)
    shutil.rmtree(tmp, ignore_errors=True)
    print("%s  幀數=%d  格=%dx%d  尺寸=%dx%d  %dKB" % (
        os.path.basename(p), n, cols, rows, sheet.width, sheet.height, os.path.getsize(p)//1024))
    return n, cols, rows

if __name__ == "__main__":
    build("fx_fire",    3.30, 2.4, 10, "720:720:280:0", (192,192))
    build("fx_thunder", 3.40, 2.2, 11, None,            (256,144))
