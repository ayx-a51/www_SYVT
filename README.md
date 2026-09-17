# syvt.me

SYVT — a word game. Falling words: swipe right if one is spelled correctly,
left if it is not. Wrong calls pile up until the stack reaches the ceiling.
English, German and French, with mental-arithmetic discs mixed in. One game
with two faces: a meadow and a galaxy for the children, a quiet page for the
grown-ups, and a switch on the start panel between them.

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

- **Level 4** is the last free level, as on Android. At score 120 the round
  pauses and the notice comes up once; dismissing it carries on at level 4 for
  as long as the player likes. Level 5's words are still in `words.js`, out of
  reach, so moving the ceiling is `FREE_MAX_TIER` in `syvt.js` alone.
- **Three worlds** are free across the two sides — Light for the grown-ups,
  Space and Day for the children — which is the app's own
  `Limits.freeThemes`. The other five sit in the picker with a padlock, and
  tapping one opens the same notice, counted for the side it was tapped on:
  six worlds and four to open on the children's side, two and one on the
  grown-ups'.
- **Levels 1 and 2** are read out loud, as on Android. The chip beside the
  pause button switches the voice; on the way into level 3 it goes quiet and
  the chip dims, and a tap on it then pauses the round and opens the notice.

The score stops counting at 120, which is the same moment. Play does not stop
— the round runs until the stack reaches the ceiling — but every point after
that is won on level-four words, so it is not the same thing as a point won at
level ten. The overflow therefore runs in a second counter beside the score,
`120 | +13`, behind a hairline so the two can never be read as one number.
The whole total is what gets stored; the split is only how it is shown, and it
is shown the same way in the app.

Two smaller things follow from it. The level bar fills for the last time on
the way to level four and then stays full, rather than sweeping every thirty
points under a number that can never change. And the counter explains itself
only if asked: the SYVT+ notice at 120 mentions it in passing, and a small
"i" beside the counter on the game-over panel opens a short "Why 120?" that
answers the question without taking the chance to sell anything.

Two deliberate reductions from the app's free tier, because a teaser has
nothing to protect: there are no player profiles, so no avatars, no
statistics and no account — the best score is a `localStorage` number per
language — and there is no sticker book (see "The two sides"). A browser that
refuses site data, or refuses a write, still gets the game: the page starts
with its defaults, and the language, the side, the world, the voice switch
and the best score last for the visit, in memory. `syvt.js` and
`voice.js` each carry their own copy of that small guard, so a deploy where
one file is served from cache and the other is not cannot bring back a crash
at startup. All three languages are open, as they are in the app.

The language a first visit opens in follows the app's rule
(`lib/profile/locale_defaults.dart` in the Flutter repo): the first of the
browser's preferred languages that the game speaks, English if none, until a
language is tapped on the panel, which is remembered. German is spelled the
way the browser's country writes it. Switzerland and Liechtenstein have no
eszett, so the words fall as *Strasse* only where the browser's German, or
failing any German the browser itself, is in one of those two; everywhere
else they fall as *Straße*, and a browser that names no country keeps the
list's own Swiss spelling. In the app a parent can change it per player; the
page has no switch, so the browser alone decides. The voice says Germany's
form either way, as the app's does.

A word or sum joins the anti-repeat memory only once its tile is placed, as
in the app. A crowded field refuses a spawn every frame until a column
clears, and while the memory took words at the draw, each refusal pushed out
a word that had really fallen.

## The two sides

The app has two sides and a player is on one of them: a child, or a grown-up
(`Profile.grownUp`, `Audience` in the Flutter source). The children's side is
six worlds in Fredoka with creatures to poke; the grown-ups' is two quiet
worlds in Manrope. The words, the sums, the levels and the voice are the same
game on both.

On a tablet it is a setting, one per player, kept in the parents' corner,
because the adult and the eight-year-old who share one are the whole point.
The page has no players, so it is a **switch on the start panel**, and which
way it was left is a `localStorage` value like the language and the world.
Everything else follows from it: the worlds the picker shows, the face, the
palette, and what a padlock is counted against.

Flipping it carries the world across to its **twin** on the other side —
Night and Dark, Day and Light are the same scene drawn twice — or, for a
world with no twin, to that side's free one. That is the app's `themeAcross`,
and it is why a grown-up who looks in on the children's side and comes back
finds their own sky rather than a default. The switch cannot be a way round a
padlock: one free set serves both sides precisely because no locked world on
one has a free twin on the other (Day and Light are both free; Night and Dark
both are not).

