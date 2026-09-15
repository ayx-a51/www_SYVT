/* The voice that reads each falling word out loud — the app's lib/voice/,
   ported to the page.

   It is the policy in one place. The game posts every word it spawns and
   knows nothing about any of this; this decides whether a word is spoken at
   all, which word wins when two want the speaker, and when a single byte may
   be pulled over the network.

   ## Off means off

   Every road to the network starts at `active`, and `active` is
   `entitled && the player's switch && the page is visible && a round has
   started`. Switched off, this opens no connection, warms nothing and holds
   no element loaded: not a quieter voice, no voice. The game goes on posting
   words either way, which is what keeps the switch out of the round entirely
   — turning it on must not change what falls.

   The fourth term is what keeps a visitor who never taps START from touching
   a second origin at all: the page they landed on fetches nothing but itself.
   It is also, and not by coincidence, the only moment a user gesture is on
   the stack (see the element, below), so the two requirements are one line.

   ## One word at a time, and only the round ever interrupts

   A spelling game's voice exists to tell a child which word the tile is meant
   to be. Half a word does not do that job less well, it does a different and
   worse one: "accom—" is not a word, and a child who half-hears it pins the
   fragment on whichever tile they are looking at — which is the lowest one,
   about to land, while the word that cut in belongs to the newest one, still
   fading in at the top. So nothing interrupts a word except the round itself
   stopping (`hush`).

   Two tiles can still want the speaker at once. The second one waits in a
   slot exactly one deep, last in wins: a real queue would accumulate on any
   hiccup until the voice was narrating tiles that landed a minute ago, and
   depth one sheds the backlog by construction. The tile that loses its slot
   is always the older one, which the player has already had time to read.

   ## Why one <audio> element, and why the silent clip

   iOS unlocks media playback per ELEMENT: an element that has never been
   played inside a user gesture stays silent forever, however many gestures
   the page has seen since. So there is exactly one element for the whole
   page, unlocked on the START tap with 52 bytes of silence, and every word
   after that is a new `src` on the same, already-trusted element.

   iOS also ignores `preload`, so a clip does not begin loading until play()
   is called on it. That rules out the app's shape — resolve the bytes, then
   decide whether the word is still worth saying — and this asks the question
   the other way round: play() at once, and if the clip turns out to have
   arrived too late to name the tile it belongs to, stop it on the `playing`
   event before a syllable is out. What makes that rare is that a word's clip
   is asked for the moment its tile is placed, so by the time the tile reaches
   the line its file is normally already in the browser's cache and playback
   starts in a frame or two.

   ## No CORS, deliberately

   A media element fetches cross-origin without a CORS policy, and the warm-up
   asks in `no-cors` mode and never reads a byte of what comes back — it only
   wants the file in the browser's cache, where the element will look for it.
   So this needs no policy on the bucket (see tool/tts/README.md in the app
   repo), and the corpus stays exactly as the app left it. */
