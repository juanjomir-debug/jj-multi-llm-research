"""
Generates ReliableAI app icon (1024x1024 + all required iOS/Android sizes).
Design: dark background, hexagonal neural-network node ring in brand orange (#CF7D4E),
bright central node with a bold white checkmark — represents "multiple models, one reliable answer".
"""

from PIL import Image, ImageDraw, ImageFont
import math, os, sys, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")


def flatten(rgba: "Image.Image") -> "Image.Image":
    """Composite an RGBA icon onto an opaque brand-color square and drop the
    alpha channel. App Store / iOS icons MUST NOT contain transparency."""
    base = Image.new("RGB", rgba.size, BG[:3])
    base.paste(rgba, (0, 0), rgba)
    return base

SIZE   = 1024
CX, CY = SIZE // 2, SIZE // 2

# ── Brand palette ─────────────────────────────────────────────────────────────
BG          = (22,  22,  22,  255)
ORANGE      = (207, 125,  78,  255)
ORANGE_LT   = (235, 155,  100, 255)
ORANGE_DK   = (155,  88,  48,  255)
SPOKE_CLR   = (207, 125,  78,  70)
RING_CLR    = (207, 125,  78,  50)
GLOW1       = (207, 125,  78,  30)
GLOW2       = (207, 125,  78,  60)
WHITE       = (255, 255,  255,  255)
WHITE_FAINT = (255, 255,  255,  180)

def make_icon(size=1024) -> Image.Image:
    img  = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    s    = size / 1024  # scale factor

    # ── Background (dark rounded square) ──────────────────────────────────────
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1],
        radius=int(220 * s),
        fill=BG,
    )

    cx, cy = size // 2, size // 2

    # ── Hex ring parameters ───────────────────────────────────────────────────
    ring_r   = int(292 * s)   # radius of outer nodes
    node_r   = int(46  * s)   # outer node circle radius
    cnode_r  = int(108 * s)   # center node radius
    lw_spoke = max(2, int(12  * s))
    lw_ring  = max(2, int(8   * s))

    hex_pts = [
        (cx + ring_r * math.cos(math.radians(i * 60 - 30)),
         cy + ring_r * math.sin(math.radians(i * 60 - 30)))
        for i in range(6)
    ]

    # ── Spokes (center → each outer node) ────────────────────────────────────
    for (x, y) in hex_pts:
        draw.line([(cx, cy), (x, y)], fill=SPOKE_CLR, width=lw_spoke)

    # ── Hex ring edges ─────────────────────────────────────────────────────────
    for i in range(6):
        x1, y1 = hex_pts[i]
        x2, y2 = hex_pts[(i + 1) % 6]
        draw.line([(x1, y1), (x2, y2)], fill=RING_CLR, width=lw_ring)

    # ── Outer nodes ───────────────────────────────────────────────────────────
    for (x, y) in hex_pts:
        # glow halos
        for extra, alpha in [(int(18*s), 28), (int(10*s), 55)]:
            r = node_r + extra
            draw.ellipse([x-r, y-r, x+r, y+r], fill=(*ORANGE[:3], alpha))
        # body
        draw.ellipse([x-node_r,   y-node_r,   x+node_r,   y+node_r],   fill=ORANGE_DK)
        draw.ellipse([x-node_r+int(7*s), y-node_r+int(7*s),
                      x+node_r-int(7*s), y+node_r-int(7*s)], fill=ORANGE)

    # ── Center node ───────────────────────────────────────────────────────────
    for extra, alpha in [(int(26*s), 22), (int(14*s), 45), (int(6*s), 70)]:
        r = cnode_r + extra
        draw.ellipse([cx-r, cy-r, cx+r, cy+r], fill=(*ORANGE[:3], alpha))
    draw.ellipse([cx-cnode_r, cy-cnode_r, cx+cnode_r, cy+cnode_r], fill=ORANGE_DK)
    inner_r = cnode_r - int(14 * s)
    draw.ellipse([cx-inner_r, cy-inner_r, cx+inner_r, cy+inner_r], fill=ORANGE_LT)

    # ── Checkmark inside center node ─────────────────────────────────────────
    # Two segments: short arm bottom-left, long arm upper-right
    ck  = int(44 * s)   # half-width reference
    ck_lw = max(2, int(14 * s))
    p0 = (cx - ck,         cy + int(4  * s))  # left end
    p1 = (cx - int(12*s),  cy + ck)           # bottom tip
    p2 = (cx + ck,         cy - ck)           # top right
    draw.line([p0, p1], fill=WHITE, width=ck_lw)
    draw.line([p1, p2], fill=WHITE, width=ck_lw)
    # Smooth the corner joint with a filled circle
    jcr = ck_lw // 2
    draw.ellipse([p1[0]-jcr, p1[1]-jcr, p1[0]+jcr, p1[1]+jcr], fill=WHITE)

    return img


# ── Generate master 1024×1024 ─────────────────────────────────────────────────
out_dir = r"C:\Users\juanj\OneDrive\Desktop\ReliableAi\reliableai\public"
master  = make_icon(1024)
flatten(master).save(os.path.join(out_dir, "icon-1024.png"))
print("OK icon-1024.png (flattened RGB, no alpha)")

# ── iOS required sizes (App Store + all device sizes) ─────────────────────────
ios_sizes = [
    ("icon-1024.png",        1024),   # App Store listing
    ("apple-touch-icon-180.png", 180),  # home screen @3x iPhone
    ("icon-167.png",          167),   # iPad Pro @2x
    ("icon-152.png",          152),   # iPad @2x
    ("icon-120.png",          120),   # iPhone @3x / @2x
    ("icon-87.png",            87),   # iPhone @3x settings
    ("icon-80.png",            80),   # iPhone @2x / iPad @2x spotlight
    ("icon-76.png",            76),   # iPad @1x
    ("icon-60.png",            60),   # iPhone @2x
    ("icon-58.png",            58),   # iPhone @2x settings
    ("icon-40.png",            40),   # spotlight @2x
    ("icon-29.png",            29),   # settings @1x
    ("icon-20.png",            20),   # notifications @2x
]

for filename, sz in ios_sizes:
    if sz == 1024:
        continue                     # already saved above
    resized = flatten(master.resize((sz, sz), Image.LANCZOS))
    resized.save(os.path.join(out_dir, filename))
    print(f"OK {filename} ({sz}x{sz})")

# ── Web/PWA sizes ─────────────────────────────────────────────────────────────
for filename, sz in [("icon-512.png", 512), ("icon-192.png", 192)]:
    resized = flatten(master.resize((sz, sz), Image.LANCZOS))
    resized.save(os.path.join(out_dir, filename))
    print(f"OK {filename} ({sz}x{sz})")

print("\nAll icons generated (RGB, no transparency).")