A first visit opens on the children's side in Space, as a fresh install of
the app does. A player is a child unless they say otherwise, which is the
safe reading: an adult who wakes up in a children's world shrugs and flips
the switch, where a child moved the other way would lose something.

### Which worlds are drawn

All eight are in the picker; the three the free game may play are drawn
moving, and the other five are a thumbnail behind a padlock and nothing more.

| Side | World | Here |
| --- | --- | --- |
| Grown-ups | Light | played — the warm-paper world this page used to call Day |
| Grown-ups | Dark | thumbnail — what this page used to call Night |
| Children | Space | played — a cartoon galaxy, capsules on a squishy moon |
| Children | Day | played — a sunny meadow, picnic cards on bright grass |
| Children | Night | thumbnail — a campsite under a big moon |
| Children | Ocean | thumbnail — it was playable here when it and Day were the free pair |
| Children | Princess Castle | thumbnail |
| Children | Dinosaurs | thumbnail |

The two renamings are the same two worlds, not new ones: the app moved its
original light and dark skins on to the grown-ups' side as Light and Dark,
and drew the children a Day and a Night of their own. So `scenery.js`'s Light
is this repo's old Day, ground and visitors unchanged, and its Dark thumbnail
is the old Night one.

Space and Day are ports of `lib/ui/themes/space_theme.dart` and
`day_theme.dart` and their `visitors/`, in the app's own design px. Two
things are drawn differently and both say so where they are done: the app
blurs its far hills and its planet haloes with a real blur, where a canvas
gets `ctx.filter` if the browser has one and a radial that fades to nothing
where it does not; and Space's far stars are seeded from this page's own
stable noise rather than from `math.Random(2026)`, which a browser cannot
reproduce — the same 56 stars under the same rules, at their own
coordinates.

### SYVT himself

The alien from the app's launcher icon is on the children's start and
game-over panels, beside the name: a round purple fellow with a red antenna
ball on his left and a green one on his right — the game's own
wrong-and-right — cheering out of a sorting pit with a red bucket on his
left and a green one on his right. `mascot.js` is a port of the app's
`lib/ui/mascot/syvt_art.dart`, drawn with the same modelled fill and
modelled stroke every creature on the field gets, so he is lit like the
world he is standing in.

He flies in from off the panel's left edge, hovers, waves every few seconds,
every half minute or so takes the saucer for a quick round over the letters,
and jumps and cheers when tapped — the app's own timings, easings and
amplitudes, from `syvt_mascot.dart`. Under reduced motion he simply sits
there cheering, and a tap still answers in sound, because the switch is
about motion.

His canvas is far bigger than he is — 396 × 130 design px, with his slot's
top-left at its origin — because a canvas draws nothing outside itself and
he leaves his slot in every direction. Those four numbers are measured
rather than reasoned: his ink, swept over the arrival, a whole loop, a wave,
a poke and a couple of breaths, runs x −152 to 227 and y −27 to 89, and each
edge keeps seven px or more beyond that. Two things make the box bigger than
it looks — the engine's glow is a disc at y 100 with a radius of 16, so it
reaches three quarters of his height below his own feet, and the loop's
second half swings him down as far as its first half swings him up.

What leaves the panel is clipped by `#panel { overflow-x: clip }` — `clip`
rather than `hidden`, which would have made the panel scrollable sideways to
follow him. The canvas itself takes no pointer events, since it reaches over
the name and down into the tagline; the panel hears every tap and the script
tests it against where he is at that instant, so a miss still reaches the
button under it. The slot keeps his place in the row, so the name does not
move as he flies; on the grown-ups' side the slot is gone and the name
re-centres itself.

The app puts him in three kinds of place on the children's side. The other
two are not here and each is a small addition rather than a rewrite: he does
not cross the worlds as a visitor, and there is no pause veil for him to
doze under — the sleeping pose is ported and simply never reached. That is
also why the app's `Presence`, the one record that keeps one person from
being on screen twice, has nothing to arbitrate here and is not ported.

**The sticker book is deliberately not here.** It is the app's reward for a
level played well, it belongs to a player, and the page has no players — the
same reason it has no avatars, no statistics and no account.

## The voice

