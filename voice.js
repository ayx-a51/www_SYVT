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
   event before a syllable is out. The warm-up is what makes that rare: by the
   time a word falls, its file is normally already in the browser's cache and
   playback starts in a frame or two.

   ## No CORS, deliberately

   A media element fetches cross-origin without a CORS policy, and the warm-up
   asks in `no-cors` mode and never reads a byte of what comes back — it only
   wants the file in the browser's cache, where the element will look for it.
   So this needs no policy on the bucket (see tool/tts/README.md in the app
   repo), and the corpus stays exactly as the app left it. */
window.SYVT_VOICE = (function () {
  "use strict";

  /* Where the corpus is published, and how a clip is addressed — the same
     constants as lib/voice/speech_key.dart. The ids themselves are computed
     by make-words.py and looked up in SYVT_CLIPS; nothing is hashed here,
     because a third implementation of the normaliser and the hash would be a
     third chance to drift, and a drifted hash does not throw — it misses
     every file and the voice goes quiet with no error anywhere. */
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
  var WARM_GAP_MS = 40;

  /* How long to wait before looking again after the corpus failed to answer.
     Backs off, so a phone with no signal is not asking every five seconds,
     and caps well under the length of a round. */
  var BACKOFF_MS = [4000, 10000, 30000, 120000];
  var RECHECK_MS = 20000;   // a floor on how often a failed clip may re-probe

  function clipUrl(lang, id) {
    return BASE + "/" + SCHEMA + "/" + lang + "/" + id.slice(0, 2) + "/" + id + ".mp3";
  }

  /* The id of a spoken word, or null when the page has none for it — a sum,
     or a word above the levels the free voice reads. Own-property only: the
     map is generated, but a lookup that answered for "constructor" would hand
     the round a function where it wants twenty hex characters. */
  function clipFor(word, lang) {
    var byLang = window.SYVT_CLIPS && window.SYVT_CLIPS[lang];
    if (!byLang || !Object.prototype.hasOwnProperty.call(byLang, word)) return null;
    var id = byLang[word];
    return typeof id === "string" && /^[0-9a-f]{20}$/.test(id) ? id : null;
  }

  /* opts:
       entitled()            whether the player may hear the voice here
       stillFalling(tileId)  whether that tile is still on its way down
       onChange()            the button should redraw
       onLive()              this just became able to speak */
  function create(opts) {
    var STORE_KEY = "syvt.voice";

    // On by default, as in the app: a voice nobody has ever heard is a line
    // on a card.
    var wanted = localStorage.getItem(STORE_KEY) !== "0";
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

    var known = {};          // ids warmed or spoken this page-load
    var queue = [];
    var warming = 0;
    var demand = 0;          // a tile is waiting on its own word right now

    // reachability
    var online = false, asked = false, probing = false, failures = 0;
    var probeTimer = null, lastAnswer = 0;

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
       stops. */
    function sync() {
      var next = entitled() && wanted && awake && unlocked;
      if (next === active) { changed(); return; }
      active = next;
      if (next) startProbe(); else stopWork();
      announceIfJustLive();
      changed();
    }

    function setAwake(value) {
      if (value === awake) return;
      awake = value;
      if (!value) hush();
      sync();
      if (value && active) probe();
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

    /* Everything stops: the voice, the queue and the probe. This is what
       "off downloads nothing" is made of.

       `warming` and `demand` are NOT reset here, though it looks tidy to do
       it. They count requests that are still running, and this cancels
       nothing: each decrements in its own handler, so zeroing them makes the
       next decrement take them negative — and pumpWarm waits for demand === 0,
       so the warm-up would never run again for the rest of the session.
       Nothing restarts while off: pumpWarm returns on !active. */
    function stopWork() {
      active = false;
      hush();
      queue.length = 0;
      known = {};
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
      var id = clipFor(word, lang);
      if (id === null) return;
      // Last in wins: a newer tile's word displaces an older one that has not
      // managed to be said yet.
      pending = { id: id, lang: lang, tileId: tileId, postedAt: now(), epoch: epoch };
      drain();
    }

    /* Cut off whatever is being said, and abandon whatever was about to be.
       The round stopped, or the language under it changed. */
    function hush() {
      epoch++;
      pending = null;
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
      demand++;
      play(next, function (outcome) {
        demand--;
        if (outcome === "aborted") { draining = false; return; }
        if (outcome === "ok") sawClip(); else sawFailure();
        pumpWarm();
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
       Stopping it there costs a frame of sound at worst. */
    function play(item, done) {
      var settled = false;
      var timer = null;

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
        done(outcome);
      }
      function stop() {
        try { el.pause(); } catch (e) {}
      }
      function onPlaying() {
        el.removeEventListener("playing", onPlaying);
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
      function onError() { stop(); finish("failed"); }

      abort = function () { stop(); finish("aborted"); };
      el.addEventListener("playing", onPlaying);
      el.addEventListener("ended", onEnded);
      el.addEventListener("error", onError);
      timer = setTimeout(function () { stop(); finish("failed"); }, START_TIMEOUT_MS);

      known[item.id] = true;
      el.src = clipUrl(item.lang, item.id);
      var started = el.play();
      if (started && started.catch) {
        started.catch(function () { finish("failed"); });
      }
    }

    // -------------------------------------------------------- the warm-up

    /* The words that could fall next, so they are in the browser's cache
       before they do. Called when a round starts and again at every level:
       the reachable set is two hundred small files, about 900 KB in all, and
       every one of them is immutable and cached for a year, so a second round
       in the same browser asks the network for nothing. */
    function warm(words, lang) {
      if (!active || !online) return;
      for (var i = 0; i < words.length; i++) {
        var id = clipFor(words[i], lang);
        if (id === null || known[id]) continue;
        known[id] = true;
        queue.push({ lang: lang, id: id });
      }
      pumpWarm();
    }

    /* One request per WARM_GAP_MS, at most WARM_CONCURRENCY in flight, and
       none at all while a tile is waiting on its own word. Spreading the
       issue rate is the point: the words are wanted before they fall, not all
       in the first second of the round. */
    function pumpWarm() {
      if (!active || !online || demand > 0) return;
      if (warming >= WARM_CONCURRENCY || !queue.length) return;
      warmOne(queue.shift());
      setTimeout(pumpWarm, WARM_GAP_MS);
    }

    /* One clip into the browser's cache. `no-cors` because the bucket sets no
       CORS policy and this needs none: the response is opaque and not a byte
       of it is read here — the element reads it later, from the cache.
       `force-cache` because a content-addressed file cannot go stale, so a
       revalidation round-trip would be pure cost. */
    function warmOne(job) {
      warming++;
      if (!window.fetch) { settle(false); return; }
      window.fetch(clipUrl(job.lang, job.id), {
        mode: "no-cors", cache: "force-cache",
        credentials: "omit", referrerPolicy: "no-referrer"
      }).then(function () { settle(true); }, function () {
        // A word that did not arrive is a word said late, once, later.
        settle(false);
      });
      function settle(ok) {
        warming--;
        if (ok) sawClip(); else sawFailure();
        if (active) pumpWarm();
      }
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
      probe();
    }

    function stopProbe() {
      probing = false;
      clearTimeout(probeTimer);
      probeTimer = null;
      failures = 0;
      if (online || asked) { online = false; asked = false; changed(); }
    }

    function probe() {
      if (!probing || !awake) return;
      // navigator.onLine is worth nothing when it says yes and everything
      // when it says no, so it is a shortcut past the request rather than the
      // answer itself.
      if (navigator.onLine === false) { answer(false); return; }
      if (!window.fetch) { answer(false); return; }
      window.fetch(BASE + "/" + SCHEMA + "/manifest.json", {
        mode: "no-cors", cache: "no-store",
        credentials: "omit", referrerPolicy: "no-referrer"
      }).then(function () { answer(true); }, function () { answer(false); });
    }

    function answer(ok) {
      if (!probing) return;
      lastAnswer = now();
      clearTimeout(probeTimer);
      probeTimer = null;
      if (ok) {
        failures = 0;
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
       nothing to believe it. */
    function sawClip() {
      failures = 0;
      clearTimeout(probeTimer);
      probeTimer = null;
      lastAnswer = now();
      setOnline(true);
    }

    /* A clip did not arrive. One failure is not an outage — a single dropped
       packet, a 500 from the edge — so this does not flip the answer. It
       schedules a look, and only the manifest gets to say we are offline. */
    function sawFailure() {
      if (!probing || !awake) return;
      if (lastAnswer && now() - lastAnswer < RECHECK_MS) return;
      probe();
    }

    function setOnline(value) {
      if (asked && value === online) return;
      asked = true;
      online = value;
      if (value && active) pumpWarm();
      announceIfJustLive();
      changed();
    }

    // The browser's own opinion is free, and a machine that has just been
    // handed a network should not wait out a two-minute backoff.
    window.addEventListener("online", function () { if (probing) probe(); });
    window.addEventListener("offline", function () { if (probing) answer(false); });

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
        localStorage.setItem(STORE_KEY, wanted ? "1" : "0");
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
