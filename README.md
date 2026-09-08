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

## The page is the app's free tier

The web game started as the original; the Android app grew out of it and then
past it. It has since been rebuilt the other way round — the page is now a
teaser for the app, and looks and plays like its free tier, so what a visitor
tries here is what they would install.

Same numbers, taken from the Flutter source and not re-tuned: the 420 × 746.67
design space, `kPerLevel = 30`, `fallSpeed(t) = 55 + 14t`,
`spawnInterval(t) = max(0.95, 2.3 − 0.27t)`, a word pool of this level and the
two below, 20 % sums from the same five generators, a 30-px swipe threshold,
1400 px/s of fly, 1000 px/s² of gravity, half a second of resting above the
line before the round ends. `--s` is the one factor that turns a design px
into a screen px; the stylesheet and the physics both read it, so what is
drawn and what is simulated cannot drift apart.

Where the app would sell SYVT+, the page says it is coming instead. The
Android app is not listed yet, so there is nowhere to send anyone: the line
under START is a plain sentence rather than a link, and the three gates
below open a card that says what SYVT+ is and that it is on its way, with
one button — the way out — rather than a second one that would open
nothing. The day it lists, `index.html` gets the two hrefs back and the
three `openModal` calls in `syvt.js` pass `showBuy` true again; the wording
of each string is what changes with them, and nothing else is.

- **Level 5** is the last free level, as on Android. At score 150 the round
  pauses and the notice comes up once; dismissing it carries on at level 5 for
  as long as the player likes.
- **Two worlds** are free, Day and Aquarium. The other four sit in the picker
  with a padlock, and tapping one opens the same notice.
- **Levels 1 and 2** are read out loud, as on Android. The chip beside the
  pause button switches the voice; on the way into level 3 it goes quiet and
  the chip dims, and a tap on it then pauses the round and opens the notice.

The score stops counting at 150, which is the same moment. Play does not stop
— the round runs until the stack reaches the ceiling — but every point after
that is won on level-five words, so it is not the same thing as a point won at
level ten. The overflow therefore runs in a second counter beside the score,
`150 | +13`, behind a hairline so the two can never be read as one number.
The whole total is what gets stored; the split is only how it is shown, and it
is shown the same way in the app.

Two smaller things follow from it. The level bar fills for the last time on
the way to level five and then stays full, rather than sweeping every thirty
points under a number that can never change. And the counter explains itself
only if asked: the SYVT+ notice at 150 mentions it in passing, and a small
"i" beside the counter on the game-over panel opens a short "Why 150?" that
answers the question without taking the chance to sell anything.

Two deliberate reductions from the app's free tier, both because a teaser has
nothing to protect: all three languages are open (the app keeps the first two
a device plays in), and there are no player profiles, so no avatars, no
statistics and no account — the best score is a `localStorage` number per
language.

## The voice

`voice.js` reads the falling words out loud, from the same corpus the app
uses — immutable, content-addressed clips on Cloudflare R2 at
`audio.syvt.me/tts/v1/`. It is a port of the app's `lib/voice/`, and the rules
are the app's: off means off (switched off it opens no connection and fetches
nothing at all), one word at a time with a waiting slot exactly one deep and
last in wins, and nothing interrupts a word except the round itself stopping.

Three things are the page's own, and each has its reason written where it is
done:

- **Nothing is hashed in the browser.** `make-words.py` computes every clip id
  by importing the app's own `tool/tts/speech_key.py`, and the page looks a
  word up rather than addressing it. A third implementation of the normaliser
  and the SHA-256 would be a third chance to drift from the other two, and a
  drifted hash does not throw — it misses every file and the voice goes quiet
  with no error anywhere.
- **One `<audio>` element for the page, unlocked on the START tap** with 52
  bytes of silence. iOS lifts its lock per element and only inside a user
  gesture, so a fresh element per word would be silent forever.
- **No CORS policy is needed on the bucket.** A media element fetches
  cross-origin without one, and the warm-up asks in `no-cors` mode and never
  reads a byte of what comes back — it only wants the file in the browser's
  cache, where the element will look for it. So the corpus stays exactly as
  the app left it; see `tool/tts/README.md` in the app repo.

Nothing is fetched until the player taps START: a visitor who only reads the
panel touches no second origin. That is also why the page's
Content-Security-Policy is no longer `default-src 'none'` — it now names
`audio.syvt.me` under `media-src` and `connect-src`, and `data:` under
`media-src` for the silent clip. Everything else is still same-origin, and
`privacy.html` says what a clip fetch reveals.

## Poking the visitors

A tap on a bird, a fish, a balloon or a plane makes it squeak and jump. It is
the app's `Feel.poke`, brought over whole: the same six clips, the same gains
and the same recoil.

