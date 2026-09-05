# syvt.me

SYVT — a word game. Falling words: swipe right if one is spelled correctly,
left if it is not. Wrong calls pile up until the stack reaches the ceiling.
English, German (Swiss orthography) and French, with mental-arithmetic discs
mixed in.

The game **is** the site: `index.html` at the root, served by GitHub Pages.
It moved here from `y7.ai/SYVT/`; before that it was `y7.ai/SIFT/`, and before
that `y7.ai/spelling.html`. `404.html` doubles as the redirect table so every
one of those paths still lands on the game if someone tries it against this
domain.

## Still to set up

The repo half is done — `CNAME` pins the domain and `.nojekyll` serves files
as-is. The rest is in the GitHub UI and at the registrar:

- **Pages**: Settings → Pages → deploy from branch `main`, folder `/ (root)`.
- **DNS** for `syvt.me`: apex `A` records to the GitHub Pages addresses
  (185.199.108–111.153), and `www` as a `CNAME` to `syvt.me`.
- **HTTPS**: tick *Enforce HTTPS* once the certificate has been issued.

Note that a repository can only carry one custom domain, which is what the
`CNAME` file is — that is why this lives in its own repo rather than beside
y7.ai.

## Assets

`icon.svg` and `brand/syvt-mark.svg` are the masters; the mark is one drawing
reused at three sizes. The PNGs are **derived** — edit the SVGs and re-run:

```
npm install sharp          # once, for rendering only
node make-icons.mjs        # icon.svg -> apple-touch-icon.png, brand/syvt-og.svg -> og.png
```

The wordmark inside `brand/syvt-og.svg` is Manrope converted to outlines, so
the artwork needs no font at render time. That conversion is one-way, so if
the game is ever renamed again:

```
pip install fonttools brotli   # once
python brand/make-wordmark.py  # set WORD at the top first, then re-run make-icons.mjs
```

`matter.min.js` is the physics engine and `manrope.woff2` the typeface; both
are vendored so the page has no third-party origins at runtime, which is what
lets its Content-Security-Policy stay at `default-src 'none'`.