window.SYVT_VOICE = (function () {
  "use strict";

  /* Where the corpus is published, and how a clip is addressed — the same
     constants as lib/voice/speech_key.dart. The object names themselves are
     computed by make-words.py and looked up in SYVT_CLIPS; nothing is hashed
     here, because a third implementation of the normaliser and the hash
     would be a third chance to drift, and a drifted hash does not throw — it
     misses every file and the voice goes quiet with no error anywhere. */
  var BASE = "https://audio.syvt.me/tts";
  var SCHEMA = "v1";

  /* 52 bytes of silence. It is played, not merely loaded: only a play() that
     a gesture reaches lifts iOS's lock. */
  var SILENCE = "data:audio/wav;base64,UklGRiwAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQgAAACAgICAgICAgA==";

  var SPEAK_WINDOW_MS = 1500;   // the app's kSpeakWindowMs
  var SPEAK_GAP_MS = 120;       // the app's kSpeakGap
  var START_TIMEOUT_MS = 5000;  // a clip that has not started by now is lost
  var END_GRACE_MS = 1500;      // backstop past a clip's own length
  var LONGEST_CLIP_MS = 4000;   // what to assume when the length is not known

  var WARM_CONCURRENCY = 3;
  var WARM_QUEUE_MAX = 3;   // waiting beyond the three in flight; the oldest waiting is dropped
  var WARM_TIMEOUT_MS = 10000;   // a warm request still out by now is long past its tile

  /* How long to wait before looking again after the corpus failed to answer.
     Backs off to a quarter of an hour, as lib/voice/reachability.dart does: a
     phone with no signal should not wake its radio every two minutes for as
     long as the page is open. A network that comes back sooner is noticed
     anyway — by the browser's `online` event, by a clip that lands, or by the
     page coming back. */
  var BACKOFF_MS = [4000, 10000, 30000, 120000, 300000, 900000];
  var RECHECK_MS = 20000;   // a floor on how often a failed clip may re-probe
  var PROBE_TIMEOUT_MS = 4000;   // the app's 4 s bound on every stage of a look
  var FRESH_MS = 300000;    // the app's _fresh: a yes this recent is not asked again on a return to the page

  // A clip's object name: its id, or <id>.<take> for a word recorded again
  // after release — voiceObject() in lib/voice/speech_key.dart. make-words.py
  // writes the take in, from the manifest's revisions, because the bucket
  // sends no CORS header and the page cannot read the manifest itself.
  var CLIP_OBJECT = /^([0-9a-f]{20})(?:\.([2-9]|[1-9][0-9]+))?$/;

  // Every take of a word sits in the same shard folder: the first two
  // characters of the name are the id's.
  function clipUrl(lang, object) {
    return BASE + "/" + SCHEMA + "/" + lang + "/" + object.slice(0, 2) + "/" + object + ".mp3";
  }

  /* The object name of a spoken word's clip, or null when the page has none
     for it — a sum, or a word above the levels the free voice reads.
     Own-property only: the map is generated, but a lookup that answered for
     "constructor" would hand the round a function where it wants a clip's
     name. */
  function clipFor(word, lang) {
    var byLang = window.SYVT_CLIPS && window.SYVT_CLIPS[lang];
    if (!byLang || !Object.prototype.hasOwnProperty.call(byLang, word)) return null;
    var object = byLang[word];
    return typeof object === "string" && CLIP_OBJECT.test(object) ? object : null;
  }

  // The take before this one, or null for a first take.
  function previousTake(object) {
    var m = CLIP_OBJECT.exec(object);
    if (!m || !m[2]) return null;
    var take = +m[2] - 1;
    return take <= 1 ? m[1] : m[1] + "." + take;
  }

  /* The player's choices. localStorage when the browser allows it; when it
     refuses site data (the getter throws, or is null) or refuses a write (a
     full quota), the page still starts and every choice lasts the visit in
     memory. Never throws. voice.js and syvt.js each carry this same pair on
     purpose: a helper shared between two separately cached files would bring
     back, for ten minutes after a deploy, the startup crash it exists to
     prevent. */
  var memoryPrefs = {};
  var diskPrefs;   // undefined: not looked at yet; null: none to be had

  function prefDisk() {
    if (diskPrefs !== undefined) return diskPrefs;
    diskPrefs = null;
    try {
      var s = window.localStorage;
      if (s && typeof s.getItem === "function" && typeof s.setItem === "function") diskPrefs = s;
    } catch (e) {}
    return diskPrefs;
  }

  function readPref(key) {
    if (Object.prototype.hasOwnProperty.call(memoryPrefs, key)) return memoryPrefs[key];
    var s = prefDisk();
    if (!s) return null;
    try {
      var v = s.getItem(key);
      return v === null || v === undefined ? null : String(v);
    } catch (e) {
      return null;
    }
  }

  function writePref(key, value) {
    value = String(value);
    memoryPrefs[key] = value;
    var s = prefDisk();
    if (!s) return false;
    try { s.setItem(key, value); return true; } catch (e) { return false; }
  }

  /* opts:
       entitled()            whether the player may hear the voice here
       stillFalling(tileId)  whether that tile is still on its way down
       onChange()            the button should redraw
       onLive()              this just became able to speak
       inAir()               {lang, words}: the spoken words of tiles not yet
                             at the speak line (optional) */
  function create(opts) {
    var STORE_KEY = "syvt.voice";

    // On by default, as in the app: a voice nobody has ever heard is a line
    // on a card.
    var wanted = readPref(STORE_KEY) !== "0";
    var awake = true;
    var active = false;
    var wasLive = false;

    // Bumped by every hush(). Anything in flight compares the epoch it was
    // posted under against this one and, finding them different, goes quiet
    // rather than speaking into a pause veil or over a new language.
    var epoch = 0;

    var pending = null;      // the one waiting word, at most
    var draining = false;
    var abort = null;        // ends the word being said, if there is one

    var known = {};          // clip URL -> true: asked for this page-load, by a warm-up or the element; kept through stopWork
    var missing = {};        // clip URL -> true: a take that failed while the take before it played (see play)
    var queue = [];          // warm jobs {url, retried} waiting for a slot
    var warming = 0;         // warm requests in flight

    // reachability
    var online = false, asked = false, probing = false, failures = 0;
    var probeTimer = null, lastAnswer = 0;
    var probeSeq = 0, probeLive = 0;   // the probe in flight, if any
    var probeCtl = null, probeCap = null;   // its abort handle and its time cap
    var lastYesAt = 0;       // Date.now() of the last yes; stopProbe keeps it
    var resuming = false;    // true only inside setAwake(true)'s sync()

    var el = null;           // the one unlocked element
    var unlocked = false;

    function now() { return performance.now(); }
    function changed() { if (opts.onChange) opts.onChange(); }
    function entitled() { return !!opts.entitled(); }

    // ---------------------------------------------------------- the gate

    /* Re-reads all four terms of `active` and starts or tears down everything
       that touches the network. Called whenever any of them can have moved —
       including from under a running round, when a free player crosses into
       level three and the voice they have been listening to for two levels
       stops. On the rising edge it also asks for the words already in the
       air, which were placed while this could not fetch. startProbe goes
       first, so a browser that says it is offline has already answered no. */
    function sync() {
      var next = entitled() && wanted && awake && unlocked;
      if (next === active) { changed(); return; }
      active = next;
      if (next) { startProbe(); warmInAir(); } else stopWork();
      announceIfJustLive();
      changed();
    }

    function setAwake(value) {
      if (value === awake) return;
      awake = value;
      if (!value) { hush(); sync(); return; }
      // the app's fresh rule: a yes under five minutes old is the network the
      // page left, not a new one
      resuming = lastYesAt > 0 && Date.now() - lastYesAt < FRESH_MS;
      sync();
      resuming = false;
    }

    /* Fires onLive on the rising edge only. Turning the switch on is what
       STARTS the probe, so at the instant of the tap there is not yet a voice
       to answer with; the page hands us a call that says the word already
       falling, so a switch answers with the thing it just allowed rather than
       leaving the player to wait out a spawn and guess. */
    function announceIfJustLive() {
      var live = active && online;
      if (live === wasLive) return;
      wasLive = live;
      if (live && opts.onLive) opts.onLive();
    }

    /* Everything stops: the voice, the waiting warm-ups (hush drops them) and
       the probe. This is what "off downloads nothing" is made of.

       `known` is kept. It only records what this page-load has already asked
       for, so a return to the page asks for none of it again; and off still
       fetches nothing, because warm() and pumpWarm return on !active.

       `warming` is NOT reset here, though it looks tidy to do it. It counts
       requests that are still running, and this cancels nothing: each
       decrements in its own handler, so zeroing it would take it negative as
       they land, and from then on the lane would let more than
       WARM_CONCURRENCY out at once for the rest of the session. */
    function stopWork() {
      active = false;
      hush();
      stopProbe();
    }

    // --------------------------------------------------------- the element

    /* Called from the START tap — the one moment a gesture is on the stack.
       Safe to call again; only the first does anything. */
    function unlock() {
      if (unlocked || el) return;
      el = new Audio();
      el.preload = "auto";
      el.src = SILENCE;
      var started = el.play();
      if (started && started.then) {
        started.then(done, function () {
          /* Refused. The element stays locked and the voice stays silent,
             which is the browser's decision to make and not an error to
             report — the game is played by eye either way. */
        });
      } else {
        done();
      }
      // sync(), not a flag on its own: the unlock is the fourth term of
      // `active`, so this is the moment the whole thing may start.
      function done() { unlocked = true; sync(); }
    }

    // ------------------------------------------------------ saying a word

    /* A word has just appeared on the field. `word` is always the correct
       spelling — the tile may well be showing a misspelling of it, which is
       the whole point of saying it out loud. */
    function say(word, lang, tileId) {
      // Line one, and the only line that matters for "off downloads nothing".
      if (!active || !online) return;
      var object = objectFor(word, lang);
      if (object === null) return;
      // Last in wins: a newer tile's word displaces an older one that has not
      // managed to be said yet.
      pending = { object: object, lang: lang, tileId: tileId, postedAt: now(), epoch: epoch };
      drain();
    }

    /* Cut off whatever is being said, and abandon whatever was about to be:
       the word waiting for the speaker, and the clips waiting for a warm-up
       slot — never a request already out, which cancels nothing and lands in
       the cache all the same. The round stopped, or the language under it
       changed. */
    function hush() {
      epoch++;
      pending = null;
      for (var i = 0; i < queue.length; i++) delete known[queue[i].url];
      queue.length = 0;
      if (abort) abort();
    }

    /* Whether a word is still worth saying. Past the window the tile has been
       read and very likely already called, and naming it then names the wrong
       one — a tile is in the air for six seconds at the top level and
       thirteen at the bottom, so this is never about the tile running out of
       time, only about the ear and the eye staying on the same word. */
    function speakable(item) {
      return active &&
        item.epoch === epoch &&
        now() - item.postedAt <= SPEAK_WINDOW_MS &&
        opts.stillFalling(item.tileId);
    }

    function drain() {
      if (draining) return;
      draining = true;
      step();
    }

    function step() {
      var next = pending;
      pending = null;
      if (!next || !speakable(next)) { draining = false; return; }
      play(next, function (outcome) {
        if (outcome === "aborted") { draining = false; return; }
        if (outcome === "ok") sawClip(); else sawFailure();
        // A breath between two words. Run together they are one long word to
        // a child still learning where one ends.
        setTimeout(step, SPEAK_GAP_MS);
      });
    }

    /* Play one clip through the shared element, and call back exactly once
       with "ok" (it was heard, or it arrived and was no longer wanted),
       "failed" (it never arrived) or "aborted" (the round moved under it).

       The gate is asked again on `playing`, because that is where the time
       goes: a clip that was not in the cache can start a second after the
       tile it names crossed the line, and by then it names the wrong tile.
       Stopping it there costs a frame of sound at worst.

       A take that will not load falls back to the take before, inside this
       same play and under the same start timer (see failed), so the word can
       still be heard in its window. */
    function play(item, done) {
      var settled = false;
      var timer = null;
      var attempt = 0;         // bumped by every src this play sets
      var missed = [];         // URLs of the takes this play fell back from

      function off() {
        clearTimeout(timer);
        abort = null;
        el.removeEventListener("playing", onPlaying);
        el.removeEventListener("ended", onEnded);
        el.removeEventListener("error", onError);
      }
      function finish(outcome) {
        if (settled) return;
        settled = true;
        off();
        // a clip that never arrived may be asked for again by a later warm-up,
        // and so may every take this play fell back from on the way to it
        if (outcome === "failed") {
          delete known[clipUrl(item.lang, item.object)];
          for (var i = 0; i < missed.length; i++) delete known[missed[i]];
        }
        done(outcome);
      }
      function stop() {
        try { el.pause(); } catch (e) {}
      }
      function onPlaying() {
        el.removeEventListener("playing", onPlaying);
        // The take before arrived, so the host answered: the takes this play
        // fell back from really are not on the bucket.
        for (var i = 0; i < missed.length; i++) missing[missed[i]] = true;
        if (!speakable(item)) { stop(); finish("ok"); return; }
        // It is under way and wanted; from here only its own length matters.
        clearTimeout(timer);
        // `ended` is what normally finishes this; the timer only stops a
        // stalled clip from holding the speaker for the rest of the round.
        var left = isFinite(el.duration) && el.duration > 0
          ? (el.duration - el.currentTime) * 1000 + END_GRACE_MS
          : LONGEST_CLIP_MS;
        timer = setTimeout(function () { stop(); finish("ok"); }, left);
      }
      function onEnded() { finish("ok"); }
      function failed(mine) {
        if (settled || mine !== attempt) return;   // an earlier src, or already done
        var prev = previousTake(item.object);
        // MEDIA_ERR_SRC_NOT_SUPPORTED is what a 404's HTML body gives: a take
        // the manifest named but the bucket has not got. It is also what any
        // request that fails before its first byte gives — a 5xx, a refused
        // or dropped connection — and this cannot tell them apart. So the
        // play falls back to the take before either way, as the app's
        // VoiceCache does on a 404, but the take is only written off once the
        // one before it starts playing (onPlaying), which proves the host
        // answered; the app, too, records only a 404. If that one fails as
        // well, it was the network, and the take is tried again next time.
        // Any other code is a failure.
        if (prev !== null && el.error && el.error.code === 4) {
          missed.push(clipUrl(item.lang, item.object));
          item.object = prev;
          load();
          return;
        }
        stop();
        finish("failed");
      }
      function onError() { failed(attempt); }
      function load() {
        var mine = ++attempt;
        var url = clipUrl(item.lang, item.object);
        known[url] = true;
        el.src = url;
        var started = el.play();
        if (started && started.catch) started.catch(function () { failed(mine); });
      }

      abort = function () { stop(); finish("aborted"); };
      el.addEventListener("playing", onPlaying);
      el.addEventListener("ended", onEnded);
      el.addEventListener("error", onError);
      timer = setTimeout(function () { stop(); finish("failed"); }, START_TIMEOUT_MS);

      load();
    }

    // -------------------------------------------------------- the warm-up

    /* Each word's clip is asked for the moment its tile is placed, 1.25-1.6 s
       before the tile crosses the speak line, and the words still in the air
       are asked for whenever this becomes able to fetch: the START tap, the
       switch, a return to the page, the network coming back. That is about 22
       files and 90 KB in a first minute at level one, where warming whole
       levels (three hundred words a level now) cost 600 files and 2.5 MB on
       the first tap.

       This fetches far less than the app's _warmVoice, on purpose. The app
       warms every reachable word into a disk cache of its own, which is also
       what lets it speak offline. The page has only the browser's HTTP cache,
       which it cannot inspect, and it cannot speak offline anyway — say()
       returns while !online — so a clip fetched a level ahead buys it far
       less.

       At most WARM_CONCURRENCY in flight and WARM_QUEUE_MAX waiting, a
       failure retried once, no gap between requests and no waiting on a word
       being played: a lane that holds one request per tile has nothing to
       spread out, and every millisecond it waits comes off that tile's lead.
       Every clip is immutable and cached for a year, so a second round in the
       same browser asks the network for nothing it already has. */

    /* The take to ask for: the one words.js names, stepped down past any take
       this visit has written off as not on the bucket (see play). */
    function objectFor(word, lang) {
      var object = clipFor(word, lang);
      while (object !== null && missing[clipUrl(lang, object)]) {
        var prev = previousTake(object);
        if (prev === null) break;
        object = prev;
      }
      return object;
    }

    // Before the first probe has answered, a warm-up may already go: a clip
    // that arrives is itself a yes (sawClip), and tile 1 of a round should
    // not wait out a round trip it could share. A probe that has said no
    // stops it until the back-off says yes.
    function canWarm() { return active && (online || !asked); }

    /* Ask for these words' clips now. Words with no clip and URLs already
       asked for this page-load are skipped. */
    function warm(words, lang) {
      if (!canWarm() || !window.fetch) return;
      for (var i = 0; i < words.length; i++) {
        var object = objectFor(words[i], lang);
        if (object === null) continue;
        var url = clipUrl(lang, object);
        if (known[url]) continue;
        known[url] = true;
        queue.push({ url: url, retried: false });
        pumpWarm();
        // only on a link so slow three are still out: the oldest waiting
        // word is the one most likely already too late
        if (queue.length > WARM_QUEUE_MAX) delete known[queue.shift().url];
      }
    }

    function pumpWarm() {
      while (canWarm() && warming < WARM_CONCURRENCY && queue.length) warmOne(queue.shift());
    }

    /* One clip into the browser's cache. `no-cors` because the bucket sets no
       CORS policy and this needs none: the response is opaque and not a byte
       of it is read here — the element reads it later, from the cache.
       `force-cache` because a content-addressed file cannot go stale, so a
       revalidation round-trip would be pure cost. */
    function warmOne(job) {
      var done = false;
      warming++;
      // A request still out after WARM_TIMEOUT_MS counts as failed, so stalled
      // requests cannot hold the lane's slots for the rest of the visit, and it
      // is aborted where the browser can abort. Left open, its retry and the
      // next job would put more than WARM_CONCURRENCY requests on a link that
      // is already struggling; a word whose file never came is fetched by the
      // element when it is said. Whichever comes first settles it, and only
      // once.
      var ctl = window.AbortController ? new window.AbortController() : null;
      var cap = setTimeout(function () {
        if (ctl) ctl.abort();
        settle(false);
      }, WARM_TIMEOUT_MS);
      var init = {
        mode: "no-cors", cache: "force-cache",
        credentials: "omit", referrerPolicy: "no-referrer"
      };
      if (ctl) init.signal = ctl.signal;
      window.fetch(job.url, init).then(function () { settle(true); }, function () { settle(false); });
      function settle(ok) {
        if (done) return;
        done = true;
        clearTimeout(cap);
        warming--;
        if (ok) {
          sawClip();
        } else {
          // once more, at the front; after that the element fetches it when
          // the word is said, and a later warm may ask again
          if (active && !job.retried) { job.retried = true; queue.unshift(job); }
          else delete known[job.url];
          sawFailure();
        }
        pumpWarm();
      }
    }

    /* The words of the tiles not yet at the speak line, pulled whenever this
       becomes able to fetch, so a tile placed while it could not still gets
       its word asked for. inAir is optional: a page without it warms only
       what it hands to warm(). */
    function warmInAir() {
      if (!canWarm() || !opts.inAir) return;
      var air = opts.inAir();
      if (air && air.words && air.words.length) warm(air.words, air.lang);
    }

    // ------------------------------------------------------- reachability

    /* Whether the clips can be reached right now.

       A probe rather than navigator.onLine alone, for the same reason the app
       does not use a connectivity plugin: "there is an interface up" is not
       the question — a cafe portal, a school filter and a phone with no data
       all report a live one. This asks the only question that matters, by
       fetching the corpus manifest: the smallest thing on the host, beside
       the clips and served by the same bucket. It never runs on its own
       account — nothing here starts until the voice is switched on, so a
       player who has left it off generates no traffic whatsoever. */
    function startProbe() {
      if (probing) return;
      probing = true;
      // Only a return to the page believes a fresh yes (setAwake sets
      // `resuming`). The START tap, the switch and a new round still ask, as
      // the app's start() does. A wrong fresh yes corrects itself: the next
      // clip that fails to arrive sends a probe.
      if (resuming && navigator.onLine !== false) { setOnline(true); return; }
      probe();
    }

    function stopProbe() {
      probing = false;
      dropProbe();
      clearTimeout(probeTimer);
      probeTimer = null;
      failures = 0;
      if (online || asked) { online = false; asked = false; changed(); }
    }

    /* One probe at a time, as the app's check() is. The token is so a probe
       sent before a stop cannot answer for the start after it. A look is
       bounded at PROBE_TIMEOUT_MS, as the app's is, so one stalled request
       cannot hold the one slot for as long as the browser cares to wait: it
       answers no, and is aborted where the browser can abort. */
    function probe() {
      if (!probing || !awake || probeLive) return;
      // navigator.onLine is worth nothing when it says yes and everything
      // when it says no, so it is a shortcut past the request rather than the
      // answer itself.
      if (navigator.onLine === false || !window.fetch) { answer(false); return; }
      var mine = probeLive = ++probeSeq;
      var ctl = probeCtl = window.AbortController ? new window.AbortController() : null;
      probeCap = setTimeout(function () {
        if (ctl) ctl.abort();
        settleProbe(mine, false);
      }, PROBE_TIMEOUT_MS);
      var init = {
        mode: "no-cors", cache: "no-store",
        credentials: "omit", referrerPolicy: "no-referrer"
      };
      if (ctl) init.signal = ctl.signal;
      // A late settle, or the abort's own rejection, is ignored by the token.
      window.fetch(BASE + "/" + SCHEMA + "/manifest.json", init).then(
        function () { settleProbe(mine, true); },
        function () { settleProbe(mine, false); });
    }

    function settleProbe(mine, ok) {
      if (mine !== probeLive) return;
      clearTimeout(probeCap);
      probeCap = probeCtl = null;
      probeLive = 0;
      answer(ok);
    }

    /* Forget the probe in flight, if there is one: its token, its time cap
       and, where the browser can abort, the request itself. Without the
       abort, a probe dropped by a network change stayed open beside the
       fresh one, two requests for one question, and its cap fired later
       only to be ignored. */
    function dropProbe() {
      clearTimeout(probeCap);
      if (probeCtl) probeCtl.abort();
      probeCap = probeCtl = null;
      probeLive = 0;
    }

    function answer(ok) {
      if (!probing) return;
      lastAnswer = now();
      clearTimeout(probeTimer);
      probeTimer = null;
      if (ok) {
        failures = 0;
        // Wall clock, not now(): a monotonic clock on iOS and macOS stands
        // still while the device sleeps, and the fresh rule is about time
        // passed in the world.
        lastYesAt = Date.now();
      } else {
        var wait = BACKOFF_MS[Math.min(failures, BACKOFF_MS.length - 1)];
        failures++;
        // Keep asking while it is off, so the control lights up by itself
        // when the wifi comes back rather than waiting for the player to
        // guess.
        probeTimer = setTimeout(probe, wait);
      }
      setOnline(ok);
    }

    /* A clip arrived. That is better evidence than any probe, and it costs
       nothing to believe it — while the probe runs. A request that lands after
       the switch went off or the page was hidden must not light a voice that
       has stopped. */
    function sawClip() {
      if (!probing) return;
      failures = 0;
      clearTimeout(probeTimer);
      probeTimer = null;
      lastAnswer = now();
      lastYesAt = Date.now();
      setOnline(true);
    }

    /* A clip did not arrive. One failure is not an outage — a single dropped
       packet, a 500 from the edge — so this does not flip the answer. It
       schedules a look, unless one is already out, and only the manifest gets
       to say we are offline. */
    function sawFailure() {
      if (!probing || !awake || probeLive) return;
      if (lastAnswer && now() - lastAnswer < RECHECK_MS) return;
      probe();
    }

    function setOnline(value) {
      if (asked && value === online) return;
      asked = true;
      online = value;
      // A take written off while the take before it came out of the browser's
      // cache proves nothing about the host, and a no is the moment to doubt
      // it: every take written off is tried again once the answer is yes.
      if (!value) missing = {};
      if (value && active) { pumpWarm(); warmInAir(); }
      announceIfJustLive();
      changed();
    }

    // The browser's own opinion is free, and a machine that has just been
    // handed a network should not wait out a back-off that can now be fifteen
    // minutes long. Either event drops the probe in flight, its request and its
    // cap included: a request sent before the network changed can then neither
    // answer a second time nor swallow the `online` event and answer no a
    // moment later.
    window.addEventListener("online", function () { if (probing) { dropProbe(); probe(); } });
    window.addEventListener("offline", function () { if (probing) { dropProbe(); answer(false); } });

    return {
      /* The player's switch, whatever their entitlement. The button reads
         this so it shows what they chose, not what they are owed. */
      get on() { return wanted; },
      get entitled() { return entitled(); },
      /* Entitled, and with something to fetch from. */
      get available() { return entitled() && online; },
      get live() { return active; },

      /* Turn it on or off. The caller has already dealt with entitlement; a
         player past the free levels never gets here, they get the offer. */
      toggle: function () {
        wanted = !wanted;
        writePref(STORE_KEY, wanted ? "1" : "0");
        sync();
      },

      unlock: unlock,
      say: say,
      hush: hush,
      warm: warm,
      refresh: sync,
      awake: setAwake
    };
  }

  return { create: create, clipUrl: clipUrl, clipFor: clipFor };
})();
