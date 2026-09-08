#!/usr/bin/env node
/**
 * Renders SYVT's raster assets from the vector originals:
 *   apple-touch-icon.png  180×180   (iOS/Android home screen)
 *   og.png               1200×630   (link previews)
 *
 * Usage:  node make-icons.mjs
 * Needs sharp, for rendering only, never at runtime:  npm install sharp
 * (fr/make-icons.mjs does the same job with Playwright; sharp is enough here
 * because both sources are pure geometry — the wordmark in brand/syvt-og.svg
 * is already converted to outlines, so no font has to be resolved.)
 *
 * Both PNGs are DERIVED. Edit the SVGs, never the PNGs, and re-run:
 *   icon.svg           -> apple-touch-icon.png
 *   brand/syvt-og.svg  -> og.png
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
    transform: fullBleed, flattenTo: '#08102C' },
  { from: join(DIR, 'brand', 'syvt-og.svg'), to: join(DIR, 'og.png'), w: 1200, h: 630 }
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
