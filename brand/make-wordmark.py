#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Builds brand/syvt-og.svg, the Open Graph artwork for the game.

Usage:  python brand/make-wordmark.py
Needs, for rendering only and never at runtime:  pip install fonttools brotli
(brotli is what lets fontTools open the woff2.)

The lockup is the app's: the mark on the left, then S, the funnel as the Y,
VT — on the deep violet plate the launcher icon and the legal pages use, in
cream. It is the header of privacy.html at poster size, which is the point:
a link preview should look like the page it opens.

The letters are emitted as Manrope ExtraBold OUTLINES rather than <text>, so
the artwork renders identically anywhere and needs no font resolved at render
time - which is also what lets make-icons.mjs rasterise it with sharp. The
funnel is geometry either way.

That conversion is one-way, so this script is the only way back: if the game
is renamed, change LEAD and TAIL below and re-run, then re-run make-icons.mjs
to refresh og.png.
"""
import io
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

# The name, either side of the funnel. The funnel IS the Y; it is not a
# glyph and never comes from the font.
LEAD, TAIL = "S", "VT"
FONT = "manrope.woff2"
OUT = "brand/syvt-og.svg"

W, H = 1200, 630

# The app's palette, from lib/ui/marks.dart by way of legal.css.
PLATE_TOP, PLATE_MID, PLATE_BOT = "#5F36D0", "#4A27AE", "#37198A"
CREAM, WRONG, RIGHT = "#FFF7E6", "#FB7185", "#2DD4BF"
SUN, INK, WHITE = "#FFD54A", "#1E2646", "#FFFFFF"

WEIGHT = 800           # Manrope's wght axis, same as #brand
TRACKING = 0.22        # em, same as #brand's letter-spacing
CAP_PX = 116           # cap height of the wordmark on the 1200x630 canvas
MARK_PX = 300          # the mark's drawn height
GAP = 78               # space between mark and wordmark

# The funnel glyph, in its own 96x82 box: the narrow rim, no ball. Its paths
# are copied from ../SYVT/assets/brand/syvt-glyph-y.svg, whose viewBox starts
# at (12, 28) rather than the origin, so that corner is carried here too.
#
# The ink spans 2 units below the box top to 2 above its foot - the round caps
# reach 8 above the rim's centre line and the spout ends 2 short of the bottom
# - so 78 of the 82 units are ink, and it is the INK that is set at cap
# height, standing on the baseline. Same as SyvtYPainter in the app.
Y_BOX_X, Y_BOX_Y = 12.0, 28.0
Y_BOX_W, Y_BOX_H = 96.0, 82.0
Y_INK_TOP, Y_INK_H = 2.0, 78.0
# Its ink edges across, in the same box space once that corner is at the
# origin: the arms' centre lines run from x 24 to 96 and the round caps add
# half the 16-unit stroke to each end, so 16..104 of the viewBox, 4..92 here.
Y_INK_L, Y_INK_R = 4.0, 92.0

font = instancer.instantiateVariableFont(TTFont(FONT), {"wght": WEIGHT})
upem = font["head"].unitsPerEm
cmap = font.getBestCmap()
glyphs = font.getGlyphSet()
cap = font["OS/2"].sCapHeight

k = CAP_PX / cap          # px per font unit, so the cap height lands on CAP_PX
em = upem * k             # what one em is worth in px at this size
track = TRACKING * em

# The funnel at cap height: scale its box so the INK is CAP_PX tall.
y_scale = CAP_PX / Y_INK_H
y_w, y_h = Y_BOX_W * y_scale, Y_BOX_H * y_scale


def ink(ch):
    """(left, right) ink edges of one glyph in px, from its own origin."""
    pen = BoundsPen(glyphs)
    glyphs[cmap[ord(ch)]].draw(pen)
    return pen.bounds[0] * k, pen.bounds[2] * k


def outlines(text, x):
    """SVG path commands for `text` set from x, plus its ink edges.

    Letter-spacing goes BETWEEN the letters of a run and not after the last
    one, the way #brand's negative margin-right cancels the trailing track.
    """
    parts, pen_x = [], x
    left = right = None
    for i, ch in enumerate(text):
        glyph = glyphs[cmap[ord(ch)]]
        # y-flip: font units go up, SVG goes down. Baseline sits at y = 0.
        pen = SVGPathPen(glyphs)
        glyph.draw(TransformPen(pen, Transform(k, 0, 0, -k, pen_x, 0)))
        if pen.getCommands():
            parts.append(pen.getCommands())
        a, b = ink(ch)
        left = pen_x + a if left is None else left
        right = pen_x + b
        pen_x += glyph.width * k
        if i < len(text) - 1:
            pen_x += track
    return parts, left, right


# What the tracking is worth as a GAP BETWEEN INK, measured inside the tail
# run: the funnel is a shape and not a glyph, so it has no side bearings of
# its own, and spacing it by the letters' advance would leave it swimming.
# Setting its two ink gaps to this one is what legal.css arrived at by
# measurement for the same lockup in the page header.
if len(TAIL) >= 2:
    a_adv = glyphs[cmap[ord(TAIL[0])]].width * k
    target = (a_adv + track + ink(TAIL[1])[0]) - ink(TAIL[0])[1]
else:
    target = track

lead, lead_l, lead_r = outlines(LEAD, 0.0)
y_x = lead_r + target - Y_INK_L * y_scale          # the funnel's box, left edge
tail_x = (y_x + Y_INK_R * y_scale) + target - ink(TAIL[0])[0]
tail, _, tail_r = outlines(TAIL, tail_x)

# Centred on the INK, not on the advance widths: the artwork has no text
# around it for side bearings to line up with.
word_w = tail_r - lead_l
total_w = MARK_PX + GAP + word_w
x0 = (W - total_w) / 2                     # the lockup, centred
base = H / 2 + CAP_PX / 2                  # the letters' baseline
word_x = x0 + MARK_PX + GAP - lead_l

# The funnel stands on the baseline and reaches cap height, so its ink bottom
# is the baseline: box top = baseline - cap - the ink's own top inset.
y_top = base - CAP_PX - Y_INK_TOP * y_scale

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
  <title>SYVT</title>
  <!-- Open Graph artwork, {W}x{H}. GENERATED by brand/make-wordmark.py - edit
       that, not this. The mark is brand/syvt-mark.svg unit for unit, and the
       funnel between the letters is its narrow cut, the app's Y. The letters
       are Manrope wght {WEIGHT} at {TRACKING}em tracking, converted to outlines, so
       nothing here needs a font at render time. -->
  <defs>
    <linearGradient id="plate" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="{PLATE_TOP}"/>
      <stop offset=".55" stop-color="{PLATE_MID}"/>
      <stop offset="1" stop-color="{PLATE_BOT}"/>
    </linearGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#plate)"/>
  <g transform="translate({x0:.2f} {(H - MARK_PX) / 2:.2f}) scale({MARK_PX / 120.0:.5f})">
    <g fill="none" stroke-width="16" stroke-linecap="round">
      <path d="M14 38L51 76" stroke="{WRONG}"/>
      <path d="M106 38L69 76" stroke="{RIGHT}"/>
    </g>
    <rect x="47" y="72" width="26" height="36" rx="11" fill="{WHITE}"/>
    <circle cx="60" cy="28" r="24" fill="{SUN}"/>
    <circle cx="51" cy="25" r="3.5" fill="{INK}"/>
    <circle cx="69" cy="25" r="3.5" fill="{INK}"/>
    <path d="M51 34q9 7 18 0" fill="none" stroke="{INK}" stroke-width="3.5" stroke-linecap="round"/>
  </g>
  <g transform="translate({word_x:.2f} {base:.2f})" fill="{CREAM}">
    <path d="{' '.join(lead)}"/>
    <path d="{' '.join(tail)}"/>
  </g>
  <!-- The funnel as the Y; its spout takes the wordmark's ink, not white.
       The paths are the app's own, so they are in the glyph's viewBox space
       (12 28 96 82) and the inner translate brings that box's corner to the
       origin - which is what the outer transform then places. -->
  <g transform="translate({word_x + y_x:.2f} {y_top:.2f}) scale({y_scale:.5f}) translate({-Y_BOX_X:.0f} {-Y_BOX_Y:.0f})">
    <g fill="none" stroke-width="16" stroke-linecap="round">
      <path d="M24 38L51 76" stroke="{WRONG}"/>
      <path d="M96 38L69 76" stroke="{RIGHT}"/>
    </g>
    <rect x="47" y="72" width="26" height="36" rx="11" fill="{CREAM}"/>
  </g>
</svg>
'''

io.open(OUT, "w", encoding="utf-8", newline="\n").write(svg)
print('%s  "%s+Y+%s"  ink gaps %.2fpx  wordmark %.1fpx wide  lockup %.1fpx'
      % (OUT, LEAD, TAIL, target, word_w, total_w))
