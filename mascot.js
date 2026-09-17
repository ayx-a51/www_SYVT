/* SYVT, the alien, and the saucer he travels in.

   A port of the app's `lib/ui/mascot/syvt_art.dart` and the panel half of
   `syvt_mascot.dart`. He comes from the painted logo: a round purple fellow
   with two antennae - a red ball on his left, a green one on his right, the
   game's own wrong-and-right - happy closed eyes, pink cheeks and a big
   laugh, cheering out of a sorting pit with a red bucket on his left and a
   green one on his right. He is drawn the way everything else on the field
   is: coarse rounded shapes, each part filled with a soft ramp of its own
   colour, and nothing outlined. The saucer is the pit with a hull under it.

   He is on the CHILDREN'S side only, beside the name on the start and
   game-over panels, which is one of the three places the app puts him. The
   other two are not here: he is not a visitor crossing the worlds, and
   there is no pause veil for him to doze under, so the app's `Presence` -
   the record that keeps one person from being on screen twice - has nothing
   to arbitrate and is not ported. Add either and it comes with it.

   Every number below is the app's, in its 120 x 110 box; the panel scales
   that box to 72 design px tall and the stylesheet scales design px to the
   screen, as everything else here does. */
window.SYVT_MASCOT = (function () {
  "use strict";

  // ------------------------------------------------------------- colours

  /* His own, the same in every world. What a world lends him is the light
     he is modelled in, and the panel always lends him the plain one: lit
     white, shaded and inked in his own deep violet. */
  var SKIN = "#9E74EE", SKIN_LIT = "#D9C4FF", SKIN_DEEP = "#6A47C8";
  var CHEEK = "rgba(247,179,227,.851)";
  var FACE = "#2A1F45", MOUTH = "#2A1436", TONGUE = "#F2405A";
  var RED = "#FF4D5E", RED_LIT = "#FFB3BA";
  var GREEN = "#3CE87E", GREEN_LIT = "#B8FFD2";
  var BUCKET_RED = "#E8384F", BUCKET_RED_LIP = "#FF6B7A", BUCKET_RED_IN = "#8E1E1A";
  var BUCKET_GREEN = "#23A85F", BUCKET_GREEN_LIP = "#5CC98A", BUCKET_GREEN_IN = "#0A4A2C";
  var HULL = "#D3CDF9", HULL_DEEP = "#9A90E0", WELL = "#5A4FA8";
  var PANEL = "#4A4580", SLOT = "#7FD3FF", BUTTON = "#FFD166";
  var LAMP = "#FFD166", LAMP_OFF = "#6A5FCF", ENGINE = "#7FD3FF";
  var WHITE = "#FFFFFF";

  // his box: antenna balls at the top, the hull's underside at the bottom
  var BOX_W = 120, BOX_H = 110;

  /* How far the whole craft is tipped, radians, anticlockwise: his right
     side rides a little high. About six and a half degrees, which is enough
     to look airborne and not enough to look like it is falling over. */
  var TILT = -0.115;

  function rad(d) { return d * Math.PI / 180; }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // ------------------------------------------------------------- drawing

  /* Draws him into the 120 x 110 box with its top-left corner at the
     origin. `pose` is what he is doing; see the defaults in `pose()`.

     The app's `paintSyvt` also undoes the visitor layer's mirroring so that
     red stays on his left whichever way the saucer is crossing - a sorting
     pit with the buckets swapped would be teaching the wrong grammar. The
     panel never mirrors him, so that clause has nothing to do here and is
     left out rather than written and never run. */
  function paintSyvt(ctx, pose) {
    var k = window.SYVT_SCENERY.kit(ctx, WHITE, FACE, FACE);
    ctx.save();
    /* The craft sits at a jaunty angle, always: level, he was a cake with a
       face on it. The tilt turns everything about the saucer's heart, and a
       caller's lean is added to it. */
    ctx.translate(BOX_W / 2, 82);
    ctx.rotate(TILT + pose.lean);
    ctx.translate(-BOX_W / 2, -82);

    saucerBack(k, pose);
    alien(k, pose);
    saucerFront(k, pose);
    // the forearms and hands come last: a hand laid on a bucket has to be
    // ON the bucket, and the buckets stand in front of him
    foreArm(k, pose.leftArm, 0, -1);
    foreArm(k, pose.rightArm, pose.swing, 1);

    ctx.restore();
  }

  // the hull, the rim plate and the well he sits in
  function saucerBack(k, pose) {
    var c = k.c;
    // the engine's glow under the hull
    k.dot(60, 100, 16, "rgba(127,211,255,.18)");
    k.blot(44, 96, 76, 105, "rgba(127,211,255,.45)");
    // the underside, then the rim plate over it
    k.oval(16, 76, 104, 102, HULL_DEEP);
    k.oval(4, 66, 116, 90, HULL);
    // a glint along the rim's far shoulder
    c.beginPath();
    c.ellipse(60, 78, 51, 9, 0, rad(195), rad(255));
    c.lineWidth = 2;
    c.lineCap = "round";
    c.strokeStyle = "rgba(255,255,255,.7)";
    c.stroke();
    // the well he pops out of, dark, set a little back from the rim's middle
    k.blot(26, 64, 94, 82, WELL);
    k.blot(30, 66, 90, 78, "rgba(42,31,69,.35)");
  }

  /* Where one arm's elbow and hand are: `raise` 0 lays the hand on the lip
     of its bucket, 1 puts it up beside his head. `swing` moves a raised hand
     from side to side; `side` is -1 for his left arm. */
  function armPoints(raise, swing, side) {
    var r = clamp(raise, 0, 1);
    function at(x, y) { return [60 + side * (x - 60), y]; }
    var a = at(81, 60), b = at(86, 51);
    var c = at(93, 57), d = at(90, 33);
    return {
      shoulder: at(73, 57),
      elbow: [lerp(a[0], b[0], r), lerp(a[1], b[1], r)],
      hand: [lerp(c[0], d[0], r) + side * 3 * swing * r,
             lerp(c[1], d[1], r) - 2 * Math.abs(swing) * r]
    };
  }

  function segment(k, a, b, w, colour) {
    k.limb(function (c) { c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); },
           w, colour, Math.min(a[1], b[1]), Math.max(a[1], b[1]));
  }

  // the upper arm, which is drawn behind the saucer's front
  function upperArm(k, raise, swing, side) {
    var p = armPoints(raise, swing, side);
    segment(k, p.shoulder, p.elbow, 8, SKIN);
  }

  function foreArm(k, raise, swing, side) {
    var p = armPoints(raise, swing, side);
    segment(k, p.elbow, p.hand, 7.4, SKIN);
    mitt(k, p.hand, side > 0 ? rad(18 * swing) : rad(180 - 18 * swing));
  }

  /* One hand: a rounded mitt with a thumb, turned to `angle`. A disc reads
     as a ball on the end of a stick; this reads as a hand. */
  function mitt(k, o, angle) {
    k.c.save();
    k.c.translate(o[0], o[1]);
    k.c.rotate(angle);
    k.oval(-6.2, -5.25, 6.2, 5.25, SKIN);
    k.disc(-3.4, -3.1, 2.8, SKIN);
    k.c.restore();
  }

  // him: body, arms, head, face, antennae, drawn between the well and the
  // saucer's front, so he sits in it
  function alien(k, pose) {
    var c = k.c;
    // the body: shoulders for the arms to hang from, and a waist that goes
    // down into the well
    k.shape(function (x) {
      x.moveTo(46, 78);
      x.lineTo(45, 60);
      x.quadraticCurveTo(46, 52, 54, 51);
      x.lineTo(66, 51);
      x.quadraticCurveTo(74, 52, 75, 60);
      x.lineTo(74, 78);
    }, SKIN, 51, 78);
    upperArm(k, pose.leftArm, 0, -1);
    upperArm(k, pose.rightArm, pose.swing, 1);

    // antennae, before the head so their roots are under it
    segment(k, [49, 22], [38, 10], 4, SKIN_DEEP);
    segment(k, [71, 22], [82, 10], 4, SKIN_DEEP);
    var glow = clamp(pose.pulse, 0, 1);
    if (glow > 0) {
      k.dot(36, 8, 11, "rgba(255,77,94," + (0.35 * glow) + ")");
      k.dot(84, 8, 11, "rgba(60,232,126," + (0.35 * glow) + ")");
    }
    k.disc(36, 8, 7, RED);
    k.disc(84, 8, 7, GREEN);
    k.blot(32, 3.5, 38, 7.5, RED_LIT);
    k.blot(80, 3.5, 86, 7.5, GREEN_LIT);

    // The head is an egg rather than a disc - a wide crown over a narrower
    // chin - in the same box the disc filled, so nothing around it moves.
    k.shape(function (x) {
      x.moveTo(81, 38);
      x.bezierCurveTo(81, 25, 72, 17, 60, 17);
      x.bezierCurveTo(48, 17, 39, 25, 39, 38);
      x.bezierCurveTo(39, 50, 48, 59, 60, 59);
      x.bezierCurveTo(72, 59, 81, 50, 81, 38);
    }, SKIN, 17, 59);
    k.blot(52, 21, 71, 30, "rgba(217,196,255,.6)");
    // the light along his crown and the shade his own chin casts: what tells
    // a round head from a flat circle
    arc(c, 60, 38, 19.5, 205, 80, 2.6, "rgba(255,255,255,.5)");
    arc(c, 60, 40, 19, 35, 75, 3.2, "rgba(42,31,69,.1)");
    k.blot(50, 56, 60, 66, "rgba(255,255,255,.1)");
    k.blot(41, 41, 51, 48, CHEEK);
    k.blot(69, 41, 79, 48, CHEEK);

    // eyes
    var eyes = [[51, 37], [69, 37]], i;
    if (pose.asleep) {
      for (i = 0; i < 2; i++) {
        k.seg(eyes[i][0] - 5, eyes[i][1] + 1, eyes[i][0] + 5, eyes[i][1] + 1, 3, FACE);
      }
    } else if (pose.happy) {
      for (i = 0; i < 2; i++) arc(c, eyes[i][0], eyes[i][1], 5.5, 200, 140, 3.2, FACE);
    } else {
      for (i = 0; i < 2; i++) {
        k.disc(eyes[i][0], eyes[i][1], 6, WHITE);
        k.dot(eyes[i][0] + 0.6, eyes[i][1] + 1.2, 3.4, FACE);
        k.dot(eyes[i][0] - 1.2, eyes[i][1] - 1.4, 1.3, WHITE);
      }
    }

    // the mouth: the big laugh, a closed smile, or a sleeper's o
    if (pose.asleep) {
      k.disc(60, 49, 3, MOUTH);
      zzz(k, pose.zzz);
    } else if (pose.mouth < 0.35) {
      arc(c, 60, 46, 8, 20, 140, 2.8, FACE);
    } else {
      var open = clamp(pose.mouth, 0.35, 1), depth = 14 * open;
      var shape = function (x) {
        x.moveTo(50, 45);
        x.quadraticCurveTo(60, 43, 70, 45);
        x.quadraticCurveTo(70, 45 + depth, 60, 45 + depth);
        x.quadraticCurveTo(50, 45 + depth, 50, 45);
      };
      k.wash(shape, MOUTH);
      c.save();
      k.trace(shape);
      c.clip();
      k.blot(53, 45 + depth * 0.5, 67, 45 + depth + 3, TONGUE);
      c.restore();
    }
  }

  // an arc of a circle, from `from` degrees through `sweep` of them
  function arc(c, cx, cy, r, from, sweep, width, colour) {
    c.beginPath();
    c.arc(cx, cy, r, rad(from), rad(from + sweep));
    c.lineWidth = width;
    c.lineCap = "round";
    c.strokeStyle = colour;
    c.stroke();
  }

  /* The Zs a sleeper lets off: three, each rising and fading in turn.
     Nothing on this page is asleep yet — the app dozes him under the pause
     veil and the page has none — so this and the sleeping eyes and mouth
     above are here for the day it does, not for today.

     The remainder is taken the way Dart takes it, which keeps the sign of
     the divisor: `%` in JavaScript keeps the sign of the dividend instead,
     and the first half-second of each Z would be skipped rather than
     drawn. */
  function zzz(k, phase) {
    for (var i = 0; i < 3; i++) {
      var p = (((phase - i * 0.45) % 2.4) + 2.4) % 2.4 / 2.4;
      var size = 4 + i * 1.6;
      var x = 78 + i * 7 + 6 * p, y = 30 - i * 7 - 18 * p;
      k.stroke(function (c) {
        c.moveTo(x - size / 2, y - size / 2);
        c.lineTo(x + size / 2, y - size / 2);
        c.lineTo(x - size / 2, y + size / 2);
        c.lineTo(x + size / 2, y + size / 2);
      }, 1.8, "rgba(42,31,69," + ((1 - p) * 0.9) + ")");
    }
  }

  /* What stands on the rim in front of him: the two buckets, the console
     between them, and the lamps along the saucer's front. */
  function saucerFront(k, pose) {
    var c = k.c;
    // the red bucket, arrow left; the green one, arrow right
    bucket(k, 16, BUCKET_RED, BUCKET_RED_LIP, BUCKET_RED_IN, -1);
    bucket(k, 82, BUCKET_GREEN, BUCKET_GREEN_LIP, BUCKET_GREEN_IN, 1);
    // the console: a slot lit cyan and one gold button
    k.round(50, 68, 70, 82, 3.5, PANEL);
    c.beginPath();
    roundRect(c, 54, 71, 12, 3.5, 1.6);
    c.fillStyle = SLOT;
    c.fill();
    k.dot(60, 78.5, 2.3, BUTTON);
    // five lamps along the front of the rim, one lit, chasing
    var lit = Math.floor(pose.lights * 5) % 5;
    for (var i = 0; i < 5; i++) {
      var a = rad(30 + i * 30);
      var x = 60 + 50 * Math.cos(a), y = 78 + 8.5 * Math.sin(a);
      var on = i === lit;
      if (on) k.dot(x, y, 5, "rgba(255,209,102,.35)");
      k.dot(x, y, 2.6, FACE);
      k.dot(x, y, 1.8, on ? LAMP : LAMP_OFF);
    }
    // the rim's front lip, so the buckets stand in it rather than on it
    c.beginPath();
    c.ellipse(60, 78, 54, 10, 0, rad(10), rad(170));
    c.lineWidth = 3;
    c.lineCap = "round";
    c.strokeStyle = HULL;
    c.stroke();
  }

  /* One sorting bucket: a cup with a lighter lip, the dark inside, and a
     white arrow on its face pointing the way its words go. */
  function bucket(k, left, body, lip, inside, arrow) {
    var right = left + 22;
    k.round(left, 60, right, 82, 4, body);
    k.oval(left, 56, right, 64, lip);
    k.blot(left + 3, 57.5, right - 3, 62.5, inside);
    var cx = left + 11, cy = 72;
    k.seg(cx - 5, cy, cx + 5, cy, 2.4, WHITE);
    var tx = cx + 5 * arrow;
    k.seg(tx, cy, tx - 3.5 * arrow, cy - 3.5, 2.4, WHITE);
    k.seg(tx, cy, tx - 3.5 * arrow, cy + 3.5, 2.4, WHITE);
  }

  function roundRect(c, x, y, w, h, r) {
    if (c.roundRect) { c.roundRect(x, y, w, h, r); return; }
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // =========================================================== the panel

  /* His height beside the name, and the box that follows from it. The app's
     _Brand: his head and antennae rise above the letters and the saucer
     sits under their baseline, he is drawn `SHIFT` px left of his slot, and
     his slot is twelve px shorter than he is so the game-over panel still
     fits the field. */
  var H = 72;
  var W = H * BOX_W / BOX_H;            // 78.5454...
  var SLOT_H = 60;
  var SHIFT = 16;
  var ROUND_W = 250;                    // how far right the quick round reaches

  /* The canvas he flies in, in design px with the slot's top-left at the
     origin. It has to hold the whole flight - in from off the panel's left
     edge, a loop out over the letters, a jump when poked - because a canvas
     draws nothing outside itself; what leaves the PANEL is clipped by the
     panel, which is what the app's scroll view does to him too.

     These four numbers are measured rather than reasoned: his ink, swept
     over the arrival, a whole loop, a wave, a poke and a couple of breaths,
     runs x -152 to 227 and y -27 to 89, and each edge here keeps seven px
     or more beyond that. Two things make the box bigger than it looks. The
     engine's glow is a disc at y 100 with a radius of 16, so it reaches 116
     of his 110 box units - three quarters of his height BELOW his own feet.
     And the loop's second half swings him down as far as its first half
     swings him up, because `dy` takes a whole sine and not half of one. */
  var ENV_X = -160, ENV_Y = -34, ENV_W = 396, ENV_H = 130;

  // how long each thing he does takes, seconds
  var ARRIVE = 0.9, WAVE = 1.7, ROUND = 2.4, POKED = 1.2;

  function Mascot(canvas) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext("2d") : null;
    this.px = 0;
    this.cssW = 0;
    this.cssH = 0;
    this.here = false;
    this.t = 0;
    this.t0 = 0;
    this.waveAt = 0;
    this.roundAt = 0;
    this.pokeAt = null;
    this.calm = !!(window.SYVT_SCENERY && window.SYVT_SCENERY.reduced);
  }

  /* Back to the beginning of his time here: he flies in, nothing poked, the
     first wave and the first round planned afresh. Called every time the
     panel comes back, which is what the app gets for free by building the
     widget again. */
  Mascot.prototype.arrive = function () {
    this.here = true;
    this.t = 0;
    this.t0 = 0;
    this.pokeAt = null;
    this.plan();
  };

  Mascot.prototype.leave = function () { this.here = false; };

  Mascot.prototype.plan = function () {
    this.waveAt = this.t + 2 + Math.random() * 4;
    this.roundAt = this.t + 18 + Math.random() * 20;
  };

  /* Sized from the element, and only when that has actually changed: the
     canvas is measured every frame, so the work behind it is not. */
  Mascot.prototype.resize = function () {
    var c = this.canvas;
    if (!c) return;
    var w = c.clientWidth, h = c.clientHeight;
    if (!w || !h) { this.px = 0; return; }
    if (w === this.cssW && h === this.cssH && this.px) return;
    this.cssW = w;
    this.cssH = h;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.px = (w / ENV_W) * dpr;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    // design px, with the slot's top-left at the origin
    this.ctx.setTransform(this.px, 0, 0, this.px, -ENV_X * this.px, -ENV_Y * this.px);
  };

  /* What he is doing right now. One hand on its bucket and the other half
     up: he is doing something, not standing to attention. */
  Mascot.prototype.pose = function () {
    var t = this.t;
    if (this.calm) {
      return { leftArm: .8, rightArm: .8, swing: 0, mouth: 1, happy: true,
               asleep: false, zzz: 0, lights: 0, pulse: .6, lean: 0 };
    }
    var breathe = 0.06 * Math.sin(t * 1.3);
    var left = 0.12 + breathe * 0.5, right = 0.5 + breathe;
    var swing = 0, mouth = 0.75, lights = t, happy = true;
    var w = t - this.waveAt;
    if (w >= 0 && w < WAVE) {
      right = 0.95;
      swing = Math.sin(w * 11);
      mouth = 1;
    }
    var r = t - this.roundAt;
    if (r >= 0 && r < ROUND) {
      // arms up for the ride
      left = right = 1;
      mouth = 1;
    }
    var since = this.pokeAt === null ? null : t - this.pokeAt;
    if (since !== null && since < POKED) {
      left = right = 1;
      mouth = 1;
      happy = since > 0.45;
      lights = t * 3;
    }
    return { leftArm: left, rightArm: right, swing: swing, mouth: mouth,
             happy: happy, asleep: false, zzz: 0, lights: lights,
             pulse: 0.5 + 0.5 * Math.sin(t * 2.1), lean: 0 };
  };

  // where the saucer is, how it is tilted and how big: the hover, the
  // arrival, the quick round, the jump
  Mascot.prototype.place = function () {
    if (this.calm) return { dx: 0, dy: 0, lean: 0, scale: 1 };
    var t = this.t;
    var dx = 0, dy = 3 * Math.sin(t * 1.6), lean = 0, scale = 1;
    if (t < ARRIVE) {
      // in from the left, easing out, a little high and tilted
      var p = t / ARRIVE, e = 1 - Math.pow(1 - p, 3);
      dx = -(W + 60) * (1 - e);
      dy += -18 * (1 - e);
      lean = 0.18 * (1 - e);
    }
    var r = t - this.roundAt;
    if (r >= 0 && r < ROUND) {
      // a loop: out over the letters along the top, back under them, eased
      // so it leaves and lands gently
      var q = r / ROUND;
      var ease = q < 0.5 ? 2 * q * q : 1 - Math.pow(-2 * q + 2, 2) / 2;
      var th = 2 * Math.PI * ease;
      var rx = (ROUND_W - W) / 2;
      dx = rx * (1 - Math.cos(th));
      dy += -20 * Math.sin(th);
      lean = 0.28 * Math.sin(th);
      scale = 1 - 0.1 * Math.sin(th / 2);
    }
    var since = this.pokeAt === null ? null : t - this.pokeAt;
    if (since !== null && since < 0.6) {
      dy += -16 * Math.sin(since / 0.6 * Math.PI);
    }
    return { dx: dx, dy: dy, lean: lean, scale: scale };
  };

  Mascot.prototype.frame = function (nowMs) {
    if (!this.here || !this.ctx) return;
    this.resize();
    if (!this.px) return;
    var now = nowMs / 1000;
    if (!this.t0) this.t0 = now;
    if (!this.calm) {
      this.t = now - this.t0;
      if (this.t > this.waveAt + WAVE) this.waveAt = this.t + 4 + Math.random() * 6;
      if (this.t > this.roundAt + ROUND) this.roundAt = this.t + 30 + Math.random() * 20;
    }
    var ctx = this.ctx;
    ctx.clearRect(ENV_X, ENV_Y, ENV_W, ENV_H);
    var at = this.place();
    var k = H / BOX_H;
    ctx.save();
    ctx.translate(-SHIFT + at.dx + W / 2, (SLOT_H - H) / 2 + at.dy + H / 2);
    ctx.scale(k * at.scale, k * at.scale);
    ctx.translate(-BOX_W / 2, -BOX_H / 2);
    var pose = this.pose();
    pose.lean = at.lean;
    paintSyvt(ctx, pose);
    ctx.restore();
  };

  /* A tap on him. Under reduced motion he still answers in sound - the
     switch is about motion - but he does not jump.

     Tested against where he is at THIS instant, not against his canvas: the
     canvas is the whole flight envelope and reaches over the name and into
     the tagline, so it takes no pointer events at all and the panel hands
     this every tap it gets. A tap that misses him is not his. */
  Mascot.prototype.pokeAtPoint = function (x, y) {
    if (!this.here) return false;
    var at = this.place();
    var left = -SHIFT + at.dx, top = (SLOT_H - H) / 2 + at.dy;
    // a finger is bigger than his outline; the app gives a visitor the same
    // grace, and here it is the box plus a little
    var grow = 6;
    if (x < left - grow || x > left + W + grow) return false;
    if (y < top - grow || y > top + H + grow) return false;
    if (!this.calm) this.pokeAt = this.t;
    return true;
  };

  // the point of a pointer event in his canvas's design px
  Mascot.prototype.pointOf = function (e) {
    var r = this.canvas.getBoundingClientRect();
    if (!r.width) return null;
    var s = ENV_W / r.width;
    return [ENV_X + (e.clientX - r.left) * s, ENV_Y + (e.clientY - r.top) * s];
  };

  return {
    create: function (canvas) { return new Mascot(canvas); },
    // for anything that wants to draw him somewhere else one day
    paint: paintSyvt,
    box: { w: BOX_W, h: BOX_H }
  };
})();