`scenery.js` owns the movement. Every visitor carries a `voice` (the cloud has
none — a cloud makes no sound) and, once poked, the time it was poked and how
often. `startle()` is a 1.4-second exponential decay off that moment, and the
three motions are read off it: a squash, a hop, and a turn. The turn is the
one that changes with the count — the first poke is a flinch, a wobble either
way, and from the second the creature spins right round and carries on the way
it was going. `pokeAt()` takes a point in design px and returns the visitor
under it, with a 46-px touch radius so a small thing at the top of the sky is
still catchable with a finger.

`sfx.js` owns the sound, and it is the one thing on the page that is not an
`<audio>` element. A spoken word is a remote file played through the single
element iOS allows; these are six small same-origin clips that have to answer
a finger at once and may overlap, so they are Web Audio: decoded once into
memory, then any number at a time with gain, pitch and pan for free. That is
what lets a creature be heard where it is seen — a distant one quieter and a
shade lower, out of the side of the sky it is crossing, on the app's own
numbers. The `AudioContext` is created on the first poke and never before, so
a visitor nobody touches costs nothing at all, and the clips a theme can use
are warmed on the START tap where there is a gesture to do it in.

`sfx/*.wav` are byte-for-byte copies of the app's `assets/sfx/`, 120 KB for
the six the two free worlds can reach. A poke never touches the game: it is
ignored on a tile, on the HUD, on any panel, while a drag is in flight and
while the round is paused, so nothing about it can cost a swipe.

## Generated files

`syvt.js` is the game, `voice.js` the spoken words, `sfx.js` the poke sounds,
`scenery.js` the two worlds and the six picker thumbnails, `syvt.css` the
whole interface as one themed stylesheet. `words.js` is generated:

```
python make-words.py       # ../SYVT/tool/words/*.json -> words.js, levels 1-5
```

500 words per language, each entry `[correct, ...misspellings]` — the words
the app teaches, cut off where the free game is. It also writes `SYVT_CLIPS`,
the clip id of every word the page can say: levels 1 and 2 only, which is as
far as the free voice goes. For German the id is Germany's spelling, from
`de_germany.json`, keyed by the Swiss spelling the tile shows — the same
`WordEntry.spoken` rule the app follows, because `ss` tells a German voice the
vowel before it is short and the Swiss form is the one it cannot pronounce.

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

The mark is the game drawn as one picture: a word card lies at an angle inside
a funnel, and the two answers leave to the sides, wrong to the left in coral
and right to the right in mint. The card is not painted on top of the funnel,
it is **knocked out** of it, so the mark is a single shape and the plate shows
through the card — which is also what lets the wordmark reuse the same glyph
as a letter. On the plate, a centred radial of `#6E42EE`, `#2A1B84` and
`#08102C`.

**The spec is `../SYVT/assets/brand/BRAND.md`, and `lib/ui/marks.dart` is the
authority on any number in it.** Nothing here is drawn: `icon.svg` and
`brand/syvt-mark.svg` are copies of `../SYVT/assets/brand/` byte for byte, and
every inline copy of the funnel carries the same path data and the same
`fill-rule="evenodd"` — without the fill rule the card fills in.

Two rules from that spec shape this repo more than the rest:

- **The mark and the name never appear together.** The name already contains
  the funnel. So a page shows one or the other, **counting the whole page and
  not just the header**: the game panel, the two legal pages and the link
  preview show the wordmark and nothing else; `404.html` shows the mark and
  does not set the name in type at all. The favicon is the mark on its plate,
  and is chrome rather than part of any lockup. The legal footers used to
  carry the mark as a small tile while their headers carried the name, which
  is exactly the shape this rule forbids — do not put it back.
- **The Y is exactly the colour of the letters around it** — never coral,
  never mint, never a second tone. On the game panel the letters take the
  theme's gradient through `background-clip: text`, which cannot reach an
  inline SVG child, so the Y repeats the same two stops in `userSpaceOnUse`
  over the lockup's 1 em line box. Two gradients, one per face: the numbers
  fall out of the font's ascent, descent and cap factor, not out of the
  palette.

So the name is set as **S, the funnel, VT** — never with a letter Y. It is
assembled from type and the funnel in three places, and hand-drawn as a
logotype in none of them: `#brand` on the start panel, `.name` in the
legal-page header, and `brand/syvt-og.svg` for the link preview. The last of
those is the one case where the letters end up as outlines, because a
generated file cannot depend on a font being resolved at render time.

`icon.svg` and `brand/syvt-mark.svg` are the masters — the mark on its plate
and the mark alone. The PNGs are **derived**; edit the SVGs and re-run:

```
npm install sharp          # once, for rendering only
node make-icons.mjs        # icon.svg -> apple-touch-icon.png, brand/syvt-og.svg -> og.png
```

