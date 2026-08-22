# -*- coding: utf-8 -*-
"""把特效素材的「近黑」壓成真的黑。

特效是黑底、網頁端用 mix-blend-mode:screen 混掉黑色。問題是 WebP 壓縮之後
黑底不再是 0（實測煙霧與暈影那一圈會到 RGB 40 上下），screen 是加亮運算，
那一圈就會把背景提亮成一個**看得見的方塊**——Steve 2026-08-23 回報的
「火球是方形的」就是這個。

作法：對每個通道套同一條 LUT，把 <=T 壓成 0，其餘線性拉回 0~255，
所以煙霧的漸層還在，不會硬切出邊。有 PNG 原檔就從 PNG 重做，畫質更好。

用法：python tools/fix_fx.py [門檻，預設 34]
"""
import glob, os, sys
from PIL import Image

ASSETS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets")


def lut(t):
    return [0 if v <= t else min(255, round((v - t) * 255 / (255 - t))) for v in range(256)]


def main(t=34):
    table = lut(t) * 3
    for f in sorted(glob.glob(os.path.join(ASSETS, "fx*.webp"))):
        name = os.path.basename(f)
        png = f[:-5] + ".png"
        src = png if os.path.exists(png) else f          # 有原檔就從原檔做
        im = Image.open(src)
        # ⚠ 去背素材（角色、貓）壓黑會把 alpha 弄掉、變成一塊黑方塊，一律跳過。
        #    但黑底特效的 PNG 也常常存成 RGBA、只是 alpha 整片滿的——那種要處理，
        #    所以判斷的是「有沒有真的透明像素」，不是看 mode。
        transparent = im.mode in ("RGBA", "LA") and im.getchannel("A").getextrema()[0] < 250
        if transparent:
            im.save(f, "WEBP", quality=92, method=6)
            print("%-20s 去背素材，跳過壓黑（原樣重存）" % name)
            continue
        im = im.convert("RGB")
        px = list(im.getdata())
        b0 = 100.0 * sum(1 for q in px if sum(q) == 0) / len(px)
        im = im.point(table)
        px = list(im.getdata())
        b1 = 100.0 * sum(1 for q in px if sum(q) == 0) / len(px)
        im.save(f, "WEBP", quality=92, method=6)
        print("%-20s 純黑像素 %5.1f%% → %5.1f%%   %dKB" % (name, b0, b1, os.path.getsize(f) // 1024))


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 34)