`voice.js` reads the falling words out loud, from the same corpus the app
uses — immutable, content-addressed clips on Cloudflare R2 at
`audio.syvt.me/tts/v1/`. It is a port of the app's `lib/voice/`, and the rules
are the app's: off means off (switched off it opens no connection and fetches
nothing at all), one word at a time with a waiting slot exactly one deep and
last in wins, and nothing interrupts a word except the round itself stopping.

These things are the page's own, and each has its reason written where it is
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
  cross-origin without one, and a clip asked for ahead of its word goes in
  `no-cors` mode and never reads a byte of what comes back — it only wants the
  file in the browser's cache, where the element will look for it. So the
  corpus stays exactly as the app left it; see `tool/tts/README.md` in the app
  repo. It is also why replaced recordings are resolved when `words.js` is
  generated rather than read from the manifest in the page: a `no-cors`
  response is opaque, and the page cannot read it.

Nothing is fetched until the player taps START: a visitor who only reads the
panel touches no second origin. That is also why the page's
Content-Security-Policy is no longer `default-src 'none'` — it now names
`audio.syvt.me` under `media-src` and `connect-src`, and `data:` under
`media-src` for the silent clip. Everything else is still same-origin, and
`privacy.html` says what a clip fetch reveals.

### What is fetched, and when

One clip per word tile, asked for the moment the tile is placed — once it has
a column and has joined the anti-repeat memory, 1.25 to 1.6 seconds before it
crosses the speak line — so by the time it gets there the file is normally
already in the browser's cache. A spawn refused for want of a column fetches
nothing, and a sum has no word. Whenever the voice becomes able to fetch — the
START tap, the switch turned on, the page or the network coming back — it also
asks for the words of the tiles still above that line, so a tile placed while
it could not is not left out. Whatever a request ahead of time missed, the
`<audio>` element fetches itself when the word is said.

A first minute at level 1 is about 22 clips, some 90 KB. At most three
requests are in flight and three waiting, the oldest waiting one dropped when
a fourth comes; a failed one, or one still out after ten seconds, is tried
once more; and pausing, game over or a language switch drops the ones still
waiting. A clip already fetched in this visit is not asked for again, not
even after a return to the page.

Never a whole level, and that is a deliberate divergence from the app.
Warming the levels a round can reach, as the app's `_warmVoice` still does,
was 600 files and 2.5 MB on the first START — 300 words a level — and the page
gets far less for it: the app warms into a disk cache of its own, where the
page has only the browser's HTTP cache, which it cannot look into, and it
cannot speak offline anyway.

### Asking whether the corpus is there

The page asks the way the app's `lib/voice/reachability.dart` does: a request
for `tts/v1/manifest.json`, one at a time, and one with no answer in 4 s is a
no, as in the app. After a failure it looks again in 4 s, 10 s, 30 s, 2 min,
5 min, and then every 15 min, the app's ladder, and nothing polls while the
answer is yes. A clip that arrives counts as a yes, and the browser's `online`
event asks at once, in place of any request still out from before, so a
network that comes back need not wait out the ladder. Coming back to the page
asks again, unless the last yes is under five minutes old by the wall clock —
that is the network the page left, not a new one — so a glance at a
notification costs nothing.

### Replaced recordings

A word recorded again after release is published as `<id>.<take>.mp3` beside
the original, and the manifest's `revisions` names the take; the object name
follows the app's `voiceObject`. The app reads that table at runtime. The page
cannot, because the bucket sends no CORS header, so `make-words.py` writes the
take into `SYVT_CLIPS` from the published manifest, and the page asks for
`<id>.<take>.mp3` rather than the original a browser was told to keep for a
year.

So after publishing a retake — clips first, then the manifest, as
`tool/tts/README.md` in the app repo says — run `make-words.py` again and push
`words.js`. Until then the page goes on playing the old take.

If a take fails to load the way a 404 does, the page falls back to the take
before it within the same word, as the app's `VoiceCache` does. A browser
reports a 5xx or a dropped connection exactly as it reports a 404, though, so
the page keeps to the take before for the rest of the visit only once that
take has played, which shows the host answered; if it fails too, it was the
network, and the newer take is asked for again next time. A no from the probe
clears the list.

## Poking the visitors

