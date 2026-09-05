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
 * icon.svg follows the browser theme, but it declares dark as the default and
 * overrides for light, so a renderer that ignores media queries — this one,
 * and iOS, which has no theme for home-screen icons — still gets the dark
 * plate the app is built around.
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

const JOBS = [
  { from: join(DIR, 'icon.svg'), to: join(DIR, 'apple-touch-icon.png'), w: 180, h: 180 },
  { from: join(DIR, 'brand', 'syvt-og.svg'), to: join(DIR, 'og.png'), w: 1200, h: 630 }
];

for (const { from, to, w, h } of JOBS) {
  const svg = await readFile(from);
  // density scales the SVG's own units up before rasterising, so curves and
  // the round caps are resolved at the output size rather than upscaled
  const png = await sharp(svg, { density: 384 })
    .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
  await writeFile(to, png);
  console.log(`${to.replace(DIR + '\\', '').replace(DIR + '/', '')}  ${w}×${h}  ${png.length} bytes`);
}
