/* The sounds a poked creature makes.

   The only sound on the page that is not a spoken word, and it works nothing
   like one. A word is a remote file, fetched once and played through the one
   element iOS will let us have; these are six small local clips that have to
   answer a finger immediately and may overlap, because a creature can be
   poked as fast as it can be tapped.

   So this is Web Audio rather than <audio>. Same-origin buffers decode once
   and play from memory with no start-up cost, any number at a time, and gain,
   pitch and pan come for free - which the poke needs, because a creature is
   heard where it is seen: quieter and a shade lower the further off it was
   drawn, out of the side of the field it is crossing. The app does exactly
   this in Feel.poke; the numbers below are its numbers.

   The context is created on the first poke and not before. A poke is a tap,
   so there is always a gesture on the stack when it matters, and a visitor
   nobody touches costs nothing at all. */
window.SYVT_SFX = (function () {
  "use strict";

  var BASE = "sfx/";

  /* Feel._pokeGain. Louder than a game cue in the app, because a poke is
     rarer than a swipe and is the player's own doing. */
  var GAIN = 0.55;

  /* How far off a creature is takes 45% of the volume and 10% of the pitch,
     and its position across the field takes 60% of the stereo width. The
     scenery already draws a distant visitor smaller, slower and fainter;
     these are the same number said out loud. */
  var DEPTH_GAIN = 0.45;
  var DEPTH_PITCH = 0.10;
  var PAN_WIDTH = 0.6;

  /* A little pitch either way so a run of taps is not one sample repeating. */
  var JITTER = 0.06;

  /* A creature ought to answer every tap, so this is short - but two copies
     of one clip landing in the same millisecond is a click, not a sound. */
  var MIN_GAP_MS = 30;

  var ctx = null;
  var buffers = {};      // name -> AudioBuffer, once decoded
  var pending = {};      // name -> true while its fetch is in flight
  var lastAt = {};       // name -> when it last played
  var failed = false;

  function now() { return performance.now(); }

  /* Created on demand, and resumed every time: a context can be suspended by
     the browser at any point after it was made, and the poke that needs it is
     always inside a gesture, which is the one moment resume() is allowed. */
  function context() {
    if (failed) return null;
    try {
      if (!ctx) {
        var C = window.AudioContext || window.webkitAudioContext;
        if (!C) { failed = true; return null; }
        ctx = new C();
      }
      if (ctx.state === "suspended") ctx.resume();
      return ctx;
    } catch (e) {
      failed = true;
      return null;
    }
  }

  function load(name) {
    if (buffers[name] || pending[name]) return;
    var c = context();
    if (!c) return;
    pending[name] = true;
    window.fetch(BASE + name + ".wav", { credentials: "omit" })
      .then(function (r) { return r.ok ? r.arrayBuffer() : Promise.reject(r.status); })
      .then(function (bytes) {
        return new Promise(function (ok, no) {
          // the callback form, because Safari's decodeAudioData returns
          // nothing and only calls back
          var p = c.decodeAudioData(bytes, ok, no);
          if (p && p.then) p.then(ok, no);
        });
      })
      .then(function (buf) { buffers[name] = buf; delete pending[name]; },
            function () { delete pending[name]; });
  }

  /* Play one clip. `depth` is 0 close by and 1 far away; `pan` is -1 at the
     left edge of the field and 1 at the right. A clip that has not finished
     decoding yet simply does not sound: the first poke of a session may be
     silent, and the second will not be, which is a better trade than holding
     a finger's answer back until a file arrives. */
  function play(name, depth, pan) {
    if (!name) return;
    var c = context();
    if (!c) return;
    var buf = buffers[name];
    if (!buf) { load(name); return; }
    var t = now();
    if (lastAt[name] && t - lastAt[name] < MIN_GAP_MS) return;
    lastAt[name] = t;

    var d = depth < 0 ? 0 : depth > 1 ? 1 : depth;
    var p = pan < -1 ? -1 : pan > 1 ? 1 : pan;
    try {
      var src = c.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = (1 + (Math.random() * 2 - 1) * JITTER) *
                               (1 - DEPTH_PITCH * d);
      var gain = c.createGain();
      gain.gain.value = (1 - DEPTH_GAIN * d) * GAIN;
      // StereoPannerNode is not everywhere; without it the clip is centred,
      // which is the part of the effect that matters least
      if (c.createStereoPanner) {
        var pan3 = c.createStereoPanner();
        pan3.pan.value = p * PAN_WIDTH;
        src.connect(pan3); pan3.connect(gain);
      } else {
        src.connect(gain);
      }
      gain.connect(c.destination);
      src.start();
    } catch (e) {
      // a creature that did not squeak is a creature that still jumped
    }
  }

  /* Warm the clips a theme can actually use, so the first poke has a voice.
     Called on the START tap, where there is a gesture and the context may be
     created; before that this file does nothing and fetches nothing. */
  function warm(names) {
    for (var i = 0; i < names.length; i++) if (names[i]) load(names[i]);
  }

  return { play: play, warm: warm };
})();