A tap on a bluebird, a rabbit, a flying saucer or a balloon makes it squeak
and jump. It is the app's `Feel.poke`, brought over whole: the app's own
clips, the same gains and the same recoil.

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
element iOS allows; these are ten small same-origin clips that have to answer
a finger at once and may overlap, so they are Web Audio: decoded once into
memory, then any number at a time with gain, pitch and pan for free. That is
what lets a creature be heard where it is seen — a distant one quieter and a
shade lower, out of the side of the sky it is crossing, on the app's own
numbers. The `AudioContext` is created on the first poke and never before, so
a visitor nobody touches costs nothing at all, and the clips a theme can use
are warmed on the START tap, and on a tap on a picker card, where there is a
gesture to do it in — a world change is a change of voices.

`sfx/*.wav` are byte-for-byte copies of the app's `assets/sfx/`, 224 KB for
the ten the three free worlds can reach. A poke never touches the game: it is
ignored on a tile, on the HUD, on any panel, while a drag is in flight and
while the round is paused, so nothing about it can cost a swipe.

## Generated files

`syvt.js` is the game, `voice.js` the spoken words, `sfx.js` the poke sounds,
`scenery.js` the three worlds and the eight picker thumbnails, `mascot.js`
the alien beside the name, `syvt.css` the whole interface as one themed
stylesheet. `mascot.js` loads after `scenery.js` because it draws with the
kit that file exposes. `words.js` is generated:

```
python make-words.py       # ../SYVT/tool/words/*.json + the corpus manifest -> words.js, levels 1-5
```

It takes `[--manifest URL|PATH] [--out PATH]`; without them it reads the
published manifest and writes `words.js`.

1,500 words per language, each entry `[correct, ...misspellings]` — the words
the app teaches on levels 1 to 5, one level past where the free game stops.
`window.SYVT_GERMANY` beside them holds Germany's forms of the German words
Switzerland writes with ss, keyed by the Swiss form and in the same shape, for
the tiles a German browser outside Switzerland and Liechtenstein sees. It
also writes `SYVT_CLIPS`,
the clip of every word the page can say: levels 1 and 2 only, which is as
far as the free voice goes. Each value is an object name — the clip id, or
`<id>.<take>` for a replaced recording. For German the id is Germany's
spelling, from `de_germany.json`, keyed by the Swiss spelling the tile shows —
the same `WordEntry.spoken` rule the app follows, because `ss` tells a German
voice the vowel before it is short and the Swiss form is the one it cannot
pronounce.

The takes come from `https://audio.syvt.me/tts/v1/manifest.json` by default —
the published manifest, because it names only takes already on the bucket — so
a run needs the network. Offline, pass
`--manifest ../SYVT/tool/tts/out/tts/v1/manifest.json`. The manifest is read
before anything is built, and one that cannot be read or does not parse stops
the run and leaves `words.js` as it was. The manifest is served with
`max-age=300`, which only a browser heeds: Cloudflare does not cache it
(`cf-cache-status: DYNAMIC`), and the generator fetches it uncached, so a run
right after uploading one already reads it.

## Hosting

GitHub Pages serves `main` from the root, so a push to `main` is a release.
`CNAME` pins the domain and `.nojekyll` serves files as-is. The rest lives in
the GitHub UI and at the registrar, and all of it is in place: on 2026-09-15
both `http://syvt.me/` and `https://www.syvt.me/` answered with a 301 to
`https://syvt.me/`.

- **Pages**: Settings → Pages → deploy from branch `main`, folder `/ (root)`.
- **DNS** for `syvt.me`: apex `A` records to the GitHub Pages addresses
  (185.199.108–111.153), and `www` as a `CNAME` to `syvt.me`.
- **HTTPS**: *Enforce HTTPS* is on.

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
  does not set the name in type at all. The favicon is chrome rather than
  part of any lockup, which is why the mark on its plate could sit in the tab
  of a page that sets the name (at the moment the tab shows the mascot
  instead; see below). The legal footers used to
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
assembled from type and the funnel in two places, and hand-drawn as a
logotype in neither: `#brand` on the start panel and `.name` in the
legal-page header. `brand/syvt-og.svg` is a third, where the letters end up
as outlines because a generated file cannot depend on a font being resolved
at render time; the link preview no longer renders it (see below), and it is
kept because it is the only place the lockup exists as outlines at all.

`icon.svg` and `brand/syvt-mark.svg` are the masters — the mark on its plate
and the mark alone. The PNGs are **derived**; edit the SVGs and re-run:

