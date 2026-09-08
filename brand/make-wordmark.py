#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Builds brand/syvt-og.svg, the Open Graph artwork for the game.

Usage:  python brand/make-wordmark.py
Needs, for rendering only and never at runtime:  pip install fonttools brotli
(brotli is what lets fontTools open the woff2.)

The artwork is the WORDMARK ALONE on the plate, in flat cream. Not the mark:
the name already contains the funnel, and the first rule in
../SYVT/assets/brand/BRAND.md is that the mark and the wordmark never appear
together in one lockup. The only exception the spec allows is a store listing,
where the platform lays its own icon over the graphic, and a link preview is
not one.

So this follows the Play feature graphic, which is the one place the spec puts
the name on a wide plate: Fredoka, flat cream, no gradient, on an off-centre
variant of the plate glow. A share card and the store banner then look like
what they are, two crops of the same picture.

The letters are emitted as Fredoka OUTLINES rather than <text>, so the artwork
renders identically anywhere and needs no font resolved at render time - which
is also what lets make-icons.mjs rasterise it with sharp. The Y is not a glyph
at all: it is assets/brand/syvt-glyph-y.svg, the icon's own funnel with the
card knocked out of it, carried here verbatim and filled in the letters'
colour.

That conversion is one-way, so this script is the only way back: if the game
is ever renamed, change LEAD and TAIL below and re-run, then re-run
make-icons.mjs to refresh og.png.
"""
import io
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

# The name, either side of the funnel. The funnel IS the Y; it is not a glyph
# and never comes from the font.
LEAD, TAIL = "S", "VT"
FONT = "fredoka.woff2"
GLYPH_Y = "../SYVT/assets/brand/syvt-glyph-y.svg"
OUT = "brand/syvt-og.svg"

W, H = 1200, 630

# BRAND.md section 1. The plate's three stops, and the flat cream the store
# media set the name in.
PLATE_CORE, PLATE_MID, PLATE_RIM = "#6E42EE", "#2A1B84", "#08102C"
CREAM = "#FFF7E6"

# BRAND.md section 2, "the Play feature graphic ... deliberately off-centre".
# A Flutter RadialGradient with center Alignment(-.28, -.1) and radius .95,
# and Flutter resolves that radius against the SHORTEST side. Alignment -1 is
# the near edge and +1 the far one, so the centre in fractions of the box is
# (a + 1) / 2: 36% across and 45% down.
GLOW_X, GLOW_Y = 0.36, 0.45
GLOW_R = 0.95                    # of the shortest side

# BRAND.md section 4.
TRACKING = 0.22                  # em, and it is never anything else
CAP_FACTOR = 0.71                # Fredoka, the app's optical figure, not 0.700
WGHT_LEAD, WGHT_TAIL = 620, 700  # the S is lighter; 700 is where the axis stops
WDTH = 100                       # never leave this to the font's default

FONT_SIZE = 132                  # px on the 1200x630 canvas

# The Y's box, from syvt-glyph-y.svg's viewBox "12 20 96 88". The drawn shape
# fills the box exactly - BRAND.md section 4 gives boxUnits 88, inkUnits 88 and
# inkTopUnits 0 - so the box IS the ink's box and there is no drop to correct.
# The 4.28 units of optical side bearing inside it are deliberate and inherited.
Y_VB_X, Y_VB_Y, Y_VB_W, Y_VB_H = 12.0, 20.0, 96.0, 88.0

# How far the drawn ink sits inside that box on each side. BRAND.md section 3
# gives the rounded glyph's bounding box as x 16.281470 to 103.718530 against
# a nominal 12 to 108, so 4.281470 units at each end are the optical side
# bearing the letter carries, and a layout has to measure gaps to the ink
# rather than to the box.
Y_INK_INSET = 4.281470


def y_path():
    """The funnel path out of syvt-glyph-y.svg, so this file never redraws it."""
    svg = io.open(GLYPH_Y, encoding="utf-8").read()
    start = svg.index(' d="', svg.index("<path")) + 4
    return svg[start:svg.index('"', start)]


def face(weight):
    """Fredoka pinned to one instance. BOTH axes, every time: the wght default
    is 300 and a wdth left unwritten silently inherits whatever it was."""
    return instancer.instantiateVariableFont(
        TTFont(FONT), {"wght": weight, "wdth": WDTH}
    )


lead_font, tail_font = face(WGHT_LEAD), face(WGHT_TAIL)
upem = lead_font["head"].unitsPerEm
em = float(FONT_SIZE)
k = em / upem                    # px per font unit
track = TRACKING * em

# The Y stands on the baseline at cap height, and is 96/88 as wide as it is
# tall. BRAND.md section 4, "Sizing the Y from the cap height".
y_h = CAP_FACTOR * em
y_w = y_h * Y_VB_W / Y_VB_H
y_scale = y_h / Y_VB_H


def run(font, text, x):
    """SVG path commands for `text` set from x, its ink edges, and the pen's
    end position. Letter-spacing goes after every letter, including the last;
    the lockup is centred on its ink afterwards, which is what absorbs the
    trailing space that BRAND.md's padding-left trick absorbs in CSS."""
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    parts, pen_x, left, right = [], x, None, None
    for ch in text:
        glyph = glyphs[cmap[ord(ch)]]
        pen = SVGPathPen(glyphs)
        # y-flip: font units go up, SVG goes down. Baseline sits at y = 0.
        glyph.draw(TransformPen(pen, Transform(k, 0, 0, -k, pen_x, 0)))
        if pen.getCommands():
            parts.append(pen.getCommands())
        bounds = BoundsPen(glyphs)
        glyph.draw(bounds)
        if bounds.bounds:
            lo, hi = pen_x + bounds.bounds[0] * k, pen_x + bounds.bounds[2] * k
            left = lo if left is None else min(left, lo)
            right = hi if right is None else max(right, hi)
        pen_x += glyph.width * k + track
    return parts, left, right, pen_x


