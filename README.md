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

## Legal pages

`privacy.html` and `data_deletion.html`, sharing `legal.css`. Google Play needs
a privacy-policy URL before the Android app can be listed, and a deletion URL
alongside it; these are the two, and the contact address on both is
`hi@SYVT.me`. Both carry the same `default-src 'none'` policy as the game and
load nothing from a third party — not even a font, which on a privacy page
would hand the reader's IP address to whoever served it.

They are skinned in the **app's** palette, not this page's: the deep violet
plate, cream and the mint/coral verdict pair from `lib/ui/marks.dart` in the
Flutter repo, because these are the pages the Play listing links to and the
app icon is what a reader arrives from. `brand/syvt-app-mark-{192,64}.png` are
that icon, downsampled from the app's `store/play/icon-512.png`:

```
python -c "from PIL import Image; im=Image.open('../SYVT/store/play/icon-512.png').convert('RGBA'); [im.resize((n,n), Image.LANCZOS).save(f'brand/syvt-app-mark-{n}.png') for n in (192,64)]"
```

The wordmark in the header is built in HTML rather than drawn: Manrope
ExtraBold for S and VT with the funnel as an inline SVG in between, sized to
Manrope's cap height (exactly `.72em`) so it stands on the baseline like a
letter. Its two margins are measured, not derived — see the comment in
`legal.css`.

Keep both pages true to what the app actually does. The claims that matter, and
that would need editing if the app changed: no ads, no analytics, no crash
reporting, no third-party trackers; the account is optional and holds only
nicknames, avatars, scores and settings; Firestore is in the European
multi-region and the callable function in Zurich; and the app's own danger
zone (Settings for parents, held open at the bottom) deletes the account, its
backup and every player's statistics, with the email request kept only for
someone who cannot open the app.
