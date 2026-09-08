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

Where the app would sell SYVT+, the page points at the Play Store instead:

- **Level 5** is the last free level, as on Android. At score 150 the round
  pauses and the offer comes up once; dismissing it carries on at level 5 for
  as long as the player likes.
- **Two worlds** are free, Day and Aquarium. The other four sit in the picker
  with a padlock, and tapping one opens the same offer.
- **Levels 1 and 2** are read out loud, as on Android. The chip beside the
  pause button switches the voice; on the way into level 3 it goes quiet and
  the chip dims, and a tap on it then pauses the round and opens the offer.

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

## Generated files

`syvt.js` is the game, `voice.js` the spoken words, `scenery.js` the two
worlds and the six picker thumbnails, `syvt.css` the whole interface as one
themed stylesheet. `words.js` is generated:

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

`matter.min.js` is the physics engine; `manrope.woff2` is the typeface the
grown-up worlds use and `fredoka.woff2` the one the kids' worlds do, the same
pairing as the app. All three are vendored, so the only origin the page
reaches at runtime is the audio bucket, and only once a round has started.
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