# What the tracking is worth as a gap BETWEEN INK, measured inside the tail
# run where it is nothing but tracking and two real side bearings.
#
# This, and not a fixed em figure, is what the Y is spaced by. BRAND.md's own
# CSS block gives the Y margins of 0.092 em and 0.312 em, but those do not
# reproduce the app: measured off store/play/screenshot-1-start.png, which is
# _Brand's own render, the three ink gaps come out 25, 26 and 25 px - equal -
# while the same lockup built from those margins in a browser gives 0.370,
# 0.372 and 0.262 em. The spec's stated intent, "measured from the render
# until the gaps either side were even", is what is reproduced here; its two
# numbers are not.


def side_bearings(font, ch):
    glyphs, cmap = font.getGlyphSet(), font.getBestCmap()
    glyph = glyphs[cmap[ord(ch)]]
    pen = BoundsPen(glyphs)
    glyph.draw(pen)
    return pen.bounds[0] * k, (glyph.width - pen.bounds[2]) * k, glyph.width * k


if len(TAIL) >= 2:
    _, v_rsb, _ = side_bearings(tail_font, TAIL[0])
    t_lsb, _, _ = side_bearings(tail_font, TAIL[1])
    target = v_rsb + track + t_lsb
else:
    target = track

y_inset = Y_INK_INSET / Y_VB_H * y_h          # the Y's own bearing, in px

lead, lead_l, lead_r, _ = run(lead_font, LEAD, 0.0)
y_x = lead_r + target - y_inset               # box left, so the INK gaps match
v_lsb, _, _ = side_bearings(tail_font, TAIL[0])
tail_x = (y_x + y_w - y_inset) + target - v_lsb
tail, _, tail_r, _ = run(tail_font, TAIL, tail_x)

# Centred on the ink. The Y's own ink sits inside its box, so the extremes are
# always the first and last letter.
ink_w = tail_r - lead_l
word_x = (W - ink_w) / 2 - lead_l
# Centred on the band the lockup actually fills, which is the Y's box: it is
# the tallest part, cap height plus the optical correction.
base = H / 2 + y_h / 2

glow_r = GLOW_R * min(W, H)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-label="SYVT">
  <title>SYVT</title>
  <!-- Open Graph artwork, {W}x{H}. GENERATED by brand/make-wordmark.py - edit
       that, not this.

       The wordmark alone: the name contains the funnel, so the mark is never
       shown beside it (BRAND.md rule 1). The plate is the feature graphic's
       off-centre variant of the brand glow, and the letters are Fredoka
       converted to outlines, so nothing here needs a font at render time. The
       Y is assets/brand/syvt-glyph-y.svg verbatim, filled in the letters' own
       cream - it carries no colour of its own, ever. -->
  <defs>
    <radialGradient id="plate" gradientUnits="userSpaceOnUse"
                    cx="{GLOW_X * W:.2f}" cy="{GLOW_Y * H:.2f}" r="{glow_r:.2f}">
      <stop offset="0" stop-color="{PLATE_CORE}"/>
      <stop offset=".55" stop-color="{PLATE_MID}"/>
      <stop offset="1" stop-color="{PLATE_RIM}"/>
    </radialGradient>
  </defs>
  <rect width="{W}" height="{H}" fill="url(#plate)"/>
  <g fill="{CREAM}">
    <g transform="translate({word_x:.2f} {base:.2f})">
      <path d="{' '.join(lead)}"/>
      <path d="{' '.join(tail)}"/>
    </g>
    <!-- the funnel as the Y, standing on the baseline at cap height; the
         even-odd rule is what keeps the card a hole rather than filling it -->
    <g transform="translate({word_x + y_x:.2f} {base - y_h:.2f}) scale({y_scale:.6f}) translate({-Y_VB_X:.0f} {-Y_VB_Y:.0f})">
      <path d="{y_path()}" fill-rule="evenodd"/>
    </g>
  </g>
</svg>
'''

io.open(OUT, "w", encoding="utf-8", newline="\n").write(svg)
print('%s  "%s+Y+%s"  Fredoka %g/%g  size %g  ink gap %.2fpx (%.4f em)  '
      'ink %.1fpx wide, %.1f%% of the canvas'
      % (OUT, LEAD, TAIL, WGHT_LEAD, WGHT_TAIL, FONT_SIZE, target, target / em,
         ink_w, 100 * ink_w / W))