The two icon jobs are not the same picture, deliberately. The browser tab gets
`icon.svg` as it stands — rounded, `rx="31"`, transparent corners — with
`brand/syvt-app-mark-192.png` beside it for anything that will not take an SVG.
`apple-touch-icon.png` is rendered from the same master with the corner radius
dropped and the alpha flattened onto the plate's rim colour, because iOS masks
a home-screen icon with its own superellipse and expects an opaque square to
mask: hand it a rounded, transparent one and the two roundings compound, with
black showing through the corners iOS does not cut. It also sits at the root
because that is the path iOS looks for by itself.

`brand/syvt-app-mark-192.png` is the favicon's raster fallback, for anything
that will not take an SVG, and its only use. It is downsampled from the app's
**rounded** icon, which has transparent corners; `store/play/icon-512.png` is
the full-bleed one and would give a square tile in a browser tab:

```
python -c "from PIL import Image; im=Image.open('../SYVT/assets/icon/icon-android-1024.png').convert('RGBA'); im.resize((192,192), Image.LANCZOS).save('brand/syvt-app-mark-192.png')"
```

The letters in `brand/syvt-og.svg` are Fredoka converted to outlines, so the
artwork needs no font at render time; the Y in it is `syvt-glyph-y.svg`
verbatim. It is the **wordmark alone** on the plate in flat cream, following
the Play feature graphic, because the mark may not stand beside the name. That
conversion is one-way, so if the game is ever renamed:

```
pip install fonttools brotli   # once
python brand/make-wordmark.py  # set LEAD and TAIL at the top, then re-run make-icons.mjs
```

### One number the spec gets wrong

BRAND.md's CSS block spaces the Y with `margin-left: 0.092em` and
`margin-right: 0.312em`. Those come from the Flutter render, where the
placeholder is handed a trailing letter-space; CSS never adds one after an
atomic inline, and an inline SVG is one. Built from them in a browser the
three ink gaps come out 115 / 105 / 70 at a 300 px em — the Y floating in half
again the air the letters get.

The app's own renders have all three equal: 25 / 26 / 25 px measured off
`store/play/screenshot-1-start.png`, and 25 / 25 / 25 off the Play feature
graphic. That is also what the spec says it was after, *"measured from the
render until the gaps either side were even"*.

So every lockup here is spaced by measurement instead, solved per face until
each side of the Y matches the ink gap inside VT. `brand/make-wordmark.py`
does it arithmetically from the font's own side bearings; `syvt.css` and
`legal.css` carry solved constants with the derivation beside them. Computed,
the three gaps agree to within .002 em; rendered, they move by up to about
.02 em more, because the letter-space and the margins round to device pixels
independently. Re-solve if the face, the tracking or the cap factor changes.

`matter.min.js` is the physics engine; `manrope.woff2` is the typeface the
grown-up worlds use and `fredoka.woff2` the one the kids' worlds do, the same
pairing as the app. Both are variable, and both axes are always written:
Fredoka's `wght` default is 300 and its axis stops at 700, so the S asks for
620 and the rest for 800 and gets 700. All three files are vendored, so the
only origin the page reaches at runtime is the audio bucket, and only once a
round has started.
Both fonts are SIL Open Font License; `OFL-Manrope.txt` and `OFL-Fredoka.txt`
are the licences that requires be shipped with them.

## Legal pages

`privacy.html` and `data_deletion.html`, sharing `legal.css`. Google Play needs
a privacy-policy URL before the Android app can be listed, and a deletion URL
alongside it; these are the two, and the contact address on both is
`hi@SYVT.me`. Both carry `default-src 'none'` and load nothing from a
third party — not even a font, which on a privacy page would hand the reader's
IP address to whoever served it. The game's own policy is one line wider than
theirs; see **The voice** above.

They are skinned in the **app's** palette, not this page's: the plate's own
three violets and cream, from `lib/ui/marks.dart` in the Flutter repo, because
these are the pages the Play listing links to and the app icon is what a
reader arrives from. The band at the top is the plate itself — one centred
radial, no highlight laid over it, which is why both pages set
`theme-color: #2A1B84`, the plate's own mid tone.

The wordmark in the header is built in HTML rather than drawn: Manrope
ExtraBold for S and VT with the funnel as an inline SVG in between, sized to
Manrope's cap height (exactly `.72em`) so it stands on the baseline like a
letter, and 34 px because the wordmark's floor is a 24 px cap height and
`24 / .72` is 33.3. It shows the name alone — the mark used to sit beside it,
which the brand does not allow. Its two margins are measured, not derived; see
**One number the spec gets wrong** above and the comment in `legal.css`.

Keep both pages true to what the app actually does. The claims that matter, and
that would need editing if the app changed: no ads, no analytics, no crash
reporting, no third-party trackers; the account is optional and holds only
nicknames, avatars, scores and settings; Firestore is in the European
multi-region and the callable function in Zurich; and the app's own danger
zone (Settings for parents, held open at the bottom) deletes the account, its
backup and every player's statistics, with the email request kept only for
someone who cannot open the app.