```
npm install sharp          # once, for rendering only
node make-icons.mjs        # icon.svg -> apple-touch-icon.png,
                           # brand/syvt-feature-1024x500.png -> og.png,
                           # brand/favicon_drk.webp -> favicon.ico, favicon-192.png, favicon-180.png
```

The two mark jobs are not the same picture, deliberately. When the tab shows
the mark it gets `icon.svg` as it stands — rounded, `rx="31"`, transparent
corners — with
`brand/syvt-app-mark-192.png` beside it for anything that will not take an SVG.
`apple-touch-icon.png` is rendered from the same master with the corner radius
dropped and the alpha flattened onto the plate's rim colour, because iOS masks
a home-screen icon with its own superellipse and expects an opaque square to
mask: hand it a rounded, transparent one and the two roundings compound, with
black showing through the corners iOS does not cut. It also sits at the root
because that is the path iOS looks for by itself.

`brand/syvt-app-mark-192.png` is the mark favicon's raster fallback, for
anything that will not take an SVG, and its only use. It is downsampled from
the app's **rounded** icon, which has transparent corners;
`store/play/icon-512.png` is the full-bleed one and would give a square tile in
a browser tab:

```
python -c "from PIL import Image; im=Image.open('../SYVT/assets/icon/icon-android-1024.png').convert('RGBA'); im.resize((192,192), Image.LANCZOS).save('brand/syvt-app-mark-192.png')"
```

**What the tab shows at the moment is not the mark.** `brand/favicon_drk.webp`
is a second master, the mascot on its own navy plate, and `make-icons.mjs`
renders the favicon set from it: `favicon.ico`, with 16, 32 and 48 inside,
the sizes a tab and a Windows shortcut ask for and the file browsers fetch by
name when a page links nothing; `favicon-192.png` for Android's home screen
and anything else that wants a big PNG; and `favicon-180.png`, the iOS touch
icon, flattened onto the plate's own navy for the reason `apple-touch-icon.png`
is flattened. The pages link those (the 404 the first two, as before) and keep
the mark's own icon links beside them, commented out, so putting the mark back
is a matter of swapping the comments; the mark's files stay either way. The
master is the supplied `favicon_drk.png` as it arrived, converted to WebP at
1254 px; swap the original in under the same stem, and the path at the top of
the mascot section of `make-icons.mjs`, for full fidelity. The plate in it is
sixteen pixels shorter than it is wide and sits in uneven margins, which the
script corrects by cutting to the plate's alpha box and rendering that box
into a square.

**The link preview is the app's key art.** `og.png` is
`brand/syvt-feature-1024x500.png` — the Play feature graphic, byte for byte
the app's own `store/play/feature-1024x500-en.png` — scaled to cover 1200 ×
630 and cropped by 45 px a side, which takes the castle's outer wall and a
sliver of the phone and nothing else. It carries the wordmark, SYVT himself
at the sorting pit, and a corner of each world behind him, which is what a
link preview is for: the one place the game shows what it is before anybody
taps anything, where a name on a plate showed nothing.

That is not the rule about the mark and the name being broken. The mark is
the funnel **with its two triangles**; what the key art carries is the
wordmark, whose Y is that funnel with the card knocked out and the triangles
dropped, and no second copy stands beside it.

The English feature graphic, not the German or the French: `og:description`
is English, and the preview is one image for every visitor. Swapping the
plate back in is the two lines of the `og.png` job in `make-icons.mjs` — the
same swap the tab icon is kept ready for in `index.html`.

The letters in `brand/syvt-og.svg` are Fredoka converted to outlines, so the
artwork needs no font at render time; the Y in it is `syvt-glyph-y.svg`
verbatim. It is the **wordmark alone** on the plate in flat cream, which is
what the link preview used to be. That conversion is one-way, so if the game
is ever renamed:

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

Keep both pages true to what the app actually does, and in step with the
app's `store/play/data-safety.md`, which Play compares with them. The claims
that matter, and that would need editing if the app changed: no ads, no
analytics, no crash reporting, no third-party trackers; the account is
optional, signs in with an email address or a Google account, and holds only
nicknames, avatars, scores and settings; a signed-in purchase is checked with
Google Play and recorded against the account; the spoken words come from
`audio.syvt.me` on Cloudflare, with no account or device id in the request;
Firestore is in the European multi-region and the callable functions in
Zurich; and the app's own danger zone (Settings for parents, held open at the
bottom) deletes the account, its backup and every player's statistics, with
the email request kept only for someone who cannot open the app.
