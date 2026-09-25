"""Generate Known Good Media logo SVGs (text outlined to paths) and PNG exports."""
import os, sys
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
os.makedirs(os.path.join(OUT, "png"), exist_ok=True)

ANTON = TTFont(os.path.join(HERE, "fonts/Anton.ttf"))
BARLOW = TTFont(os.path.join(HERE, "fonts/Barlow.ttf"))

BLACK, BLUE, BLUE_ON_LIGHT, WHITE = "#0B0D10", "#2F7BFF", "#1F5FE0", "#FFFFFF"


def run(font, text, size, x, baseline, tracking=0.0):
    """Return (path_d, width) for text at size px, starting at x, baseline y."""
    upm = font["head"].unitsPerEm
    s = size / upm
    gs = font.getGlyphSet()
    cmap = font.getBestCmap()
    hmtx = font["hmtx"]
    pen = SVGPathPen(gs)
    cx = x
    for i, ch in enumerate(text):
        g = cmap[ord(ch)]
        tp = TransformPen(pen, (s, 0, 0, -s, cx, baseline))
        gs[g].draw(tp)
        cx += hmtx[g][0] * s
        if i < len(text) - 1:
            cx += tracking * size
    return pen.getCommands(), cx - x


def width(font, text, size, tracking=0.0):
    return run(font, text, size, 0, 0, tracking)[1]


def cap_height(font, size):
    os2 = font["OS/2"]
    return os2.sCapHeight * size / font["head"].unitsPerEm


def known(size, x, baseline, outer, inner, tracking=0.025):
    """K(NOW)N wordmark as colored path elements."""
    parts, cx = [], x
    for seg, color in (("K", outer), ("NOW", inner), ("N", outer)):
        d, w = run(ANTON, seg, size, cx, baseline, tracking)
        parts.append(f'<path fill="{color}" d="{d}"/>')
        cx += w + tracking * size
    return "".join(parts), cx - x - tracking * size


def save(name, w, h, body, png_widths=(1200,)):
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" '
           f'width="{w:.0f}" height="{h:.0f}">{body}</svg>\n')
    with open(os.path.join(OUT, name + ".svg"), "w") as f:
        f.write(svg)
    for pw in png_widths:
        cairosvg.svg2png(bytestring=svg.encode(), write_to=os.path.join(OUT, "png", f"{name}-{pw}.png"),
                         output_width=pw)


def lockup(outer, inner, sub, tagline_color=None, bg=None):
    size, pad = 200, 60
    kw = width(ANTON, "KNOWN", size, 0.025)
    ch = cap_height(ANTON, size)
    sub_size = 50
    sub_track = (kw - width(BARLOW, "GOOD MEDIA", sub_size)) / (sub_size * 9)  # stretch to wordmark width
    W = kw + pad * 2
    base1 = pad + ch
    base2 = base1 + 28 + cap_height(BARLOW, sub_size)
    H = base2 + pad
    tag = ""
    if tagline_color:
        ts = 24
        base3 = base2 + 22 + cap_height(BARLOW, ts)
        tw = width(BARLOW, "GET KNOWN.", ts, 0.3)
        d, _ = run(BARLOW, "GET KNOWN.", ts, (W - tw) / 2, base3, 0.3)
        tag = f'<path fill="{tagline_color}" d="{d}"/>'
        H = base3 + pad
    word, real_w = known(size, (W - kw) / 2, base1, outer, inner)
    sw = width(BARLOW, "GOOD MEDIA", sub_size, sub_track)
    d, _ = run(BARLOW, "GOOD MEDIA", sub_size, (W - sw) / 2, base2, sub_track)
    rect = f'<rect width="{W:.0f}" height="{H:.0f}" rx="24" fill="{bg}"/>' if bg else ""
    return W, H, rect + word + f'<path fill="{sub}" d="{d}"/>' + tag


# 1-2. Full lockups (transparent) + a dark-card version with tagline
save("logo-on-dark", *lockup(WHITE, BLUE, WHITE))
save("logo-on-light", *lockup(BLACK, BLUE_ON_LIGHT, BLACK))
save("logo-card-dark", *lockup(WHITE, BLUE, WHITE, BLUE, BLACK))

# 3. Horizontal watermark (for video corner): wordmark + stacked GOOD / MEDIA
size = 120
ch = cap_height(ANTON, size)
word, ww = known(size, 0, ch, WHITE, BLUE)
ss = 30
g, gw = run(BARLOW, "GOOD", ss, ww + 22, ch * 0.45, 0.28)
m, mw = run(BARLOW, "MEDIA", ss, ww + 22, ch, 0.28)
save("watermark", ww + 22 + max(gw, mw) + 4, ch + 2,
     word + f'<path fill="{WHITE}" d="{g}"/><path fill="{WHITE}" d="{m}"/>', (600, 1200))

# 4. Silent-K icon (square)
S = 512
ks = 340
kch = cap_height(ANTON, ks)
kw_ = width(ANTON, "K", ks)
d, _ = run(ANTON, "K", ks, (S - kw_) / 2, 70 + kch)
bar_w, bar_h = 170, 26
save("icon-k", S, S,
     f'<rect width="{S}" height="{S}" rx="72" fill="{BLACK}"/><path fill="{WHITE}" d="{d}"/>'
     f'<rect x="{(S - bar_w) / 2:.1f}" y="{70 + kch + 34:.1f}" width="{bar_w}" height="{bar_h}" fill="{BLUE}"/>',
     (512, 1024))

# 5. Round avatar for social profiles
A = 1024
aw_size = 290
word_w = width(ANTON, "KNOWN", aw_size, 0.025)
ach = cap_height(ANTON, aw_size)
word, _ = known(aw_size, (A - word_w) / 2, (A + ach) / 2, WHITE, BLUE)
save("avatar", A, A,
     f'<circle cx="{A/2}" cy="{A/2}" r="{A/2}" fill="{BLUE}"/>'
     f'<circle cx="{A/2}" cy="{A/2}" r="{A/2 - 34}" fill="{BLACK}"/>' + word, (400, 1024))

print("done")
