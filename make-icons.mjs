#!/usr/bin/env node
/**
 * Renders SYVT's raster assets from the vector originals:
 *   apple-touch-icon.png  180×180   (iOS/Android home screen)
 * the link preview from the app's own key art, brand/syvt-feature-1024x500.png:
 *   og.png               1200×630   (link previews)
 * and the favicon set from the mascot master, brand/favicon_drk.webp:
 *   favicon.ico          16, 32, 48 (browser tab, Windows shortcuts)
 *   favicon-192.png      192×192    (Android home screen, big-PNG fallback)
 *   favicon-180.png      180×180    (iOS home screen, opaque)
 *
 * Usage:  node make-icons.mjs
 * Needs sharp, for rendering only, never at runtime:  npm install sharp
 * (fr/make-icons.mjs does the same job with Playwright; sharp is enough here
 * because both sources are pure geometry — the wordmark in brand/syvt-og.svg
 * is already converted to outlines, so no font has to be resolved.)
 *
 * Every output is DERIVED. Edit the masters, never the outputs, and re-run:
 *   icon.svg                        -> apple-touch-icon.png
 *   brand/syvt-feature-1024x500.png -> og.png
 *   brand/favicon_drk.webp          -> favicon.ico, favicon-192.png, favicon-180.png
 *
 * icon.svg is a byte-for-byte copy of the app's own assets/brand/syvt-icon.svg
 * and is fully self-coloured: no currentColor, no media query, no CSS custom
 * property. That is deliberate, and it is what lets a rasteriser turn it into
 * a PNG with no context. The violet plate is its own ground and reads under
 * either browser theme, so there is nothing here for a light scheme to
 * override.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = require('sharp');
} catch {
  console.error('sharp is missing. Install it once:  npm install sharp');
  process.exit(1);
}

const DIR = dirname(fileURLToPath(import.meta.url));   // repo root

/* apple-touch-icon.png is the FULL-BLEED plate, not the rounded one.

   iOS masks a home-screen icon itself, with its own superellipse, and expects
   an opaque square to mask. Hand it icon.svg as it stands - rx="31", corners
   transparent - and the two roundings compound: the corners iOS does not cut
   are already cut, and what shows through them is black. BRAND.md section 2
   names the radius-0 variant as the iOS source for exactly this reason.

   So the same master is used and its one corner radius dropped, which is what
   "the full-bleed variant" means; then the alpha is flattened onto the plate's
   rim colour, the value the gradient clamps to in the corners anyway, so the
   square is opaque without changing a pixel anyone sees.

   The browser-tab favicon is a different job with a different answer: there
   the rounded, transparent icon.svg is right, and it is linked as-is. */
const fullBleed = (svg) => Buffer.from(String(svg).replace(' rx="31"', ' rx="0"'));

const JOBS = [
  { from: join(DIR, 'icon.svg'), to: join(DIR, 'apple-touch-icon.png'), w: 180, h: 180,
    transform: fullBleed, flattenTo: '#08102C' }
];

for (const { from, to, w, h, transform, flattenTo } of JOBS) {
  const svg = transform ? transform(await readFile(from)) : await readFile(from);
  // density scales the SVG's own units up before rasterising, so curves and
  // the round caps are resolved at the output size rather than upscaled
  let pipe = sharp(svg, { density: 384 })
    .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  if (flattenTo) pipe = pipe.flatten({ background: flattenTo });
  const png = await pipe.png({ compressionLevel: 9 }).toBuffer();
  await writeFile(to, png);
  console.log(`${to.replace(DIR + '\\', '').replace(DIR + '/', '')}  ${w}×${h}  ${png.length} bytes`);
}

/* ---- the link preview -----------------------------------------------------

   og.png is the app's Play feature graphic, which is the current key art:
   the wordmark, SYVT himself at the sorting pit, and a corner of each world
   behind him. It replaces the wordmark alone on the violet plate, because a
   link preview is the one place the game gets to show what it is before
   anybody taps anything, and a name on a plate shows nothing.

   It does not break the rule that the mark and the name never appear
   together (BRAND.md section 2). The mark is the funnel with the two
   triangles; what the key art carries is the wordmark, whose Y IS that
   funnel with the card knocked out and the triangles dropped, and no second
   copy of it stands beside the name.

   brand/syvt-og.svg and brand/make-wordmark.py stay where they are. They are
   the only place the lockup exists as outlines rather than as live type, and
   putting the plate back is this job's two lines - the same swap the tab
   icon is kept ready for in index.html.

   1024x500 is not 1200x630, so the art is scaled to cover and the 45 px it
   over-runs is taken off each side: the castle's outer wall at the left and
   a sliver of the phone at the right, neither of which is the picture. The
   upscale is 1.26x, which lanczos carries at the size a preview is shown
   at. */
const FEATURE = join(DIR, 'brand', 'syvt-feature-1024x500.png');
{
  const og = await sharp(FEATURE)
    .resize(1200, 630, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    // effort 10 lets libvips look for a palette, which this art has: flat
    // fills and short ramps quantise to 256 colours with nothing visible
    // lost, and the file goes from 1.3 MB to just over 200 KB
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer();
  await writeFile(join(DIR, 'og.png'), og);
  console.log(`og.png  1200\u00d7630  ${og.length} bytes`);
}

/* ---- the favicon set, from the mascot master ------------------------------

   brand/favicon_drk.webp is a raster, not geometry, so it is handled apart
   from the SVG jobs above. It is the mascot on a rounded navy plate with the
   corners already transparent, which is the right shape for a browser tab
   (see the note on apple-touch-icon.png above) and the wrong one for iOS.

   The plate does not fill its canvas. It sits in transparent margins of
   uneven width, and it is a few pixels shorter than it is wide - 1183 by
   1167 in the master. So the first step finds the plate's own alpha box and
   the outputs are rendered from that box straight into a square, stretched
   by that 1.4 %, which no eye can see, rather than padded, which would
   leave the top and bottom edges soft where the sides are crisp. */
const MASCOT = join(DIR, 'brand', 'favicon_drk.webp');

/* The plate's rim, sampled from the master on the ring just inside each
   corner arc: about #011C73 at the top corners and #01125A at the bottom
   ones. favicon-180.png is flattened onto that as a vertical gradient, for
   the reason apple-touch-icon.png is flattened: iOS masks with its own
   superellipse, and the sliver between its curve and the plate's own arc
   must be the plate's colour, not black. */
const RIM_TOP = '#011C73';
const RIM_BOTTOM = '#01125A';

async function plateBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 8 of 255 ignores the faint halo the export left around the plate
      if (data[(y * width + x) * channels + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

// the plate, cut from the master and resized to a size × size square
const plate = (box, size) =>
  sharp(MASCOT).ensureAlpha().extract(box).resize(size, size, { fit: 'fill', kernel: 'lanczos3' });

/* Writes a classic .ico: one 32-bit DIB per size, rows bottom-up as the
   format wants, and the 1-bit AND mask set wherever the pixel is fully
   transparent, for anything old enough to read the mask before the alpha.
   PNG-in-ICO would be shorter to write and is not read by everything that
   reads an .ico, and the whole file is fifteen kilobytes either way. */
function ico(frames) {
  const dir = Buffer.alloc(6 + 16 * frames.length);
  dir.writeUInt16LE(0, 0);               // reserved
  dir.writeUInt16LE(1, 2);               // type: icon
  dir.writeUInt16LE(frames.length, 4);
  const images = [];
  let offset = dir.length;
  frames.forEach(({ size, rgba }, i) => {
    const stride = size * 4;                       // 32 bpp rows are already 4-byte aligned
    const maskStride = Math.ceil(size / 32) * 4;   // 1 bpp rows pad to 4 bytes
    const xor = Buffer.alloc(stride * size);
    const and = Buffer.alloc(maskStride * size);
    for (let y = 0; y < size; y++) {
      const srcRow = (size - 1 - y) * stride;      // DIB rows run bottom-up
      for (let x = 0; x < size; x++) {
        const s = srcRow + x * 4, d = y * stride + x * 4;
        xor[d] = rgba[s + 2];                      // B
        xor[d + 1] = rgba[s + 1];                  // G
        xor[d + 2] = rgba[s];                      // R
        xor[d + 3] = rgba[s + 3];                  // A
        if (rgba[s + 3] === 0) and[y * maskStride + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
    const header = Buffer.alloc(40);               // BITMAPINFOHEADER
    header.writeUInt32LE(40, 0);
    header.writeInt32LE(size, 4);
    header.writeInt32LE(size * 2, 8);              // height counts the mask too
    header.writeUInt16LE(1, 12);                   // planes
    header.writeUInt16LE(32, 14);                  // bits per pixel
    header.writeUInt32LE(0, 16);                   // BI_RGB
    header.writeUInt32LE(xor.length + and.length, 20);
    const image = Buffer.concat([header, xor, and]);
    const e = 6 + 16 * i;
    dir.writeUInt8(size < 256 ? size : 0, e);
    dir.writeUInt8(size < 256 ? size : 0, e + 1);
    dir.writeUInt8(0, e + 2);                      // palette size: none
    dir.writeUInt8(0, e + 3);                      // reserved
    dir.writeUInt16LE(1, e + 4);                   // planes
    dir.writeUInt16LE(32, e + 6);                  // bits per pixel
    dir.writeUInt32LE(image.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    images.push(image);
    offset += image.length;
  });
  return Buffer.concat([dir, ...images]);
}

const report = (name, bytes, what) =>
  console.log(`${name}  ${what}  ${bytes.length} bytes`);

const box = await plateBox(MASCOT);

const frames = [];
for (const size of [16, 32, 48]) {
  const rgba = await plate(box, size).raw().toBuffer();
  frames.push({ size, rgba });
}
const icoBytes = ico(frames);
await writeFile(join(DIR, 'favicon.ico'), icoBytes);
report('favicon.ico', icoBytes, '16+32+48');

const png192 = await plate(box, 192).png({ compressionLevel: 9 }).toBuffer();
await writeFile(join(DIR, 'favicon-192.png'), png192);
report('favicon-192.png', png192, '192×192');

// the rim gradient the opaque touch icon is laid on
const rim = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180">` +
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
  `<stop offset="0" stop-color="${RIM_TOP}"/><stop offset="1" stop-color="${RIM_BOTTOM}"/>` +
  `</linearGradient></defs><rect width="180" height="180" fill="url(#g)"/></svg>`);
const png180 = await sharp(rim)
  .composite([{ input: await plate(box, 180).png().toBuffer() }])
  .removeAlpha()
  .png({ compressionLevel: 9 }).toBuffer();
await writeFile(join(DIR, 'favicon-180.png'), png180);
report('favicon-180.png', png180, '180×180');
