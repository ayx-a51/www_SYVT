/* The three worlds the free game plays in, drawn the way the Android game
   draws them, plus a thumbnail for all eight.

   The game has two sides, and each side's free worlds are here: Light for
   the grown-ups, Space and Day for the children, which is the app's own
   `Limits.freeThemes`. The other five - Dark, Night, Aquarium, Princess
   Castle and Dinosaurs - are SYVT+ on Android and appear in the picker as a
   thumbnail behind a padlock, so nothing below draws them moving.

   Everything is in the app's design space, 420 x 746.67. The canvases are
   sized in device pixels and given a transform, so every number below is a
   design px and matches the Flutter source one for one.

   Two canvases: the back one carries the scenery and the creatures that
   cross it and sits under the words; the front one carries the ground,
   which paints over the pile so the stack sinks into it. The ground never
   moves, so it is drawn once per resize; the back one is a frame loop. */
(function () {
  "use strict";

  var W = 420, H = 746.6667, FLOOR = 46, CEIL = 56;
  // The smallest box a tap is tested against, design px. A distant butterfly
  // is 34 px across and a thumb is not.
  var TOUCH = 46;

  var FLOOR_TOP = H - FLOOR;              // 700.667

  var reduced = window.matchMedia
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;

  // ---------------------------------------------------------------- maths

  function wave(t, cycles, phase) {
    return Math.sin(2 * Math.PI * (t * cycles + phase));
  }
  // stable pseudo-random in 0..1, the same one the app uses
  function noise(i, salt) {
    var v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
    return v - Math.floor(v);
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  // rgb/rgba string -> [r,g,b,a]
  function parse(c) {
    if (c.charAt(0) === "#") {
      var h = c.slice(1);
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16),
              parseInt(h.slice(4, 6), 16), 1];
    }
    var p = c.replace(/rgba?\(|\)/g, "").split(",").map(Number);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  function rgba(p, a) {
    return "rgba(" + Math.round(p[0]) + "," + Math.round(p[1]) + "," +
           Math.round(p[2]) + "," + (a === undefined ? p[3] : a) + ")";
  }
  function mix(c, other, t) {
    var a = parse(c), b = parse(other);
    return rgba([lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t), a[3]]);
  }

  /* Every filled part of a creature takes a vertical three-stop ramp of its
     own colour over its own bounding box. That is what makes them sit in the
     scene instead of on it. */
  function ramp(ctx, colour, top, bottom, lit, shade) {
    if (bottom - top < 5) return colour;
    var g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, mix(colour, "#ffffff", lit));
    g.addColorStop(0.52, colour);
    g.addColorStop(1, mix(colour, shade, 0.22));
    return g;
  }

  // ------------------------------------------------------------ primitives

  function ellipse(ctx, cx, cy, rx, ry, fill) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function circle(ctx, cx, cy, r, fill) { ellipse(ctx, cx, cy, r, r, fill); }
  function ring(ctx, cx, cy, r, w, stroke) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = w;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
  function poly(ctx, pts, fill) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function line(ctx, x1, y1, x2, y2, w, stroke, cap) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = w;
    ctx.strokeStyle = stroke;
    ctx.lineCap = cap || "round";
    ctx.stroke();
  }
  function grad(ctx, x0, y0, x1, y1, stops) {
    var g = ctx.createLinearGradient(x0, y0, x1, y1);
    for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
    return g;
  }
  /* A blur, where the browser has one. `ctx.filter` works in device space,
     so a radius in design px is multiplied by the canvas's own scale. A
     browser without it draws the shape crisp instead, which at these radii
     is a smaller difference than any way of faking it would cost. */
  function blurred(c, radius, scale, draw) {
    var has = "filter" in c;
    if (has) c.filter = "blur(" + (radius * (scale || 1)) + "px)";
    draw();
    if (has) c.filter = "none";
  }

  function offscreen(w, h) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // ================================================================= LIGHT
  /* The grown-ups' daylight world - what this page used to call Day, and
     what the app now calls Light: the same warm paper, the same mint-right /
     coral-wrong grammar, moved on to the grown-ups' side of the game when
     the children got a meadow of their own. Its static scenery is CSS
     (aurora, dots, ceiling line, vignette); only the ground and the visitors
     are drawn here. */

  var light = {
    id: "light",

    ground: function (ctx) {
      // the mint glow that lifts the plinth off the field
      ctx.fillStyle = grad(ctx, 0, FLOOR_TOP - 18, 0, FLOOR_TOP,
        [[0, "rgba(45,212,191,0)"], [1, "rgba(45,212,191,.08)"]]);
      ctx.fillRect(0, FLOOR_TOP - 18, W, 18);
      // the plinth
      ctx.fillStyle = grad(ctx, 0, FLOOR_TOP, 0, H,
        [[0, "rgba(243,247,247,.96)"], [1, "rgba(228,235,236,.98)"]]);
      ctx.fillRect(0, FLOOR_TOP, W, FLOOR);
      // the grammar line: coral at the left edge, mint at the right. It says
      // which way to swipe before anyone reads a label.
      ctx.fillStyle = grad(ctx, 0, 0, W, 0, [
        [0, "rgba(251,113,133,.75)"],
        [0.42, "rgba(16,40,44,.14)"],
        [0.58, "rgba(16,40,44,.14)"],
        [1, "rgba(45,212,191,.75)"]
      ]);
      ctx.fillRect(0, FLOOR_TOP, W, 1);
    },

    backdrop: function () { /* CSS draws it */ },

    puff: "ring",
    puffColour: "rgba(28,143,135,.6)",

    visitors: [
      {
        name: "birds", voice: "chirp", w: 76, h: 36, band: [0.04, 0.30], secs: 9, bob: 6,
        weight: 1.2, shadow: 0,
        draw: function (ctx, phase) {
          var ranks = [[68, 18, 1], [53, 11, .92], [53, 25, .92],
                       [38, 4.5, .84], [38, 31.5, .84]];
          ctx.strokeStyle = "rgba(16,40,44,.36)";
          ctx.lineWidth = 1.4;
          ctx.lineCap = "round";
          for (var i = 0; i < ranks.length; i++) {
            var x = ranks[i][0], y = ranks[i][1], s = ranks[i][2];
            var beat = Math.sin(phase * Math.PI * 2 * 2.4 - i * 0.9);
            var span = 7.5 * s, lift = 4 * s * beat;
            ctx.beginPath();
            ctx.moveTo(x - span, y - lift);
            ctx.quadraticCurveTo(x - span * .5, y - lift * .3, x, y + 1);
            ctx.quadraticCurveTo(x + span * .5, y - lift * .3, x + span, y - lift);
            ctx.stroke();
          }
        }
      },
      {
        name: "cloud", voice: null, w: 66, h: 30, band: [0.05, 0.25], secs: 30, bob: 1.5,
        weight: 0.4, shadow: 0.13,
        draw: function (ctx) {
          var f = ramp(ctx, "rgba(255,255,255,.88)", 1.5, 28, .35, "#10282c");
          ctx.fillStyle = f;
          ctx.beginPath();
          rrect(ctx, 6, 17, 54, 11, 5.5);
          ctx.fill();
          circle(ctx, 17, 19, 8, f);
          circle(ctx, 30, 14, 11, f);
          circle(ctx, 44, 13, 11.5, f);
          circle(ctx, 54, 19, 7.5, f);
        }
      },
      {
        name: "plane", voice: "click", w: 46, h: 26, band: [0.10, 0.45], secs: 7, bob: 10,
        weight: 1.0, shadow: 0.13,
        draw: function (ctx, phase) {
          ctx.save();
          ctx.translate(23, 13);
          ctx.rotate(Math.sin(phase * 1.3) * 0.14);
          ctx.translate(-23, -13);
          poly(ctx, [[44, 13], [3, 3], [14, 13]],
            ramp(ctx, "rgba(255,255,255,.92)", 3, 13, .35, "#10282c"));
          poly(ctx, [[44, 13], [14, 13], [3, 23]],
            ramp(ctx, "rgba(16,40,44,.16)", 13, 23, .35, "#10282c"));
          ctx.restore();
        }
      },
      {
        name: "balloon", voice: "hum", w: 44, h: 68, band: [0.05, 0.30], secs: 24, bob: 4,
        weight: 0.6, shadow: 0.13,
        draw: function (ctx) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(22, 2);
          ctx.bezierCurveTo(34, 2, 41, 11, 41, 20);
          ctx.bezierCurveTo(41, 30, 32, 36, 26, 43);
          ctx.lineTo(18, 43);
          ctx.bezierCurveTo(12, 36, 3, 30, 3, 20);
          ctx.bezierCurveTo(3, 11, 10, 2, 22, 2);
          ctx.closePath();
          ctx.clip();
          ctx.fillStyle = ramp(ctx, "rgba(255,255,255,.62)", 2, 43, .35, "#10282c");
          ctx.fillRect(0, 0, 44, 44);
          var gw = 38 / 7;
          for (var i = 0; i < 7; i += 2) {
            ctx.fillStyle = (i === 0 || i === 4)
              ? "rgba(251,113,133,.24)" : "rgba(45,212,191,.24)";
            ctx.fillRect(3 + gw * i, 0, gw, 44);
          }
          for (var j = 1; j <= 6; j++) {
            line(ctx, 3 + gw * j, 0, 3 + gw * j, 44, 0.8, "rgba(16,40,44,.1)", "butt");
          }
          ctx.restore();
          ctx.fillStyle = "rgba(16,40,44,.2)";
          ctx.fillRect(18, 43, 8, 3);
          line(ctx, 18.5, 46, 17, 56, 0.8, "rgba(16,40,44,.3)");
          line(ctx, 25.5, 46, 27, 56, 0.8, "rgba(16,40,44,.3)");
          ctx.fillStyle = ramp(ctx, "rgba(16,40,44,.22)", 56, 64, .35, "#10282c");
          ctx.beginPath();
          rrect(ctx, 16, 56, 12, 8, 1.5);
          ctx.fill();
          line(ctx, 16, 60, 28, 60, 0.8, "rgba(16,40,44,.1)", "butt");
        }
      },
      {
        name: "butterfly", voice: "tick", w: 34, h: 34, band: [0.20, 0.60], secs: 10, bob: 16,
        weight: 0.8, shadow: 0.13,
        draw: function (ctx, phase) {
          // four ellipses rather than two rebuilt path unions: at this size
          // the beat is the whole read, not the outline
          var beat = Math.cos(phase * Math.PI * 2 * 5);
          var spread = .65 + .35 * beat;
          ctx.save();
          ctx.translate(0, -1.5 * beat);
          for (var s = -1; s <= 1; s += 2) {
            var col = s < 0 ? "rgba(251,113,133,.42)" : "rgba(62,42,122,.30)";
            ctx.save();
            ctx.translate(17, 17);
            ctx.scale(1, spread);
            ellipse(ctx, 6, s * 5.5, 6, 3.4, col);
            ellipse(ctx, -5, s * 4.5, 5, 2.8, col);
            ctx.restore();
          }
          line(ctx, 11, 17, 21, 17, 2.2, "rgba(16,40,44,.34)");
          circle(ctx, 22.5, 17, 2, "rgba(16,40,44,.38)");
          for (var k = -1; k <= 1; k += 2) {
            ctx.beginPath();
            ctx.moveTo(23, 17 + k);
            ctx.quadraticCurveTo(27, 17 + 3 * k, 28, 17 + 6 * k);
            ctx.lineWidth = 0.8;
            ctx.strokeStyle = "rgba(16,40,44,.3)";
            ctx.stroke();
          }
          ctx.restore();
        }
      }
    ]
  };

  // ============================================================== AQUARIUM
  /* Aquarium is SYVT+ on Android, so the page shows its thumbnail and
     nothing else. Its water is kept here because the thumbnail is painted
     from it; the world itself lived here until the app made Space and Day
     the children's free pair, and it is in this file's history. */

  var WATER = [[0, "#9fe9f5"], [0.38, "#4fc4e3"], [0.78, "#2593c4"], [1, "#1b6fa3"]];

  /* ------------------------------------------------------- the creature kit

     The app draws no visitor with an outline. Every part is filled with a
     soft ramp of its own colour - lifted towards the light along its crown,
     let down towards the ink along its underside - and that ramp is what
     tells one part from the next and keeps the creature in the scene rather
     than on it. `modelled` and `modelledStroke` in the app's
     lib/ui/themes/visitors.dart are those two ramps; these are them.

     A Dart path knows its own bounds, so the app asks it for them. A canvas
     path does not, so every call here is handed the top and bottom of the
     part it is filling - which are constants in the source either way, so
     nothing is lost and no bounding box is computed per frame. */

  function modelled(ctx, colour, top, bottom, lit, shade, topK, bottomK) {
    if (bottom - top < 5) return colour;
    var g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, mix(colour, lit, topK === undefined ? 0.2 : topK));
    g.addColorStop(0.52, colour);
    g.addColorStop(1, mix(colour, shade, bottomK === undefined ? 0.26 : bottomK));
    return g;
  }

  /* One creature's drawing kit: the canvas, the two colours its world lends
     every part, and the ink its interior lines are drawn in. A painter makes
     one of these per call and draws everything through it. */
  function Kit(ctx, lit, shade, ink, pencil) {
    this.c = ctx;
    this.lit = lit;
    this.shade = shade;
    // `ink` is the world's true dark, which a pupil is drawn in; `pencil` is
    // that ink let down, which every interior line takes by default. They are
    // the same colour in the worlds that draw no interior line in anything
    // softer than their darkest.
    this.ink = ink;
    this.pencil = pencil || ink;
  }
  Kit.prototype.body = function (colour, top, bottom) {
    return modelled(this.c, colour, top, bottom, this.lit, this.shade);
  };
  // the ramp for a round-capped stroke of `width` running over top..bottom
  Kit.prototype.along = function (colour, top, bottom, width) {
    return modelled(this.c, colour, top - width / 2, bottom + width / 2,
                    this.lit, this.shade, 0.16, 0.22);
  };
  Kit.prototype.shape = function (path, colour, top, bottom) {
    var c = this.c;
    c.beginPath();
    path(c);
    c.closePath();
    c.fillStyle = this.body(colour, top, bottom);
    c.fill();
  };
  // the same, left open so the caller can clip to it afterwards
  Kit.prototype.trace = function (path) {
    var c = this.c;
    c.beginPath();
    path(c);
    c.closePath();
  };
  Kit.prototype.disc = function (cx, cy, r, colour) {
    ellipse(this.c, cx, cy, r, r, this.body(colour, cy - r, cy + r));
  };
  Kit.prototype.oval = function (l, t, r, b, colour) {
    ellipse(this.c, (l + r) / 2, (t + b) / 2, (r - l) / 2, (b - t) / 2,
            this.body(colour, t, b));
  };
  Kit.prototype.round = function (l, t, r, b, rad, colour) {
    var c = this.c;
    c.beginPath();
    rrect(c, l, t, r - l, b - t, rad);
    c.fillStyle = this.body(colour, t, b);
    c.fill();
  };
  // flat, with no modelling: a pupil, a light, a star
  Kit.prototype.dot = function (cx, cy, r, colour) {
    circle(this.c, cx, cy, r, colour);
  };
  Kit.prototype.blot = function (l, t, r, b, colour) {
    ellipse(this.c, (l + r) / 2, (t + b) / 2, (r - l) / 2, (b - t) / 2, colour);
  };
  Kit.prototype.wash = function (path, colour) {
    var c = this.c;
    c.beginPath();
    path(c);
    c.closePath();
    c.fillStyle = colour;
    c.fill();
  };
  Kit.prototype.seg = function (x1, y1, x2, y2, w, colour) {
    line(this.c, x1, y1, x2, y2, w, colour);
  };
  Kit.prototype.stroke = function (path, w, colour) {
    var c = this.c;
    c.beginPath();
    path(c);
    c.lineWidth = w;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = colour;
    c.stroke();
  };
  // a thick limb or rod, modelled along its length the way a body is
  Kit.prototype.limb = function (path, w, colour, top, bottom) {
    this.stroke(path, w, this.along(colour, top, bottom, w));
  };
  // a round eye looking a little the way it is going
  Kit.prototype.eye = function (cx, cy, r) {
    this.disc(cx, cy, r, "#ffffff");
    this.dot(cx + r * 0.3, cy + r * 0.1, r * 0.55, this.ink);
    this.dot(cx + r * 0.05, cy - r * 0.3, r * 0.2, "#ffffff");
  };
  Kit.prototype.smile = function (cx, cy, r, w, colour) {
    var c = this.c;
    c.beginPath();
    c.arc(cx, cy, r, 20 * Math.PI / 180, 160 * Math.PI / 180);
    c.lineWidth = w;
    c.lineCap = "round";
    c.strokeStyle = colour || this.pencil;
    c.stroke();
  };

  // `phase` seconds as an angle turning `per` times a second
  function turns(phase, per) { return phase * per * 2 * Math.PI; }
  function frac(v) { return v - Math.floor(v); }
  function smoothstep(a, b, v) {
    var x = clamp((v - a) / (b - a), 0, 1);
    return x * x * (3 - 2 * x);
  }
  // a sine with `period` seconds, shifted by `phase` turns
  function osc(t, period, phase) {
    return Math.sin(2 * Math.PI * (t / period + phase));
  }
  /* A walking leg from the hip with its sole on the ground: the foot swings
     `stride` px either way with the gait angle `a` and lifts up to `lift` px
     while it swings forward. */
  function walkLeg(k, hipX, hipY, ground, a, thick, stride, lift, colour, paw) {
    var up = lift * Math.max(0, Math.cos(a));
    var fx = hipX + stride * Math.sin(a), fy = ground - up - thick * 0.4;
    k.limb(function (c) { c.moveTo(hipX, hipY); c.lineTo(fx, fy); },
           thick, colour, Math.min(hipY, fy), Math.max(hipY, fy));
    if (paw) k.dot(fx, fy, thick * 0.45, paw);
  }

  // =================================================================== DAY
  /* The children's day: a sunny meadow, ported from the app's
     lib/ui/themes/day_theme.dart and visitors/day_visitors.dart. Words fall
     as cream picnic cards on to bright grass; clouds drift, a kite tugs at
     its string, a balloon climbs far off, bees and butterflies flit at the
     edges, and now and then a bluebird, a puppy or a rabbit crosses behind
     the words.

     One 120-second clock drives everything that lives, and every mote is a
     pure function of (index, t) - nothing here keeps state. The sky, the
     sun, the hills, the tree and the sunflower stems stand still, so they
     are baked once per resize and drawn as one image a frame. */

  var D_INK = "#1B3A2E";
  var D_PENCIL = "rgba(27,58,46,.55)";   // the ink let down for interior lines
  var D_WHITE = "#FFFFFF";
  var D_CREAM = "#FFF7E6";
  var D_SUN = "#FFE27A", D_SUN_CORE = "#FFF8D6", D_SUN_GLOW = "#FFD166";
  var D_YELLOW = "#FFC93C", D_ORANGE = "#FF9F43", D_ORANGE_DEEP = "#F07A2E";
  var D_CORAL = "#FB7185", D_CORAL_DEEP = "#C94D65", D_RED = "#FF4D5E";
  var D_LEAF = "#4CC46A", D_LEAF_DEEP = "#2E9E58", D_LEAF_INK = "#1F7F45";
  var D_BARK = "#9A6A40", D_BARK_DEEP = "#6E4A2A";
  var D_FAR_HILL = "#A9DDB0", D_MID_HILL = "#7CC97A", D_NEAR_HILL = "#5FB85A";
  var D_BUSH = "#3F9E4A";
  var D_GRASS_TOP = "#8ADB74", D_GRASS_LOW = "#63C25F", D_GRASS_LIP = "#D2F5A6";
  var D_EARTH_TOP = "#B07A48", D_EARTH_LOW = "#8C5A34";
  var D_LILAC = "#B7A6F5", D_SKY = "#4C9BF0", D_SKY_DEEP = "#2F7ED0";
  var D_CLOUD = "#FFFFFF", D_CLOUD_SHADE = "#D8ECFA";
  var D_FUR = "#F1EBF8", D_FUR_SHADE = "#D8CFE8", D_PINK = "#FFB3C8";
  var D_CHEEK = "rgba(251,113,133,.7)", D_GLASS = "rgba(255,255,255,.55)";
  var D_SHELL = "#E8303F";

  var D_SKY_STOPS = [[0, "#5FB8F5"], [0.45, "#8ED3FF"], [0.78, "#CFEFFF"], [1, "#EAF7FF"]];
  var D_SUN_AT = [330, 122];

  // the colour a part on the creature's far side is drawn in
  function dShade(c) { return mix(c, D_INK, 0.28); }

  /* A run of soft hills: from `start` through each crest in `tops` to `end`,
     as quadratics with the dips falling between the crests. */
  function hills(c, start, tops, end) {
    c.moveTo(start[0], start[1]);
    var last = start;
    for (var i = 0; i < tops.length; i++) {
      var top = tops[i];
      var dipX = (last[0] + top[0]) / 2, dipY = Math.max(last[1], top[1]) + 14;
      c.quadraticCurveTo(dipX, (last[1] + dipY) / 2, top[0], top[1]);
      last = top;
    }
    c.quadraticCurveTo((last[0] + end[0]) / 2, end[1] + 10, end[0], end[1]);
  }

  // a puffy cloud: a flat-bottomed row of discs round (cx, cy), `w` wide
  function cloudShape(c, cx, cy, w, fill) {
    var h = w * 0.38;
    ellipse(c, cx, cy + h * 0.1, w / 2, h / 2, fill);
    circle(c, cx - w * 0.22, cy - h * 0.1, h * 0.45, fill);
    circle(c, cx + w * 0.02, cy - h * 0.32, h * 0.6, fill);
    circle(c, cx + w * 0.26, cy - h * 0.06, h * 0.42, fill);
  }

  // a sunflower head: twelve petals round a brown centre
  function sunflower(c, cx, cy, r, nod) {
    c.save();
    c.translate(cx, cy);
    c.rotate(nod || 0);
    for (var i = 0; i < 12; i++) {
      c.save();
      c.rotate(i * Math.PI / 6);
      ellipse(c, r * 0.72, 0, r * 0.45, r * 0.21, D_YELLOW);
      c.restore();
    }
    circle(c, 0, 0, r * 0.42, D_BARK_DEEP);
    circle(c, -r * 0.1, -r * 0.1, r * 0.3, "rgba(154,106,64,.7)");
    c.restore();
  }

  // a six-petal daisy with a yellow eye
  function daisy(c, x, y) {
    for (var i = 0; i < 6; i++) {
      var a = i * Math.PI / 3;
      circle(c, x + 3 * Math.cos(a), y + 3 * Math.sin(a), 1.6, D_WHITE);
    }
    circle(c, x, y, 1.4, D_YELLOW);
  }

  var day = {
    id: "day",
    baked: null,

    /* Everything that stands still, baked once: the sky, the sun's glow and
       disc, three ranges of hills, the apple tree at the left, the sunflower
       stems at the right, and a bush or two. */
    bake: function (px) {
      var cv = offscreen(W * px, H * px), c = cv.getContext("2d");
      c.scale(px, px);
      c.fillStyle = grad(c, 0, 0, 0, H, D_SKY_STOPS);
      c.fillRect(0, 0, W, H);
      // the high-sky band the HUD sits in
      c.fillStyle = "rgba(255,255,255,.16)";
      c.fillRect(0, 0, W, CEIL);
      // the sun: a wide warm glow, then the disc with a lit rim
      var sx = D_SUN_AT[0], sy = D_SUN_AT[1];
      var glow = c.createRadialGradient(sx, sy, 0, sx, sy, 160);
      glow.addColorStop(0, "rgba(255,209,102,.35)");
      glow.addColorStop(1, "rgba(255,209,102,0)");
      circle(c, sx, sy, 160, glow);
      var disc = c.createRadialGradient(sx - 10, sy - 10, 0, sx - 10, sy - 10, 52);
      disc.addColorStop(0, D_SUN_CORE);
      disc.addColorStop(0.6, D_SUN);
      disc.addColorStop(1, "rgba(255,209,102,.95)");
      circle(c, sx, sy, 42, disc);
      // three ranges, the centre of each kept low so the pile zone sits over
      // the calmest ground
      blurred(c, 3, px, function () {
        c.beginPath();
        hills(c, [-10, 548], [[70, 500], [210, 528], [350, 486]], [430, 540]);
        c.lineTo(430, 700); c.lineTo(-10, 700); c.closePath();
        c.fillStyle = "rgba(169,221,176,.85)";
        c.fill();
      });
      blurred(c, 1.5, px, function () {
        c.beginPath();
        hills(c, [-10, 602], [[90, 572], [240, 598], [360, 562]], [430, 594]);
        c.lineTo(430, 700); c.lineTo(-10, 700); c.closePath();
        c.fillStyle = D_MID_HILL;
        c.fill();
      });
      c.beginPath();
      hills(c, [-10, 646], [[80, 620], [220, 644], [350, 616]], [430, 640]);
      c.lineTo(430, FLOOR_TOP + 10); c.lineTo(-10, FLOOR_TOP + 10); c.closePath();
      c.fillStyle = D_NEAR_HILL;
      c.fill();
      circle(c, 160, 690, 18, "rgba(63,158,74,.85)");
      circle(c, 272, 694, 14, "rgba(63,158,74,.85)");
      // the apple tree: a trunk with two boughs, a canopy of four lobes with
      // apples in it. Its leaves stir in the layer above this one.
      line(c, 58, 700, 60, 590, 14, D_BARK);
      line(c, 60, 610, 34, 566, 7, D_BARK);
      line(c, 60, 604, 92, 562, 7, D_BARK);
      var deep = [[30, 562, 34], [64, 534, 42], [100, 562, 34], [64, 578, 36]];
      for (var i = 0; i < deep.length; i++) {
        circle(c, deep[i][0], deep[i][1], deep[i][2], D_LEAF_DEEP);
      }
      var lobes = [[30, 556, 32], [64, 528, 40], [100, 556, 32], [64, 570, 34]];
      for (i = 0; i < lobes.length; i++) {
        circle(c, lobes[i][0], lobes[i][1], lobes[i][2], D_LEAF);
      }
      var apples = [[22, 560], [52, 540], [84, 534], [110, 562], [44, 586], [90, 588]];
      for (i = 0; i < apples.length; i++) {
        circle(c, apples[i][0], apples[i][1], 4.5, D_RED);
        circle(c, apples[i][0] - 1.5, apples[i][1] - 1.5, 1.4, "rgba(255,255,255,.6)");
      }
      // the sunflowers' stems; their heads nod in the layer above
      var stems = [[378, 596], [400, 574], [416, 612]];
      for (i = 0; i < stems.length; i++) {
        line(c, stems[i][0], 702, stems[i][0], stems[i][1], 4, D_LEAF_DEEP);
        c.save();
        c.translate(stems[i][0], stems[i][1] + 40);
        c.rotate(-0.7);
        ellipse(c, 11, 0, 11, 5, D_LEAF);
        c.restore();
      }
      var daisies = [[140, 686], [300, 690], [326, 682]];
      for (i = 0; i < daisies.length; i++) daisy(c, daisies[i][0], daisies[i][1]);
      return cv;
    },

    /* Everything that lives, about seventy primitives a frame. Nothing moves
       down; inside the fall lane (x 120-300) only the clouds pass, high up,
       and four half-strength motes flit. */
    backdrop: function (c, t60, px, clock) {
      if (!this.baked) this.baked = this.bake(px);
      c.drawImage(this.baked, 0, 0, W, H);
      var t = reduced ? 30 : (clock || 0) % 120;
      this.rays(c, t);
      this.clouds(c, t);
      this.balloon(c, t);
      this.kite(c, t);
      this.leaves(c, t);
      this.heads(c, t);
      if (!reduced) { this.motes(c, t); this.seeds(c, t); }
      this.grass(c, t);
    },

    sway: function (t, period, phase) { return reduced ? 0 : osc(t, period, phase); },

    // twelve soft rays turning slowly round the sun
    rays: function (c, t) {
      var sx = D_SUN_AT[0], sy = D_SUN_AT[1];
      var turn = reduced ? 0 : t / 60 * 2 * Math.PI / 12;
      for (var i = 0; i < 12; i++) {
        var a = turn + i * Math.PI / 6;
        var dx = Math.cos(a), dy = Math.sin(a);
        poly(c, [[sx + dx * 50 - dy * 7, sy + dy * 50 + dx * 7],
                 [sx + dx * 50 + dy * 7, sy + dy * 50 - dx * 7],
                 [sx + dx * 118, sy + dy * 118]], "rgba(255,209,102,.16)");
      }
    },

    // three puffy clouds drifting right to left, each on its own pace
    clouds: function (c, t) {
      var Y = [176, 262, 336], WD = [110, 84, 130], OFF = [40, 260, 150];
      var wrap = W + 160;
      for (var i = 0; i < 3; i++) {
        var speed = 1 / (70 + 30 * i);
        var x = reduced ? OFF[i]
              : wrap - ((t * speed * wrap + OFF[i]) % wrap) - 80;
        cloudShape(c, x, Y[i] + 4, WD[i], "rgba(216,236,250,.8)");
        cloudShape(c, x, Y[i], WD[i], "rgba(255,255,255,.92)");
      }
    },

    // a hot-air balloon far off at the right, climbing very slowly
    balloon: function (c, t) {
      var rise = reduced ? 0.4 : frac(t / 120);
      var cx = 388 + 8 * this.sway(t, 20, 0), cy = 470 - 250 * rise, r = 16;
      c.save();
      c.translate(cx, cy);
      c.beginPath();
      c.moveTo(0, r * 1.7);
      c.bezierCurveTo(-r * 1.3, r * 0.9, -r * 1.2, -r * 1.2, 0, -r * 1.2);
      c.bezierCurveTo(r * 1.2, -r * 1.2, r * 1.3, r * 0.9, 0, r * 1.7);
      c.closePath();
      c.fillStyle = D_CORAL;
      c.fill();
      c.save();
      c.clip();
      c.fillStyle = D_YELLOW;
      c.fillRect(-9, -r * 1.3, 5, r * 3.2);
      c.fillRect(3, -r * 1.3, 5, r * 3.2);
      c.restore();
      var lines = [-5, 0, 5];
      for (var i = 0; i < 3; i++) {
        line(c, lines[i], r * 1.5, lines[i] * 0.6, r * 2.5, 1, "rgba(110,74,42,.8)");
      }
      c.beginPath();
      rrect(c, -4.5, r * 2.7 - 3, 9, 6, 1.5);
      c.fillStyle = D_BARK;
      c.fill();
      c.restore();
    },

    /* The kite high at the right, a coral diamond on a string that leaves
       the frame, with a bow-tail streaming behind. */
    kite: function (c, t) {
      var tug = this.sway(t, 3.4, 0);
      var cx = 352 + 10 * tug, cy = 250 + 6 * this.sway(t, 5.1, 0.3);
      var lean = 0.35 + 0.12 * tug;
      c.save();
      c.translate(cx, cy);
      c.rotate(lean);
      poly(c, [[0, -26], [18, 0], [0, 30], [-18, 0]], D_CORAL);
      poly(c, [[0, -26], [18, 0], [0, 0]], D_SKY);
      poly(c, [[0, 0], [-18, 0], [0, 30]], D_YELLOW);
      line(c, 0, -26, 0, 30, 1.2, "rgba(110,74,42,.6)");
      line(c, -18, 0, 18, 0, 1.2, "rgba(110,74,42,.6)");
      c.beginPath();
      c.moveTo(0, 30);
      c.quadraticCurveTo(-10 + 6 * tug, 46, -4 - 6 * tug, 62);
      c.quadraticCurveTo(2 + 6 * tug, 74, -8, 88);
      c.lineWidth = 1.5;
      c.lineCap = "round";
      c.strokeStyle = "rgba(110,74,42,.5)";
      c.stroke();
      var bows = [[44, 0.3], [62, 0.6], [78, 0.85]];
      for (var i = 0; i < bows.length; i++) {
        var bx = -6 + 5 * Math.sin(bows[i][1] * 6 + tug * 2);
        ellipse(c, bx, bows[i][0], 4, 2, D_YELLOW);
      }
      c.restore();
      // the string, down and out of the frame at the right
      line(c, cx - 2 * Math.cos(lean), cy + 24 * Math.cos(lean), 430, 520,
           1, "rgba(110,74,42,.45)", "butt");
    },

    // a few leaves on the canopy, stirring in the breeze
    leaves: function (c, t) {
      for (var i = 0; i < 9; i++) {
        var a = i * 2 * Math.PI / 9;
        var r = 30 + 12 * noise(i, 51);
        var cx = 64 + r * Math.cos(a) * 1.3, cy = 548 + r * Math.sin(a) * 0.9;
        c.save();
        c.translate(cx, cy);
        c.rotate(a + 0.35 * this.sway(t, 2.6 + noise(i, 52), i * 0.1));
        ellipse(c, 0, 0, 6, 2.5, "rgba(31,127,69,.55)");
        c.restore();
      }
    },

    // the three sunflower heads, nodding on their stems
    heads: function (c, t) {
      var at = [[0, 378, 596], [1, 400, 574], [2, 416, 612]];
      for (var i = 0; i < at.length; i++) {
        var nod = 0.12 * this.sway(t, 3.2 + 0.4 * at[i][0], at[i][0] * 0.3);
        sunflower(c, at[i][1] + 6 * nod, at[i][2] - 2,
                  12 + (at[i][0] === 1 ? 2 : 0), nod);
      }
    },

    /* Fourteen motes: bees (gold with an ink stripe) and butterflies, ten at
       the edges and four at half strength in the lane. */
    motes: function (c, t) {
      for (var i = 0; i < 14; i++) {
        var lane = i % 7 >= 5;
        var x0 = lane ? 130 + 160 * noise(i, 61)
               : (i % 2 === 0 ? 10 + 100 * noise(i, 61) : 310 + 100 * noise(i, 61));
        var f = frac(t / 70 + noise(i, 62));
        var x = x0 + 18 * osc(t, 5 + 3 * noise(i, 63), noise(i, 64));
        var y = 660 - 380 * f + 8 * osc(t, 1.3 + noise(i, 65), noise(i, 66));
        var fade = smoothstep(0, 0.1, f) * (1 - smoothstep(0.9, 1, f));
        var a = 0.75 * fade * (lane ? 0.5 : 1);
        if (a <= 0.01) continue;
        if (i % 3 === 0) {
          ellipse(c, x, y, 3, 2, rgba(parse(D_YELLOW), a));
          line(c, x - 0.5, y - 2, x - 0.5, y + 2, 1, rgba(parse(D_INK), a * 0.6));
          ellipse(c, x, y - 3, 2, 1.25, rgba(parse(D_WHITE), a * 0.6));
        } else {
          var wing = [D_CORAL, D_LILAC, D_WHITE, D_ORANGE][i % 4];
          var flap = 1 + 0.5 * osc(t, 0.5, noise(i, 67));
          var col = rgba(parse(wing), a);
          ellipse(c, x - 2.2 * flap, y, 2.2, 1.8, col);
          ellipse(c, x + 2.2 * flap, y, 2.2, 1.8, col);
        }
      }
    },

    // dandelion seeds floating up on the breeze, a dozen at the edges
    seeds: function (c, t) {
      for (var i = 0; i < 12; i++) {
        var x0 = i % 2 === 0 ? 14 + 90 * noise(i, 71) : 316 + 90 * noise(i, 71);
        var f = frac(t / 50 + noise(i, 72));
        var x = x0 + 22 * osc(t, 8 + 4 * noise(i, 73), noise(i, 74));
        var y = 700 - 560 * f;
        var fade = smoothstep(0, 0.08, f) * (1 - smoothstep(0.85, 1, f));
        var col = "rgba(255,255,255," + (0.55 * fade) + ")";
        if (fade <= 0.02) continue;
        for (var k = 0; k < 6; k++) {
          var a = k * Math.PI / 3 + t * 0.4;
          line(c, x, y, x + Math.cos(a) * 3.5, y + Math.sin(a) * 3.5, 1, col);
        }
        line(c, x, y, x, y + 5, 1, col);
      }
    },

    /* Tufts of tall grass at the foot of the scene; the two pairs inside the
       lane sit low and dim so they never read as tiles. */
    grass: function (c, t) {
      var XS = [10, 30, 148, 172, 292, 316, 356, 404];
      for (var i = 0; i < XS.length; i++) {
        var x = XS[i], lane = x > 120 && x < 300;
        var h = lane ? 14 : 22 + 10 * noise(i, 81);
        var sway = 5 * this.sway(t, 3.5 + 2 * noise(i, 82), i * 0.13);
        var col = lane ? "rgba(31,127,69,.35)" : "rgba(31,127,69,.6)";
        var blades = [[-5, 0.7], [0, 1], [5, 0.8]];
        for (var b = 0; b < 3; b++) {
          var dx = blades[b][0], k = blades[b][1];
          c.beginPath();
          c.moveTo(x + dx, FLOOR_TOP + 2);
          c.quadraticCurveTo(x + dx + sway * 0.4, FLOOR_TOP - h * k * 0.6,
                             x + dx + sway + dx * 0.6, FLOOR_TOP - h * k);
          c.lineWidth = 2;
          c.lineCap = "round";
          c.strokeStyle = col;
          c.stroke();
        }
      }
    },

    /* The meadow's edge: a band of bright grass with a scalloped crest and a
       pale lip, so a card sits ON the grass; earth below it, and along the
       bottom a picnic basket, an apple, a snail, daisies and pebbles. */
    ground: function (c) {
      var CREST = 6, top = H - FLOOR - CREST, earthTop = top + 38;
      function scallop(x) { return top + CREST - 3 * Math.abs(Math.sin(Math.PI * x / 26)); }
      function crestPath() {
        c.beginPath();
        c.moveTo(-3, scallop(-3));
        for (var x = 0; x <= W + 3; x += 3) c.lineTo(x, scallop(x));
      }
      c.save();
      c.beginPath();
      c.rect(0, top, W, FLOOR + CREST);
      c.clip();
      crestPath();
      c.lineTo(W + 3, earthTop);
      c.lineTo(-3, earthTop);
      c.closePath();
      c.fillStyle = grad(c, 0, top + CREST - 3, 0, earthTop,
        [[0, D_GRASS_TOP], [1, D_GRASS_LOW]]);
      c.fill();
      c.fillStyle = grad(c, 0, earthTop, 0, H, [[0, D_EARTH_TOP], [1, D_EARTH_LOW]]);
      c.fillRect(0, earthTop, W, H - earthTop);
      c.fillStyle = "rgba(31,127,69,.6)";
      c.fillRect(0, earthTop - 1, W, 2);
      crestPath();
      c.lineWidth = 2;
      c.strokeStyle = D_GRASS_LIP;
      c.stroke();
      var lean = 25 * Math.PI / 180;
      for (var k = 0; k < 18; k++) {
        var x = 12 + 23 * k, y = scallop(x) + 1, tall = 4 + 2 * (k % 2);
        var dir = k % 2 === 0 ? 1 : -1;
        line(c, x, y, x + dir * tall * Math.sin(lean), y - tall * Math.cos(lean),
             1.5, "rgba(210,245,166,.9)");
      }
      dayBasket(c, 72, top + 44);
      dayApple(c, 150, top + 46);
      daySnail(c, 236, top + 46);
      daisy(c, 300, top + 45);
      daisy(c, 398, top + 45);
      var pebbles = [190, 340, 360];
      for (var p = 0; p < pebbles.length; p++) {
        ellipse(c, pebbles[p], top + 46, 3.5, 2, "rgba(110,74,42,.45)");
      }
      c.restore();
    },

    puff: "sparkle",
    puffColour: "rgba(255,201,60,.95)",

    visitors: [
      {
        name: "puppy", voice: "horn", w: 90, h: 55, feet: true, secs: 9, bob: 0,
        weight: 0.9, shadow: 0.18,
        draw: function (c, phase) { dayPuppy(c, phase); }
      },
      {
        name: "bluebird", voice: "chirp", w: 70, h: 45, band: [0.06, 0.40], secs: 8, bob: 10,
        weight: 1.1, shadow: 0.13,
        draw: function (c, phase) { dayBluebird(c, phase); }
      },
      {
        name: "rabbit", voice: "pop", w: 60, h: 45, feet: true, secs: 7, bob: 0,
        weight: 0.8, shadow: 0.18,
        draw: function (c, phase) { dayRabbit(c, phase); }
      },
      {
        name: "butterfly", voice: "pop", w: 50, h: 40, band: [0.10, 0.55], secs: 7, bob: 16,
        weight: 0.9, shadow: 0.13,
        draw: function (c, phase) { dayButterfly(c, phase); }
      },
      {
        name: "bee", voice: "hum", w: 40, h: 30, band: [0.15, 0.60], secs: 6, bob: 14,
        weight: 1, shadow: 0.13,
        draw: function (c, phase) { dayBee(c, phase); }
      },
      {
        name: "ladybird", voice: "tick", w: 36, h: 26, band: [0.20, 0.65], secs: 8, bob: 10,
        weight: 0.6, shadow: 0.13,
        draw: function (c, phase) { dayLadybird(c, phase); }
      }
    ]
  };

  // --------------------------------------------------- the meadow's litter

  // a picnic basket: a woven rrect with a handle and a gingham cloth peeking
  function dayBasket(c, x, y) {
    c.beginPath();
    c.ellipse(x, y - 4, 9, 7, 0, Math.PI, 0);
    c.lineWidth = 2;
    c.strokeStyle = D_BARK_DEEP;
    c.stroke();
    c.beginPath();
    rrect(c, x - 12, y - 4.5, 24, 11, 3);
    c.fillStyle = D_BARK;
    c.fill();
    var weave = [-8, -3, 2, 7];
    for (var i = 0; i < weave.length; i++) {
      line(c, x + weave[i], y - 4, x + weave[i], y + 6, 1, "rgba(110,74,42,.5)", "butt");
    }
    line(c, x - 11, y + 1, x + 11, y + 1, 1, "rgba(110,74,42,.5)", "butt");
    c.fillStyle = D_RED;
    c.fillRect(x + 2, y - 7, 8, 4);
  }

  function dayApple(c, x, y) {
    circle(c, x, y, 5, D_RED);
    circle(c, x - 1.6, y - 1.6, 1.5, "rgba(255,255,255,.6)");
    line(c, x, y - 5, x + 1, y - 8, 1.2, D_BARK_DEEP);
    ellipse(c, x + 3, y - 7, 2.5, 1.25, D_LEAF_DEEP);
  }

  // a snail on its way somewhere: a coral shell with a spiral, a cream body
  function daySnail(c, x, y) {
    c.beginPath();
    rrect(c, x - 9, y, 20, 4, 2);
    c.fillStyle = D_CREAM;
    c.fill();
    line(c, x + 9, y + 1, x + 12, y - 4, 1.2, D_CREAM);
    circle(c, x - 2, y - 3, 6, D_CORAL);
    c.beginPath();
    c.arc(x - 2, y - 3, 3.5, 0, 4.5);
    c.lineWidth = 1.2;
    c.strokeStyle = "rgba(201,77,101,.8)";
    c.stroke();
    circle(c, x + 12, y - 4.5, 1, D_INK);
  }

  // ------------------------------------------------------ the day visitors

  function dayKit(c) { return new Kit(c, D_WHITE, D_INK, D_INK, D_PENCIL); }

  /* A puppy trotting by: cream with a brown saddle and ear, a wagging tail,
     a tongue out. */
  function dayPuppy(c, phase) {
    var k = dayKit(c);
    var gait = turns(phase, 2.4), wag = Math.sin(turns(phase, 3)), ground = 54;
    k.limb(function (x) {
      x.moveTo(24, 30);
      x.quadraticCurveTo(14, 26, 10 + 3 * wag, 16);
    }, 6, D_CREAM, 16, 30);
    walkLeg(k, 34, 40, ground, gait + Math.PI, 7, 6, 5, dShade(D_CREAM), dShade(D_BARK));
    walkLeg(k, 60, 40, ground, gait, 7, 6, 5, dShade(D_CREAM), dShade(D_BARK));
    k.oval(20, 22, 72, 48, D_CREAM);
    k.blot(28, 22, 58, 36, D_BARK);
    walkLeg(k, 30, 42, ground, gait, 7, 6, 5, D_CREAM, D_BARK);
    walkLeg(k, 64, 42, ground, gait + Math.PI, 7, 6, 5, D_CREAM, D_BARK);
    k.oval(56, 14, 68, 38, D_BARK);
    k.disc(72, 24, 14, D_CREAM);
    k.blot(66, 14, 80, 26, D_BARK);
    k.blot(74, 24, 90, 36, D_CREAM);
    k.dot(87, 28, 2.6, D_INK);
    k.eye(76, 22, 3.2);
    k.blot(80, 33, 86, 40, D_CORAL);
    k.smile(82, 31, 3.5, 1.4);
  }

  /* A bluebird flying by: sky blue with a cream belly, an orange beak, wings
     beating. */
  function dayBluebird(c, phase) {
    var k = dayKit(c);
    var f = Math.sin(turns(phase, 2.6));
    k.shape(function (x) {
      x.moveTo(22, 26); x.lineTo(4, 20); x.lineTo(6, 30); x.lineTo(22, 32);
    }, D_SKY_DEEP, 20, 32);
    birdWing(k, 34, 22, f, true);
    k.oval(16, 16, 54, 38, D_SKY);
    k.blot(26, 26, 54, 38, D_CREAM);
    birdWing(k, 36, 20, f, false);
    k.disc(52, 18, 10, D_SKY);
    k.shape(function (x) {
      x.moveTo(60, 16); x.lineTo(70, 19); x.lineTo(60, 22);
    }, D_ORANGE, 16, 22);
    k.eye(55, 15, 2.6);
    k.dot(50, 22, 2, D_CHEEK);
    k.seg(40, 38, 42, 42, 1.5, D_ORANGE_DEEP);
    k.seg(46, 38, 48, 42, 1.5, D_ORANGE_DEEP);
  }

  // one bird wing from the shoulder, beating with f (-1 down, 1 up)
  function birdWing(k, sx, sy, f, far) {
    var lift = -18 * f;
    var colour = far ? dShade(D_SKY) : D_SKY;
    var tx = sx - 26, ty = sy + lift - 6;
    k.shape(function (x) {
      x.moveTo(sx, sy - 4);
      x.quadraticCurveTo(sx - 12, ty - 4, tx, ty);
      x.quadraticCurveTo(tx + 6, ty + 10, tx + 12, ty + 8);
      x.quadraticCurveTo(tx + 16, ty + 14, sx - 2, sy + 8);
    }, colour, Math.min(ty - 4, sy - 4), Math.max(ty + 14, sy + 8));
  }

  /* A rabbit hopping along: pale fur, tall ears with pink inside, a puff of a
     tail. The hop is its own - the body rises and the ears lay back. */
  function dayRabbit(c, phase) {
    var k = dayKit(c);
    var hop = Math.max(0, Math.sin(turns(phase, 1.4)));
    c.save();
    c.translate(0, -7 * hop);
    var lean = 0.25 * hop;
    k.disc(10, 30, 5, D_WHITE);
    k.oval(10, 26, 30, 42, D_FUR_SHADE);
    k.oval(14, 20, 46, 42, D_FUR);
    k.limb(function (x) { x.moveTo(38, 38); x.lineTo(44 + 4 * hop, 43 - 3 * hop); },
           4, D_FUR, 38, 43);
    k.limb(function (x) { x.moveTo(33, 39); x.lineTo(38 + 4 * hop, 44 - 3 * hop); },
           4, D_FUR_SHADE, 39, 44);
    var ears = [[38, D_FUR_SHADE, false], [44, D_FUR, true]];
    for (var i = 0; i < ears.length; i++) {
      c.save();
      c.translate(ears[i][0], 14);
      c.rotate(-0.15 - lean);
      k.oval(-3.5, -16, 3.5, 2, ears[i][1]);
      if (ears[i][2]) k.blot(-1.8, -13, 1.8, 0, D_PINK);
      c.restore();
    }
    k.disc(43, 20, 10, D_FUR);
    k.eye(46, 18, 2.6);
    k.dot(52, 22, 1.6, D_PINK);
    k.dot(41, 25, 2, D_CHEEK);
    k.seg(50, 23, 56, 22, 1, D_PENCIL);
    k.seg(50, 24, 56, 26, 1, D_PENCIL);
    c.restore();
  }

  /* A butterfly on the breeze, seen from the side: orange forewings with ink
     veins and white spots, coral hindwings, club-tipped antennae. */
  function dayButterfly(c, phase) {
    var k = dayKit(c);
    var open = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(turns(phase, 3.2)));
    var rx = 24, ry = 21, dirs = [1, -1], i;
    for (i = 0; i < 2; i++) {
      var dir = dirs[i];
      var hx = rx - 6, hy = ry + dir * 12 * open;
      k.shape(function (x) {
        x.moveTo(rx, ry);
        x.quadraticCurveTo(rx - 14, ry + dir * 4 * open, hx - 8, hy);
        x.quadraticCurveTo(hx + 2, hy + dir * 5 * open, hx + 10, hy - dir * 2);
      }, dir > 0 ? D_CORAL : dShade(D_CORAL),
         Math.min(ry, hy) - 4, Math.max(ry, hy) + 4);
    }
    for (i = 0; i < 2; i++) {
      var d = dirs[i];
      var tx = rx - 18, ty = ry - d * 17 * open;
      var wing = function (x) {
        x.moveTo(rx + 4, ry);
        x.quadraticCurveTo(rx + 6, ry - d * 12 * open, tx, ty);
        x.quadraticCurveTo(tx - 4, ty + d * 8 * open, rx - 10, ry - d * 2);
      };
      k.shape(wing, d > 0 ? D_ORANGE : dShade(D_ORANGE),
              Math.min(ry, ty) - 4, Math.max(ry, ty) + 4);
      c.save();
      k.trace(wing);
      c.clip();
      for (var v = 1; v <= 3; v++) {
        var kk = v / 3.5, u = 1 - kk;
        var px = rx * u * u + (rx - 6) * 2 * u * kk + tx * kk * kk;
        var py = ry * u * u + (ry - d * 8 * open) * 2 * u * kk + ty * kk * kk;
        k.seg(rx + 2, ry, px, py, 1, D_PENCIL);
      }
      var sx = rx - 12, sy = ry - d * 11 * open;
      k.dot(sx, sy, 1.8 * open + 0.6, D_WHITE);
      k.dot(sx + 4, sy + d * 3 * open, 1.2 * open + 0.4, D_WHITE);
      c.restore();
    }
    k.oval(16, 19, 36, 24, D_INK);
    k.disc(35, 21, 3, D_INK);
    for (i = 0; i < 2; i++) {
      var dy = dirs[i];
      var ax = 45, ay = 12 + dy * 6;
      k.stroke(function (x) {
        x.moveTo(37, 19 + dy);
        x.quadraticCurveTo(41, 15 + dy * 4, ax, ay);
      }, 1, D_PENCIL);
      k.dot(ax, ay, 1.2, D_INK);
    }
  }

  /* A bumblebee buzzing by: a striped yellow body, glassy wings a blur, a
     friendly face. */
  function dayBee(c, phase) {
    var k = dayKit(c);
    var buzz = Math.abs(Math.sin(turns(phase, 9)));
    var wings = [[-3, 1], [3, 0.8]];
    for (var i = 0; i < wings.length; i++) {
      var wx = 19 + wings[i][0], wk = wings[i][1];
      var wy = 8 - 3 * buzz * wk, hh = (6 + 4 * buzz) / 2;
      k.blot(wx - 5.5 * wk, wy - hh, wx + 5.5 * wk, wy + hh, D_GLASS);
    }
    var body = function (x) { x.ellipse(19, 18, 11, 7, 0, 0, Math.PI * 2); };
    k.shape(body, D_YELLOW, 11, 25);
    c.save();
    k.trace(body);
    c.clip();
    c.fillStyle = D_PENCIL;
    c.fillRect(14, 8, 3.5, 20);
    c.fillRect(21, 8, 3.5, 20);
    c.restore();
    k.disc(31, 17, 5.5, D_INK);
    k.dot(33, 15.5, 1.6, D_WHITE);
    k.dot(33.5, 15.8, 0.8, D_INK);
    k.smile(33, 18, 2.2, 1.1);
    k.seg(30, 12, 28, 5, 1, D_PENCIL);
    k.seg(33, 12, 36, 6, 1, D_PENCIL);
    k.dot(28, 5, 1, D_INK);
    k.dot(36, 6, 1, D_INK);
    var legs = [14, 19, 24];
    for (i = 0; i < legs.length; i++) k.seg(legs[i], 24, legs[i] - 1, 28, 1.2, D_PENCIL);
  }

  /* A ladybird in flight: the red shell opened into two wing-cases, ink spots
     on each, glassy wings beneath, an ink head with white eyes. */
  function dayLadybird(c, phase) {
    var k = dayKit(c);
    var buzz = Math.abs(Math.sin(turns(phase, 8)));
    var dirs = [-1, 1], i;
    for (i = 0; i < 2; i++) {
      var cy = 13 + dirs[i] * (5 + 3 * buzz);
      k.blot(8, cy - 2.5, 24, cy + 2.5, D_GLASS);
    }
    for (i = 0; i < 2; i++) {
      var d = dirs[i];
      var wing = function (x) {
        x.moveTo(22, 13);
        x.quadraticCurveTo(14, 13 + d * 2, 8, 13 + d * 7);
        x.quadraticCurveTo(14, 13 + d * 10, 22, 13 + d * 2);
      };
      k.shape(wing, d > 0 ? D_SHELL : dShade(D_SHELL),
              Math.min(13, 13 + d * 10), Math.max(13, 13 + d * 10));
      c.save();
      k.trace(wing);
      c.clip();
      k.dot(12, 13 + d * 6, 1.4, D_INK);
      k.dot(17, 13 + d * 4, 1.2, D_INK);
      c.restore();
    }
    k.oval(9, 10, 24, 16, D_INK);
    k.disc(26, 13, 4.2, D_INK);
    k.dot(28, 11.5, 1.4, D_WHITE);
    k.dot(28.4, 11.7, 0.7, D_INK);
    k.seg(28, 9, 31, 5, 1, D_PENCIL);
    k.seg(30, 11, 34, 8, 1, D_PENCIL);
    var legs = [12, 16, 20];
    for (i = 0; i < legs.length; i++) k.seg(legs[i], 16, legs[i] - 1, 20, 1, D_PENCIL);
  }

  // ================================================================= SPACE
  /* A friendly cartoon galaxy, ported from the app's
     lib/ui/themes/space_theme.dart and visitors/space_visitors.dart. Chubby
     pastel planets and twinkling stars float in a soft violet sky while
     words drop as white capsules on to a squishy moon. Everything ambient is
     a dot, a four-point star, a circle or a hairline; the tiles are the only
     white rounded rectangles, and the only thing that falls.

     Two clocks, as in the app: A turns over 40 seconds and drives the drift,
     the twinkle and the shooting stars, B over 3 and turns the big stars. */

  var S_WHITE = "#FFFFFF";
  var S_VIOLET = "#5A4FD6", S_NAVY = "#241E5C";
  var S_INK = "#0B0824";
  var S_SLATE = "#4A4580";
  var S_GOLD = "#FFD166", S_CREAM = "#FFE9A8", S_CYAN = "#7FD3FF";
  var S_LAVENDER = "#C9C2FF";
  var S_SILVER = "#D9D4F5", S_SILVER_SHADE = "#B9B1E6", S_STEEL = "#8F86C9";
  var S_SEA = "#4FA8DC";
  var S_NEON_GREEN = "#7DFF9A", S_NEON_PINK = "#FF6BD6", S_NEON_ORANGE = "#FF8A3D";
  var S_RED = "#FF5D73", S_MINT = "#9DF5C8", S_PURPLE = "#B07CFF";
  var S_MOON_LIT = "#D9D4F5", S_MOON_SHADE = "#B9B1E6";
  var S_MOON_CRATER = "#A69ED6", S_MOON_RIM = "#8F86C9";

  // stars live between the atmosphere line and the pile, in five wrapping
  // lanes so a slow upward scroll is seamless
  var S_STAR_TOP = CEIL + 8, S_STAR_BOTTOM = H - 90, S_LANES = 5;
  var S_LANE_SPAN = (S_STAR_BOTTOM - S_STAR_TOP) / S_LANES;
  var S_DUST_CELL = 120;

  /* The far field, fixed once. The app seeds it from `math.Random(2026)`,
     which a browser cannot reproduce, so this uses the page's own stable
     noise instead: the same rules - 56 stars, thinned to 40% inside the fall
     lane, four twinkle periods - laid out at its own coordinates. */
  var S_STARS = (function () {
    var cycles = [20, 16, 10, 8];   // periods of 2, 2.5, 4 and 5 seconds
    var out = [], i = 0;
    while (out.length < 56 && i < 400) {
      var n = noise(i, 11);
      var x = 6 + n * (W - 12);
      i++;
      if (x > 120 && x < 300 && noise(i, 12) > 0.4) continue;
      out.push({
        lane: Math.floor(noise(i, 13) * S_LANES) % S_LANES,
        y0: noise(i, 14) * S_LANE_SPAN,
        x: x,
        r: 1 + noise(i, 15) * 1.2,
        warm: noise(i, 16) < 0.3,
        base: 0.28 + noise(i, 17) * 0.12,
        cycles: cycles[Math.floor(noise(i, 18) * 4) % 4],
        phase: noise(i, 19)
      });
    }
    return out;
  })();

  var S_DUST = (function () {
    var out = [];
    for (var i = 0; i < 12; i++) {
      out.push([i % 2, noise(i, 21) * S_DUST_CELL,
                Math.floor(noise(i, 22) * S_LANES) % S_LANES,
                noise(i, 23) * S_LANE_SPAN]);
    }
    return out;
  })();

  // big four-point stars, all outside the fall lane
  var S_BIG = [[24, 104, 7], [394, 82, 9], [20, 250, 6],
               [402, 224, 8], [30, 470, 7], [392, 566, 8]];
  // mid stars that carry a crossed sparkle
  var S_SPARKLES = [[96, 206], [338, 132], [70, 332], [356, 428], [108, 522]];

  // a four-point star of radius 1 at the origin, scaled where it is drawn
  function unitStar(c) {
    c.beginPath();
    c.moveTo(0, -1);
    c.quadraticCurveTo(0, 0, 1, 0);
    c.quadraticCurveTo(0, 0, 0, 1);
    c.quadraticCurveTo(0, 0, -1, 0);
    c.quadraticCurveTo(0, 0, 0, -1);
    c.closePath();
  }

  /* A soft white halo round a planet. The app blurs a saved layer; a radial
     that fades to nothing is the same picture for a great deal less, and it
     is the only place the two differ. */
  function halo(c, cx, cy, r, alpha) {
    var g = c.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
    g.addColorStop(0, "rgba(255,255,255," + alpha + ")");
    g.addColorStop(1, "rgba(255,255,255,0)");
    circle(c, cx, cy, r, g);
  }

  function shadeDisc(c, cx, cy, r, ox, oy, colour) {
    c.save();
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.clip();
    circle(c, cx + ox, cy + oy, r, colour);
    c.restore();
  }

  var space = {
    id: "space",
    nebula: null,

    // three soft nebula blobs over a 150%-of-field rect, baked and drifted
    bakeNebula: function (px) {
      var nw = 1.5 * W, nh = 1.5 * H;
      var cv = offscreen(512, 512 * nh / nw), c = cv.getContext("2d");
      var k = 512 / nw;
      c.scale(k, k);
      var blobs = [[0.25, 0.25, 0.5, 0.42, "255,127,176", 0.14],
                   [0.80, 0.60, 0.45, 0.40, "95,214,214", 0.12],
                   [0.50, 0.95, 0.40, 0.30, "255,196,107", 0.10]];
      for (var i = 0; i < blobs.length; i++) {
        var b = blobs[i];
        var g = c.createRadialGradient(b[0] * nw, b[1] * nh, 0,
                                       b[0] * nw, b[1] * nh, b[2] * nw);
        g.addColorStop(0, "rgba(" + b[4] + "," + b[5] + ")");
        g.addColorStop(0.7, "rgba(" + b[4] + ",0)");
        c.save();
        // an ellipse, not a circle: the app's radial has its own y radius
        c.translate(b[0] * nw, b[1] * nh);
        c.scale(1, b[3] * nh / (b[2] * nw));
        c.translate(-b[0] * nw, -b[1] * nh);
        c.fillStyle = g;
        c.fillRect(-nw, -nh, nw * 3, nh * 3);
        c.restore();
      }
      return cv;
    },

    backdrop: function (c, t60, px, clock) {
      if (!this.nebula) this.nebula = this.bakeNebula(px);
      var now = clock || 0;
      var a = reduced ? 0.4 : (now / 40) % 1;
      var b = reduced ? 0.25 : (now / 3) % 1;
      this.drawNebula(c, a);
      this.stars(c, a, b);
      this.planets(c, a);
      this.sparkles(c, b);
      if (!reduced) { this.dust(c, a); this.shooting(c, a); }
      this.atmosphere(c);
    },

    drawNebula: function (c, a) {
      var nw = 1.5 * W, nh = 1.5 * H;
      // a triangle wave eased at both ends: seamless when the clock wraps
      var tri = 1 - Math.abs(2 * a - 1);
      var t = tri * tri * (3 - 2 * tri);
      var tx = (-3 + 6 * t) / 100 * nw, ty = (-2 + 4 * t) / 100 * nh;
      var s = 1 + 0.05 * t;
      c.save();
      c.translate(-0.25 * W, -0.25 * H);
      c.translate(tx + nw / 2, ty + nh / 2);
      c.scale(s, s);
      c.translate(-nw / 2, -nh / 2);
      c.drawImage(this.nebula, 0, 0, nw, nh);
      c.restore();
    },

    /* Five lanes of far stars scrolling up at about 3 px/s, each twinkling on
       its own integer count of cycles and fading at its lane's edges so the
       wrap is invisible; then the big four-point stars, turning. */
    stars: function (c, a, b) {
      var scroll = a * S_LANE_SPAN, i;
      for (i = 0; i < S_STARS.length; i++) {
        var s = S_STARS[i];
        var y = (s.y0 - scroll) % S_LANE_SPAN;
        if (y < 0) y += S_LANE_SPAN;
        var edge = Math.min(y, S_LANE_SPAN - y);
        var fade = edge >= 14 ? 1 : edge / 14;
        y += S_STAR_TOP + s.lane * S_LANE_SPAN;
        var tw = 0.5 + 0.5 * Math.sin(2 * Math.PI * (a * s.cycles + s.phase));
        circle(c, s.x, y, s.r,
               rgba(parse(s.warm ? S_CREAM : S_WHITE), (s.base + 0.5 * tw) * fade));
      }
      for (i = 0; i < S_BIG.length; i++) {
        var w = Math.sin(2 * Math.PI * (b + i / S_BIG.length));
        c.save();
        c.translate(S_BIG[i][0], S_BIG[i][1]);
        c.rotate(8 * Math.PI / 180 * w);
        c.scale(S_BIG[i][2], S_BIG[i][2]);
        unitStar(c);
        c.fillStyle = "rgba(255,255,255," + (0.45 + 0.2 * w) + ")";
        c.fill();
        c.restore();
      }
    },

    /* The three planets, bobbing 6 px over 10 s and drifting 8 px over the
       whole 40, and the crescent moon. Drawn rather than baked: at this size
       a circle and a clipped ring cost less than the sprite would. */
    planets: function (c, a) {
      var tau = 2 * Math.PI;
      var spots = [[58, 150], [372, 300], [46, 396]];
      for (var i = 0; i < 3; i++) {
        var bob = 6 * Math.sin(tau * (a * 4 + i / 3));
        var drift = 8 * Math.sin(tau * (a + i / 3 + 0.25));
        var cx = spots[i][0] + drift, cy = spots[i][1] + bob;
        c.save();
        c.translate(cx, cy);
        if (i === 0) this.pinkPlanet(c);
        else if (i === 1) this.bluePlanet(c);
        else this.peachPlanet(c);
        c.restore();
      }
      /* The crescent moon, bobbing 2 px over 20 s. A true difference of the
         two discs, as the app's `Path.combine` makes it: the small one is
         not wholly inside the large one, so an even-odd fill of both would
         paint the overhang as well and the moon would come out a ring. The
         clip is what keeps it to the large disc; inside it, even-odd takes
         the small one out of a covering rect. */
      c.save();
      c.translate(59, 75 + 2 * Math.sin(tau * a * 2));
      c.beginPath();
      c.arc(0, 0, 16, 0, Math.PI * 2);
      c.clip();
      c.beginPath();
      c.rect(-18, -18, 36, 36);
      c.arc(7, -3, 14, 0, Math.PI * 2);
      c.fillStyle = "rgba(255,255,255,.55)";
      c.fill("evenodd");
      c.restore();
    },

    // the pink ringed planet: the back half of the ring, the ball with its
    // shaded side, then the front half over it
    pinkPlanet: function (c) {
      halo(c, 0, 0, 56, 0.16);
      var tilt = -22 * Math.PI / 180;
      for (var pass = 0; pass < 2; pass++) {
        c.save();
        c.rotate(tilt);
        c.beginPath();
        c.rect(-60, pass === 0 ? -30 : 0, 120, 30);
        c.clip();
        c.beginPath();
        c.ellipse(0, 0, 46, 12, 0, 0, Math.PI * 2);
        c.lineWidth = 5;
        c.strokeStyle = "rgba(255,255,255,.85)";
        c.stroke();
        c.restore();
        if (pass === 0) {
          circle(c, 0, 0, 30, "#FF9FB2");
          shadeDisc(c, 0, 0, 30, 11, 7, "#E27A92");
        }
      }
    },

    // the blue planet with two cloud bands, clipped inside the ball
    bluePlanet: function (c) {
      halo(c, 0, 0, 32, 0.18);
      circle(c, 0, 0, 22, S_CYAN);
      c.save();
      c.beginPath();
      c.arc(0, 0, 22, 0, Math.PI * 2);
      c.clip();
      c.rotate(-10 * Math.PI / 180);
      c.fillStyle = "rgba(79,168,220,.6)";
      c.beginPath(); rrect(c, -30, -9, 60, 5, 3); c.fill();
      c.beginPath(); rrect(c, -30, 4, 60, 4, 2); c.fill();
      c.restore();
    },

    // a small peach planet near the pile: dim and clearly not a moon
    peachPlanet: function (c) {
      halo(c, 0, 0, 26, 0.14);
      circle(c, 0, 0, 16, "#FFB1A0");
      shadeDisc(c, 0, 0, 16, 6, 4, "#E08A78");
    },

    // a dot with two crossed hairlines that breathe with the twinkle
    sparkles: function (c, b) {
      for (var i = 0; i < S_SPARKLES.length; i++) {
        var x = S_SPARKLES[i][0], y = S_SPARKLES[i][1];
        var pulse = 0.5 + 0.5 * Math.sin(2 * Math.PI * (b + i / S_SPARKLES.length));
        var col = "rgba(255,255,255," + (0.3 + 0.5 * pulse) + ")";
        var arm = 2.5 + 2 * pulse;
        circle(c, x, y, 1.5, col);
        line(c, x - arm, y, x + arm, y, 1, col);
        line(c, x, y - arm, x, y + arm, 1, col);
      }
    },

    // specks drifting up and to the left in the two outer columns
    dust: function (c, a) {
      for (var i = 0; i < S_DUST.length; i++) {
        var d = S_DUST[i];
        var x = (d[1] - a * S_DUST_CELL) % S_DUST_CELL;
        if (x < 0) x += S_DUST_CELL;
        var y = (d[3] - a * S_LANE_SPAN) % S_LANE_SPAN;
        if (y < 0) y += S_LANE_SPAN;
        circle(c, x + (d[0] === 0 ? 0 : 300),
               y + S_STAR_TOP + d[2] * S_LANE_SPAN, 0.8, "rgba(255,255,255,.2)");
      }
    },

    /* Four shooting stars a cycle, ten seconds apart and half a second each:
       a hairline in the top quarter and an outer third. */
    shooting: function (c, a) {
      for (var k = 0; k < 4; k++) {
        var local = (a - k * 0.25) / 0.0125;
        if (local < 0 || local >= 1) continue;
        var left = k % 2 === 0;
        var sx = left ? 14 : 406, sy = 76 + 34 * k;
        var dx = left ? 109 : -109, dy = 51;
        var hx = sx + dx * local, hy = sy + dy * local;
        var len = Math.sqrt(dx * dx + dy * dy);
        var tx = hx - dx / len * 46, ty = hy - dy / len * 46;
        var g = c.createLinearGradient(hx, hy, tx, ty);
        g.addColorStop(0, "rgba(255,255,255," + (0.7 * (1 - local)) + ")");
        g.addColorStop(1, "rgba(255,255,255,0)");
        line(c, hx, hy, tx, ty, 2, g);
      }
    },

    // the calm atmosphere line at the ceiling, with a 10 px haze under it
    atmosphere: function (c) {
      c.fillStyle = "rgba(127,211,255,.6)";
      c.fillRect(0, CEIL - 1, W, 2);
      c.fillStyle = grad(c, 0, CEIL + 1, 0, CEIL + 11,
        [[0, "rgba(127,211,255,.15)"], [1, "rgba(127,211,255,0)"]]);
      c.fillRect(0, CEIL + 1, W, 10);
    },

    /* A squishy cartoon moon. Its crest touches the resting line at the
       centre and dips 3 px at the sides; craters and two sparkles are
       painted with it. */
    ground: function (c) {
      var GLOW = 10, top = H - FLOOR - GLOW, h = FLOOR + GLOW;
      c.fillStyle = grad(c, 0, top, 0, top + GLOW,
        [[0, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,.1)"]]);
      c.fillRect(0, top, W, GLOW);
      function crest() {
        c.beginPath();
        c.moveTo(0, top + GLOW + 3);
        c.quadraticCurveTo(W / 2, top + GLOW - 3, W, top + GLOW + 3);
      }
      crest();
      c.lineTo(W, top + h);
      c.lineTo(0, top + h);
      c.closePath();
      c.fillStyle = grad(c, 0, top + GLOW, 0, top + h,
        [[0, S_MOON_LIT], [1, S_MOON_SHADE]]);
      c.fill();
      c.save();
      c.clip();
      // the shade band just under the rim: a capsule visibly sits ON the moon
      c.beginPath();
      c.moveTo(0, top + GLOW + 7);
      c.quadraticCurveTo(W / 2, top + GLOW + 1, W, top + GLOW + 7);
      c.lineWidth = 3;
      c.strokeStyle = "rgba(143,134,201,.35)";
      c.stroke();
      var craters = [[70, 30, 26, 10], [180, 39, 18, 7],
                     [300, 28, 14, 6], [380, 37, 30, 11]];
      for (var i = 0; i < craters.length; i++) {
        var cr = craters[i];
        var cx = cr[0], cy = top + GLOW + cr[1] - 6;
        ellipse(c, cx, cy, cr[2] / 2, cr[3] / 2, "rgba(166,158,214,.6)");
        c.beginPath();
        c.ellipse(cx, cy, cr[2] / 2 - 0.5, cr[3] / 2 - 0.5, 0, 0.3, Math.PI - 0.3);
        c.lineWidth = 1;
        c.strokeStyle = "rgba(255,255,255,.35)";
        c.stroke();
      }
      c.restore();
      crest();
      c.lineWidth = 2;
      c.strokeStyle = "rgba(255,255,255,.6)";
      c.stroke();
      circle(c, 130, top + GLOW + 12, 2, "rgba(255,255,255,.8)");
      circle(c, 342, top + GLOW + 36, 2, "rgba(255,255,255,.8)");
    },

    puff: "sparkle",
    puffColour: "rgba(255,233,168,.9)",

    visitors: [
      {
        name: "saucer", voice: "hum", w: 120, h: 60, band: [0.08, 0.40], secs: 10, bob: 8,
        weight: 1.2, shadow: 0.13,
        draw: function (c, phase) { spaceSaucer(c, phase); }
      },
      {
        name: "rocket", voice: "growl", w: 110, h: 60, band: [0.10, 0.50], secs: 7, bob: 6,
        weight: 1, shadow: 0.13,
        draw: function (c, phase) { spaceRocket(c, phase); }
      },
      {
        name: "astronaut", voice: "blip", w: 70, h: 80, band: [0.15, 0.60], secs: 16, bob: 12,
        weight: 0.8, shadow: 0.13,
        draw: function (c, phase, t) { spaceAstronaut(c, phase, t); }
      },
      {
        name: "comet", voice: null, w: 160, h: 50, band: [0.03, 0.30], secs: 4, bob: 0,
        weight: 0.9, shadow: 0,
        draw: function (c, phase) { spaceComet(c, phase); }
      },
      {
        name: "satellite", voice: "blip", w: 90, h: 60, band: [0.05, 0.35], secs: 14, bob: 6,
        weight: 0.5, shadow: 0.13,
        draw: function (c, phase) { spaceSatellite(c, phase); }
      },
      {
        name: "buggy", voice: "knock", w: 90, h: 60, band: [0.955, 0.955], secs: 12, bob: 0,
        weight: 0.7, shadow: 0.13,
        draw: function (c, phase) { spaceBuggy(c, phase); }
      }
    ]
  };

  // ---------------------------------------------------- the space visitors

  function spaceKit(c) { return new Kit(c, S_WHITE, S_INK, S_INK); }
  function rad(d) { return d * Math.PI / 180; }

  /* A silver saucer with a glass dome, a green pilot peeking out, and a ring
     of rim lights that chase each other round. */
  function spaceSaucer(c, phase) {
    var k = spaceKit(c);
    c.save();
    c.translate(60, 38);
    c.rotate(rad(4) * Math.sin(phase * 1.6));
    c.translate(-60, -38);
    k.oval(53, 17, 67, 29, S_MINT);
    k.eye(57, 22, 2.7);
    k.eye(63, 22, 2.7);
    k.stroke(function (x) {
      x.moveTo(57.5, 25.5);
      x.quadraticCurveTo(60, 27.8, 62.5, 25.5);
    }, 1.6, S_INK);
    // the dome: a half-disc of glass with a highlight on its shoulder
    k.shape(function (x) {
      x.moveTo(43, 33);
      x.arc(60, 33, 17, Math.PI, 0);
    }, "rgba(127,211,255,.28)", 16, 33);
    c.beginPath();
    c.ellipse(60, 33, 13, 13, 0, rad(-150), rad(-105));
    c.lineWidth = 2.2;
    c.strokeStyle = "rgba(255,255,255,.75)";
    c.stroke();
    k.oval(30, 36, 90, 56, S_SILVER_SHADE);
    k.oval(4, 30, 116, 50, S_SILVER);
    c.beginPath();
    c.ellipse(60, 40, 53, 7, 0, rad(190), rad(240));
    c.lineWidth = 2;
    c.strokeStyle = "rgba(255,255,255,.7)";
    c.stroke();
    // seven rim lights: one lit, the one behind it still fading
    var lit = Math.floor(phase * 6) % 7;
    for (var i = 0; i < 7; i++) {
      var x = 18 + i * 14, on = i === lit, fading = (i + 1) % 7 === lit;
      if (on) k.dot(x, 41, 6, "rgba(255,107,214,.35)");
      k.dot(x, 41, 3.8, S_INK);
      k.dot(x, 41, 2.6, on ? S_NEON_PINK : (fading ? "rgba(255,107,214,.5)" : S_VIOLET));
      if (on) k.dot(x, 41, 1.1, S_WHITE);
    }
    c.restore();
  }

  /* A white rocket flying nose first with a friendly alien at the porthole;
     its flame flickers between two shapes. */
  function spaceRocket(c, phase) {
    var k = spaceKit(c);
    var long = Math.floor(phase * 14) % 2 === 0;
    var tip = long ? 3 : 12, flare = long ? 8 : 10.5;
    k.shape(function (x) {
      x.moveTo(34, 30 - flare);
      x.quadraticCurveTo(16, 30 - flare * 0.7, tip, 30);
      x.quadraticCurveTo(16, 30 + flare * 0.7, 34, 30 + flare);
    }, S_NEON_ORANGE, 30 - flare, 30 + flare);
    k.wash(function (x) {
      x.moveTo(34, 26);
      x.quadraticCurveTo(24, 27, tip + 10, 30);
      x.quadraticCurveTo(24, 33, 34, 34);
    }, S_CREAM);
    k.shape(function (x) { x.moveTo(48, 19); x.lineTo(30, 4); x.lineTo(24, 19); },
            S_RED, 4, 19);
    k.shape(function (x) { x.moveTo(48, 41); x.lineTo(30, 56); x.lineTo(24, 41); },
            S_RED, 41, 56);
    k.shape(function (x) {
      x.moveTo(30, 17);
      x.lineTo(86, 17);
      x.quadraticCurveTo(103, 20, 108, 30);
      x.quadraticCurveTo(103, 40, 86, 43);
      x.lineTo(30, 43);
      x.arc(30, 30, 13, Math.PI / 2, -Math.PI / 2);
    }, S_WHITE, 17, 43);
    k.shape(function (x) {
      x.moveTo(86, 17);
      x.quadraticCurveTo(103, 20, 108, 30);
      x.quadraticCurveTo(103, 40, 86, 43);
    }, S_RED, 17, 43);
    k.round(52, 17, 58, 43, 1.5, S_RED);
    k.disc(70, 30, 10.5, S_STEEL);
    k.dot(70, 30, 7.8, S_SLATE);
    k.dot(70, 31.5, 5.4, S_MINT);
    k.eye(67.8, 29.5, 1.8);
    k.eye(72.4, 29.5, 1.8);
    k.stroke(function (x) {
      x.moveTo(68.3, 33);
      x.quadraticCurveTo(70.2, 34.8, 72.2, 33);
    }, 1.2, S_INK);
    k.dot(70, 30, 7.8, "rgba(127,211,255,.16)");
    c.beginPath();
    c.ellipse(70, 30, 6.5, 6.5, 0, rad(-160), rad(-110));
    c.lineWidth = 1.6;
    c.strokeStyle = "rgba(255,255,255,.8)";
    c.stroke();
  }

  /* An astronaut drifting by, tumbling once over the crossing, a tether
     curling away behind. */
  function spaceAstronaut(c, phase, t) {
    var k = spaceKit(c);
    var wave = Math.sin(phase * 1.4);
    var tether = function (x) {
      x.moveTo(-3, 30 + 8 * wave);
      x.bezierCurveTo(6, 2 + 10 * wave, 10, 70 - 8 * wave, 20, 46);
      x.quadraticCurveTo(27, 32 - 5 * wave, 36, 44);
    };
    k.stroke(tether, 4, S_STEEL);
    k.stroke(tether, 2.4, S_LAVENDER);
    c.save();
    c.translate(36, 42);
    c.rotate((t || 0) * 2 * Math.PI);
    c.translate(-36, -42);
    k.round(15, 31, 29, 57, 4, S_SILVER_SHADE);
    k.limb(function (x) { x.moveTo(31, 55); x.lineTo(25, 71); }, 8, S_WHITE, 55, 71);
    k.limb(function (x) { x.moveTo(43, 55); x.lineTo(47, 71); }, 8, S_WHITE, 55, 71);
    k.disc(24, 73, 4.5, S_STEEL);
    k.disc(48, 73, 4.5, S_STEEL);
    k.limb(function (x) { x.moveTo(28, 40); x.lineTo(15, 28); }, 7, S_WHITE, 28, 40);
    k.limb(function (x) { x.moveTo(48, 40); x.lineTo(60, 52); }, 7, S_WHITE, 40, 52);
    k.disc(13, 26, 4, S_RED);
    k.disc(62, 54, 4, S_RED);
    k.round(24, 33, 50, 60, 9, S_WHITE);
    k.round(32, 42, 44, 50, 2, S_CYAN);
    k.dot(35.5, 46, 1.5, S_RED);
    k.dot(40.5, 46, 1.5, S_NEON_GREEN);
    k.disc(38, 22, 14, S_WHITE);
    k.oval(30, 14, 50, 30, S_GOLD);
    k.blot(34, 17, 42, 21, "rgba(255,255,255,.8)");
    c.restore();
  }

  /* A comet: a bright head with a long tail of dots that shrink, fade and
     twinkle towards the back, and a few sparkles pulsing along the way. */
  function spaceComet(c, phase) {
    var k = spaceKit(c);
    var i;
    for (i = 0; i < 14; i++) {
      var back = i / 14;
      var x = 126 - i * 8.6;
      var y = 25 + 5 * back * Math.sin(phase * 5 + i * 0.7);
      var twinkle = 0.55 + 0.45 * Math.sin(phase * 11 + i * 1.9);
      var col = [S_WHITE, S_CREAM, S_CYAN][i % 3];
      k.dot(x, y, 1.2 + 5.5 * (1 - back), rgba(parse(col), (1 - back) * twinkle));
    }
    var sparks = [[104, 9, 4], [78, 42, 3.5], [48, 8, 3], [18, 39, 2.5]];
    for (i = 0; i < sparks.length; i++) {
      var pulse = 0.5 + 0.5 * Math.sin(phase * 9 + i * 2.1);
      c.save();
      c.translate(sparks[i][0], sparks[i][1]);
      var s = sparks[i][2] * (0.6 + 0.5 * pulse);
      c.scale(s, s);
      unitStar(c);
      c.fillStyle = "rgba(255,255,255," + (0.35 + 0.6 * pulse) + ")";
      c.fill();
      c.restore();
    }
    k.dot(138, 25, 21, "rgba(255,209,102,.18)");
    k.dot(138, 25, 16, "rgba(255,233,168,.3)");
    k.disc(138, 25, 11.5, S_CREAM);
    k.blot(132, 14.5, 148, 30.5, S_WHITE);
  }

  /* A satellite: a boxy body between two solar panels, a dish on top, a lamp
     blinking underneath, the whole thing turning slowly as it drifts. */
  function spaceSatellite(c, phase) {
    var k = spaceKit(c);
    c.save();
    c.translate(45, 31);
    c.rotate(rad(-12) + phase * 2 * Math.PI / 26);
    c.translate(-45, -31);
    k.limb(function (x) { x.moveTo(16, 31); x.lineTo(74, 31); }, 3, S_STEEL, 31, 31);
    var panels = [2, 61], i, j;
    for (i = 0; i < panels.length; i++) {
      var l = panels[i];
      k.round(l, 22, l + 27, 40, 2, S_SEA);
      for (j = 1; j < 4; j++) {
        var x = l + j * 6.75;
        k.seg(x, 23, x, 39, 1.2, "rgba(127,211,255,.8)");
      }
      k.seg(l + 1, 31, l + 26, 31, 1.2, "rgba(127,211,255,.8)");
    }
    k.round(33, 20, 57, 42, 4, S_SILVER);
    k.round(37, 25, 53, 32, 1.5, S_SLATE);
    k.dot(40, 37, 1.6, S_NEON_GREEN);
    k.dot(45, 37, 1.6, S_GOLD);
    k.shape(function (x) { x.moveTo(36, 10); x.arc(45, 10, 9, Math.PI, 0, true); },
            S_SILVER, 1, 10);
    k.seg(45, 10, 45, 4, 2.2, S_STEEL);
    k.disc(45, 3.5, 2.2, S_STEEL);
    k.seg(38, 42, 38, 52, 2.2, S_STEEL);
    k.disc(38, 53, 2, S_STEEL);
    var on = Math.floor(phase * 2) % 2 === 0;
    k.seg(52, 42, 52, 47, 2.2, S_STEEL);
    if (on) k.dot(52, 49.5, 6, "rgba(255,107,214,.35)");
    k.disc(52, 49.5, 2.8, on ? S_NEON_PINK : S_SLATE);
    c.restore();
  }

  /* A purple three-eyed alien driving a tiny moon buggy along the ground:
     the wheels roll as fast as the layer moves it. */
  function spaceBuggy(c, phase) {
    var k = spaceKit(c);
    var wr = 9, axle = 60 - 1.25 - wr;
    var wheels = [[22, axle], [68, axle]];
    // the crossing covers the field plus one box in 12 s, about 42 px/s: 4.7
    // rad/s on a 9 px wheel, clockwise for a buggy heading right
    var spin = phase * 4.7, i, s;
    k.seg(13, 32, 13, 8, 2.2, S_STEEL);
    var flap = 1.5 * Math.sin(phase * 9);
    k.shape(function (x) { x.moveTo(13, 7); x.lineTo(1, 11 + flap); x.lineTo(13, 15); },
            S_NEON_PINK, 7, 15);
    k.oval(34, 20, 58, 38, S_PURPLE);
    k.limb(function (x) { x.moveTo(52, 26); x.lineTo(63, 29); }, 5, S_PURPLE, 26, 29);
    for (i = 0; i < wheels.length; i++) {
      var wx = wheels[i][0], wy = wheels[i][1];
      k.disc(wx, wy, wr, S_SLATE);
      for (s = 0; s < 3; s++) {
        var a = spin + s * 2 * Math.PI / 3;
        k.seg(wx, wy, wx + Math.cos(a) * (wr - 1.5), wy + Math.sin(a) * (wr - 1.5),
              2, S_LAVENDER);
      }
      k.disc(wx, wy, 3, S_SILVER);
    }
    k.round(8, 31, 82, 45, 5, S_SILVER);
    c.fillStyle = S_SILVER_SHADE;
    c.fillRect(9.5, 39.5, 71, 4);
    for (i = 0; i < wheels.length; i++) {
      for (s = 0; s < 2; s++) {
        c.beginPath();
        c.arc(wheels[i][0], wheels[i][1], wr + 3.5, Math.PI, 0);
        c.lineWidth = s === 0 ? 6 : 3.5;
        c.strokeStyle = s === 0 ? S_STEEL : S_SILVER_SHADE;
        c.stroke();
      }
    }
    k.disc(46, 13, 10.5, S_PURPLE);
    k.eye(39.5, 11, 2.8);
    k.eye(46.5, 9.5, 2.8);
    k.eye(53.5, 11, 2.8);
    k.stroke(function (x) {
      x.moveTo(41.5, 17);
      x.quadraticCurveTo(46.5, 21, 51.5, 17);
    }, 1.8, S_INK);
    k.seg(68, 31, 66.5, 25, 2.2, S_STEEL);
    c.beginPath();
    c.arc(66.5, 24, 4.5, 0, Math.PI * 2);
    c.lineWidth = 2.5;
    c.strokeStyle = S_STEEL;
    c.stroke();
    k.disc(64, 28, 3, S_PURPLE);
    k.wash(function (x) {
      x.moveTo(84, 33); x.lineTo(90, 29); x.lineTo(90, 43); x.lineTo(84, 39);
    }, "rgba(255,209,102,.3)");
    k.disc(82, 36, 3.2, S_GOLD);
  }

  /* Only a world the page can actually play is in here. A locked one has a
     thumbnail and no more, and `setTheme` falls back rather than trusting an
     id: a stale localStorage value must not be able to strip the scenery. */
  var THEMES = { light: light, day: day, space: space };

  // ============================================================ the stage

  function Stage(back, front) {
    this.back = back;
    this.front = front;
    this.bctx = back.getContext("2d");
    this.fctx = front.getContext("2d");
    this.theme = light;
    this.px = 1;
    this.t0 = 0;
    this.visitor = null;
    this.nextVisit = 6;
    this.clock = 0;
  }

  Stage.prototype.resize = function (cssW, cssH) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.px = (cssW / W) * dpr;
    var pw = Math.round(cssW * dpr), ph = Math.round(cssH * dpr);
    [this.back, this.front].forEach(function (c) {
      c.width = pw; c.height = ph;
    });
    this.bctx.setTransform(this.px, 0, 0, this.px, 0, 0);
    this.fctx.setTransform(this.px, 0, 0, this.px, 0, 0);
    // a baked layer is rendered at the old resolution, so it goes
    for (var id in THEMES) {
      if (Object.prototype.hasOwnProperty.call(THEMES, id)) {
        THEMES[id].baked = null;
        THEMES[id].nebula = null;
      }
    }
    this.drawGround();
  };

  Stage.prototype.setTheme = function (id) {
    this.theme = THEMES[id] || light;
    this.visitor = null;
    this.nextVisit = this.clock + 6;
    this.drawGround();
  };

  Stage.prototype.drawGround = function () {
    var c = this.fctx;
    c.clearRect(0, 0, W, H + 4);
    this.theme.ground(c);
  };

  /* One creature at a time crosses between the scenery and the words. Which
     one is a weighted draw; how big and how fast it is comes from one random
     number, which is the whole reason they read as distance rather than as
     sprites. */
  Stage.prototype.callVisitor = function () {
    var list = this.theme.visitors;
    var total = 0, i;
    for (i = 0; i < list.length; i++) total += list[i].weight;
    var r = Math.random() * total, pick = list[0];
    for (i = 0; i < list.length; i++) {
      r -= list[i].weight;
      if (r <= 0) { pick = list[i]; break; }
    }
    var depth = Math.random();
    this.visitor = {
      def: pick,
      born: this.clock,
      secs: pick.secs * (1 + 0.6 * depth),
      scale: 1 - 0.34 * depth,
      alpha: 1 - 0.36 * depth,
      right: Math.random() < 0.5,
      wobble: Math.random() * Math.PI * 2,
      /* Where it crosses. A walker has no band of its own: it stands with
         its soles on the ground line, which for a box of height h is
         1 - h / 2 / FLOOR_TOP - the same arithmetic the app's visitor lists
         write out per creature. */
      y: pick.feet
        ? FLOOR_TOP - pick.h / 2
        : lerp(pick.band[0], pick.band[1], Math.random()) * FLOOR_TOP,
      depth: depth,
      // poke state, reset with every visit: when it was last startled, how
      // many times this crossing, and where it was last drawn so a tap can
      // be tested against it
      poked: null,
      pokes: 0,
      box: null
    };
  };

  Stage.prototype.drawVisitor = function (ctx) {
    var v = this.visitor;
    if (!v) return;
    var age = this.clock - v.born;
    var t = age / v.secs;
    if (t >= 1) {
      this.visitor = null;
      // between visits, a pause of 18 to 72 seconds
      this.nextVisit = this.clock + 18 + Math.random() * 54;
      return;
    }
    var d = v.def, k = v.scale;
    var travel = W + d.w;
    var x = v.right ? -d.w + travel * t : W - travel * t;
    var yTop = v.y + Math.sin(v.wobble + age * 1.3) * d.bob - d.h / 2;
    var cx = x + d.w / 2, cy = yTop + d.h / 2 + this.hop(v) * k;

    // where it ended up, so a tap can be tested against it
    v.box = { cx: cx, cy: cy, w: d.w * k, h: d.h * k };

    ctx.save();
    ctx.globalAlpha = v.alpha;
    // everything - the startle, the distance, the mirroring - turns about the
    // creature's own middle, so it never slides while it reacts
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    var turn = this.turn(v);
    if (turn) ctx.rotate(turn);
    var sq = this.squash(v);
    if (sq) ctx.scale(1 + 0.2 * sq, 1 - 0.2 * sq);
    if (!v.right) ctx.scale(-1, 1);
    ctx.translate(-d.w / 2, -d.h / 2);
    d.draw(ctx, age, t);
    ctx.restore();
  };

  /* ------------------------------------------------------------ the poke

     A tap inside a creature's box startles it: it squashes, hops, and reels
     for about a second. A second tap in the same crossing sends it right
     round, landing the way up it started. The numbers are the app's, from
     VisitorLayer - a poked bird should behave the same in both places. */

  // How hard it is still reeling, 1 at the moment of the tap and gone within
  // about a second.
  Stage.prototype.startle = function (v) {
    if (v.poked === null) return 0;
    var p = this.clock - v.poked;
    return p > 1.4 ? 0 : Math.exp(-3.2 * p);
  };

  // Squash on the way in, stretch on the way out, settling as it calms.
  Stage.prototype.squash = function (v) {
    if (v.poked === null) return 0;
    return this.startle(v) * Math.sin((this.clock - v.poked) * 17);
  };

  // The hop the poke knocks it into, design px, up being negative.
  Stage.prototype.hop = function (v) {
    if (v.poked === null) return 0;
    return -26 * this.startle(v) * Math.sin((this.clock - v.poked) * 8.5);
  };

  // One poke sets it wobbling; a second sends it all the way round.
  Stage.prototype.turn = function (v) {
    if (v.poked === null) return 0;
    var p = this.clock - v.poked;
    if (v.pokes < 2) return 0.38 * this.startle(v) * Math.sin(p * 19);
    return 2 * Math.PI * (1 - Math.exp(-3.4 * p)) * (v.right ? 1 : -1);
  };

  /* A tap at (x, y) in DESIGN px - the same 420 x 746.67 space everything on
     these canvases is drawn in, since the context carries the scale. Returns
     what the poked creature sounds
     like, how far off it is and where it is across the field, so the caller
     can answer in sound and in the theme's own burst - or null if the tap
     landed on nothing.

     Only the creature's own box takes a tap, widened to something a finger
     can actually land on; everywhere else falls through to the game. */
  Stage.prototype.pokeAt = function (x, y) {
    var v = this.visitor;
    if (!v || !v.box) return null;
    var b = v.box;
    var grow = Math.max(0, (TOUCH - Math.min(b.w, b.h)) / 2);
    if (Math.abs(x - b.cx) > b.w / 2 + grow) return null;
    if (Math.abs(y - b.cy) > b.h / 2 + grow) return null;
    v.poked = this.clock;
    v.pokes++;
    return {
      voice: v.def.voice,
      depth: v.depth,
      // -1 at the left edge of the field, 1 at the right
      pan: W ? (b.cx / W) * 2 - 1 : 0,
      x: b.cx,
      y: b.cy
    };
  };

  Stage.prototype.frame = function (nowMs) {
    var ctx = this.bctx;
    this.clock = nowMs / 1000;
    ctx.clearRect(0, 0, W, H);
    var t = reduced ? 0.35 : (this.clock / 60) % 1;
    /* Light's drift is the stage's own 60-second turn, so it takes `t`; Day
       runs on a 120-second clock and Space on one of 40 and one of 3, so the
       seconds go with it and each world takes the turn it was drawn to. */
    this.theme.backdrop(ctx, t, this.px, this.clock);
    if (!reduced) {
      if (!this.visitor && this.clock >= this.nextVisit) this.callVisitor();
      this.drawVisitor(ctx);
    }
  };

  // ========================================================== thumbnails
  // 70 x 52, the picker's own box. Static, drawn once each.

  var previews = {
    // the grown-ups' two: what this page used to call Day and Night
    light: function (c, w, h) {
      var g = c.createRadialGradient(w * .5, -h * .12, 0, w * .5, -h * .12, w * 1.28);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.46, "#f3f7f7"); g.addColorStop(1, "#e9eff0");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      var a = c.createRadialGradient(w * .26, h * .22, 0, w * .26, h * .22, w * .5);
      a.addColorStop(0, "rgba(45,212,191,.22)"); a.addColorStop(1, "rgba(45,212,191,0)");
      c.fillStyle = a; c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(228,235,236,.98)";
      c.fillRect(0, h * .84, w, h);
      c.fillStyle = grad(c, 0, h * .84 - 3, 0, h * .84,
        [[0, "rgba(16,40,44,0)"], [1, "rgba(16,40,44,.08)"]]);
      c.fillRect(0, h * .84 - 3, w, 3);
      c.fillStyle = grad(c, 0, 0, w, 0, [[0, "rgba(251,113,133,.75)"],
        [.42, "rgba(16,40,44,.14)"], [.58, "rgba(16,40,44,.14)"], [1, "rgba(45,212,191,.75)"]]);
      c.fillRect(0, h * .84, w, 1);
      miniTile(c, w * .18, h * .40, w * .34, 12, 4, "#ffffff", "rgba(16,40,44,.3)", "rgba(16,40,44,.14)");
      miniTile(c, w * .56, h * .62, w * .30, 12, 4, "#cbf3e8", "rgba(31,181,158,.8)", "rgba(16,40,44,.12)");
    },
    /* The children's Day and Night, from the same two painters the app draws
       its picker cards with. Each works from its own constants rather than
       from the theme in force, so a locked card looks like its world whoever
       is looking at it. */
    day: function (c, w, h) {
      c.fillStyle = grad(c, 0, 0, 0, 52, D_SKY_STOPS);
      c.fillRect(0, 0, 70, 52);
      var sg = c.createRadialGradient(56, 11, 0, 56, 11, 12);
      sg.addColorStop(0, "rgba(255,209,102,.5)");
      sg.addColorStop(1, "rgba(255,209,102,0)");
      circle(c, 56, 11, 12, sg);
      circle(c, 56, 11, 6, D_SUN);
      cloudShape(c, 22, 12, 24, "rgba(255,255,255,.95)");
      c.beginPath();
      c.moveTo(0, 34);
      c.quadraticCurveTo(18, 24, 36, 32);
      c.quadraticCurveTo(54, 27, 70, 33);
      c.lineTo(70, 44); c.lineTo(0, 44); c.closePath();
      c.fillStyle = D_MID_HILL; c.fill();
      c.beginPath();
      c.moveTo(0, 40);
      c.quadraticCurveTo(20, 34, 40, 40);
      c.quadraticCurveTo(58, 37, 70, 41);
      c.lineTo(70, 52); c.lineTo(0, 52); c.closePath();
      c.fillStyle = D_NEAR_HILL; c.fill();
      c.fillStyle = D_GRASS_LOW;
      c.fillRect(0, 45, 70, 7);
      line(c, 0, 45, 70, 45, 1, D_GRASS_LIP, "butt");
      // the apple tree at the left
      line(c, 10, 46, 10, 34, 3, D_BARK);
      circle(c, 10, 29, 8, D_LEAF);
      circle(c, 7, 28, 1.4, D_RED);
      circle(c, 13, 31, 1.4, D_RED);
      // a sunflower at the right
      line(c, 62, 46, 62, 36, 1.5, D_LEAF_DEEP, "butt");
      sunflower(c, 62, 34, 4.5, 0);
      miniTile(c, 22, 30.5, 30, 11, 3.5, D_CREAM, D_LEAF_DEEP, "rgba(31,127,69,.4)");
    },
    night: function (c, w, h) {
      c.fillStyle = grad(c, 0, 0, 0, 52,
        [[0, "#141A4A"], [.42, "#232B6B"], [.74, "#3A3F86"], [1, "#6A4C8F"]]);
      c.fillRect(0, 0, 70, 52);
      var mg = c.createRadialGradient(54, 13, 0, 54, 13, 12);
      mg.addColorStop(0, "rgba(255,226,122,.45)");
      mg.addColorStop(1, "rgba(255,226,122,0)");
      circle(c, 54, 13, 12, mg);
      circle(c, 54, 13, 6, "#FFF3C4");
      var stars = [[8, 6], [20, 14], [36, 5], [30, 22], [62, 30]];
      for (var i = 0; i < stars.length; i++) {
        circle(c, stars[i][0], stars[i][1], .9, "rgba(255,248,225,.8)");
      }
      c.beginPath();
      c.moveTo(0, 34);
      c.quadraticCurveTo(18, 24, 36, 32);
      c.quadraticCurveTo(54, 26, 70, 33);
      c.lineTo(70, 44); c.lineTo(0, 44); c.closePath();
      c.fillStyle = "rgba(35,81,90,.9)"; c.fill();
      c.beginPath();
      c.moveTo(0, 40);
      c.quadraticCurveTo(20, 34, 40, 40);
      c.quadraticCurveTo(58, 37, 70, 41);
      c.lineTo(70, 52); c.lineTo(0, 52); c.closePath();
      c.fillStyle = "#1F5A47"; c.fill();
      c.fillStyle = "#1F4D3A";
      c.fillRect(0, 44, 70, 8);
      line(c, 0, 44, 70, 44, 1, "rgba(78,158,116,.8)", "butt");
      // the tent at the left, with its doorway
      poly(c, [[12, 30], [3, 45], [22, 45]], "#FFF3DF");
      poly(c, [[12, 34], [9, 45], [16, 45]], "#FB7185");
      // a firefly
      circle(c, 40, 27, 2.5, "rgba(216,242,122,.35)");
      circle(c, 40, 27, 1, "#D8F27A");
      miniTile(c, 22, 30.5, 30, 11, 3.5, "#FFF3DF", "#9A6A40", "rgba(14,17,48,.55)");
    },
    aquarium: function (c, w, h) {
      c.fillStyle = grad(c, 0, 0, 0, h, WATER);
      c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(221,243,250,0.9)";
      c.fillRect(0, 0, w, h * .13);
      line(c, 0, h * .13, w, h * .13, 1, "rgba(255,255,255,0.6)", "butt");
      var sandTop = h * .8;
      c.beginPath();
      c.moveTo(0, sandTop);
      for (var x = 0; x <= w; x += 3) c.lineTo(x, sandTop + 1.2 * Math.sin(2 * Math.PI * x / 22));
      c.lineTo(w, h); c.lineTo(0, h); c.closePath();
      c.fillStyle = grad(c, 0, sandTop, 0, h, [[0, "#f0d08a"], [1, "#d9b573"]]);
      c.fill();
      c.beginPath();
      c.moveTo(w * .9, sandTop + 1);
      c.quadraticCurveTo(w * .96, sandTop - 12, w * .88, sandTop - 22);
      c.lineWidth = 3; c.lineCap = "round"; c.strokeStyle = "rgba(30,122,107,0.55)"; c.stroke();
      var fx = w * .2, fy = h * .32;
      ellipse(c, fx, fy, 5.5, 3, "rgba(227,154,107,0.6)");
      poly(c, [[fx - 5, fy], [fx - 9, fy - 3], [fx - 9, fy + 3]], "rgba(227,154,107,0.6)");
      ring(c, w * .84, h * .62, 3, 1, "rgba(255,255,255,0.45)");
      ring(c, w * .78, h * .42, 2, 1, "rgba(255,255,255,0.45)");
      ring(c, w * .1, h * .6, 2.5, 1, "rgba(255,255,255,0.45)");
      miniTile(c, w * .5 - 17, h * .55 - 6, 34, 12, 4, "#fff7e6", "#1d5f8a", "rgba(14,76,110,0.35)", 2);
    },
    dark: function (c, w, h) {
      var g = c.createRadialGradient(w * .5, -h * .12, 0, w * .5, -h * .12, w * 1.28);
      g.addColorStop(0, "#10282C"); g.addColorStop(0.46, "#071619"); g.addColorStop(1, "#040C0F");
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      var a1 = c.createRadialGradient(w * .13, h * .06, 0, w * .13, h * .06, w * .56);
      a1.addColorStop(0, "rgba(45,212,191,.16)"); a1.addColorStop(1, "rgba(45,212,191,0)");
      c.fillStyle = a1; c.fillRect(0, 0, w, h);
      var a2 = c.createRadialGradient(w * .91, h * .75, 0, w * .91, h * .75, w * .62);
      a2.addColorStop(0, "rgba(28,143,135,.15)"); a2.addColorStop(1, "rgba(28,143,135,0)");
      c.fillStyle = a2; c.fillRect(0, 0, w, h);
      c.fillStyle = "rgba(3,10,13,.98)";
      c.fillRect(0, h * .84, w, h);
      c.fillStyle = grad(c, 0, 0, w, 0, [[0, "rgba(251,113,133,.75)"],
        [.42, "rgba(169,231,225,.16)"], [.58, "rgba(169,231,225,.16)"], [1, "rgba(45,212,191,.75)"]]);
      c.fillRect(0, h * .84, w, 1);
      miniTile(c, w * .18, h * .40, w * .34, 12, 4, "#21393F", "rgba(169,231,225,.30)", null);
      miniTile(c, w * .56, h * .62, w * .30, 12, 4, "#135A52", "rgba(94,234,212,.60)", null);
    },
    space: function (c, w, h) {
      c.fillStyle = grad(c, 0, 0, 0, h, [[0, "#4A3AA8"], [.35, "#3A2C86"], [.72, "#261F64"], [1, "#171340"]]);
      c.fillRect(0, 0, w, h);
      var g1 = c.createRadialGradient(w * .28, h * .30, 0, w * .28, h * .30, w * .55);
      g1.addColorStop(0, "rgba(255,127,176,.20)"); g1.addColorStop(1, "rgba(255,127,176,0)");
      c.fillStyle = g1; c.fillRect(0, 0, w, h);
      var g2 = c.createRadialGradient(w * .82, h * .75, 0, w * .82, h * .75, w * .5);
      g2.addColorStop(0, "rgba(95,214,214,.16)"); g2.addColorStop(1, "rgba(95,214,214,0)");
      c.fillStyle = g2; c.fillRect(0, 0, w, h);
      var stars = [[.10, .14, 1.1, .9], [.30, .08, .8, .7], [.50, .22, 1.1, .8],
                   [.90, .40, .8, .7], [.14, .48, .8, .6], [.74, .12, 1.1, .9],
                   [.42, .50, .8, .6], [.62, .36, .8, .5]];
      for (var i = 0; i < stars.length; i++) {
        circle(c, w * stars[i][0], h * stars[i][1], stars[i][2],
          "rgba(255,255,255," + stars[i][3] + ")");
      }
      // the four-point sparkle
      c.save();
      c.translate(w * .22, h * .30);
      c.scale(3.2, 3.2);
      c.beginPath();
      c.moveTo(0, -1);
      c.quadraticCurveTo(0, 0, 1, 0);
      c.quadraticCurveTo(0, 0, 0, 1);
      c.quadraticCurveTo(0, 0, -1, 0);
      c.quadraticCurveTo(0, 0, 0, -1);
      c.closePath();
      c.fillStyle = "rgba(255,255,255,.7)";
      c.fill();
      c.restore();
      circle(c, w * .80, h * .22, 6, "rgba(255,159,178,.85)");
      c.save();
      c.translate(w * .80, h * .22);
      c.rotate(-22 * Math.PI / 180);
      c.beginPath();
      c.ellipse(0, 0, 9.5, 2.5, 0, 0, Math.PI * 2);
      c.lineWidth = 1.3;
      c.strokeStyle = "rgba(255,255,255,.65)";
      c.stroke();
      c.restore();
      var top = h * .8;
      c.beginPath();
      c.moveTo(0, top + 1.5);
      c.quadraticCurveTo(w / 2, top - 1.5, w, top + 1.5);
      c.lineTo(w, h); c.lineTo(0, h); c.closePath();
      c.fillStyle = grad(c, 0, top, 0, h, [[0, "#D9D4F5"], [1, "#B9B1E6"]]);
      c.fill();
      c.beginPath();
      c.moveTo(0, top + 1.5);
      c.quadraticCurveTo(w / 2, top - 1.5, w, top + 1.5);
      c.lineWidth = 1.2; c.strokeStyle = "rgba(255,255,255,.6)"; c.stroke();
      ellipse(c, w * .30, h * .92, 4.5, 1.75, "rgba(166,158,214,.6)");
      miniTile(c, w * .14, h * .42, 30, 11, 3.5, "#FFFFFF", "#5A4FD6", "rgba(23,19,64,.45)");
      miniTile(c, w * .56, h * .62, 20, 9, 3.5, "#A6F0B8", "#2FA85A", "rgba(23,19,64,.45)");
    },
    castle: function (c, w, h) {
      c.fillStyle = grad(c, 0, 0, 0, h, [[0, "#FF9FCB"], [.30, "#FFC5DE"], [.55, "#FFD3E6"], [1, "#C6E8FB"]]);
      c.fillRect(0, 0, w, h);
      var sg = c.createRadialGradient(w * .78, h * .20, 0, w * .78, h * .20, h * .30);
      sg.addColorStop(0, "rgba(255,209,102,.5)"); sg.addColorStop(1, "rgba(255,209,102,0)");
      c.fillStyle = sg; c.fillRect(0, 0, w, h);
      circle(c, w * .78, h * .20, h * .13, "rgba(255,233,143,.6)");
      var bows = ["rgba(248,113,113,.3)", "rgba(251,191,36,.3)", "rgba(74,222,128,.3)", "rgba(96,165,250,.3)"];
      for (var i = 0; i < 4; i++) {
        c.beginPath();
        c.arc(w * .30, h * .90, h * .58 - i * 1.6, Math.PI, 0);
        c.lineWidth = 1.5; c.strokeStyle = bows[i]; c.stroke();
      }
      c.fillStyle = "rgba(255,247,251,.6)";
      c.beginPath(); rrect(c, w * .08, h * .225, w * .30, w * .09, w * .045); c.fill();
      circle(c, w * .23, h * .21, w * .081, "rgba(255,247,251,.6)");
      var ft = h * .84;
      c.fillStyle = "rgba(122,76,142,.38)";
      c.fillRect(w * .74, h * .50, w * .12, ft - h * .50);
      c.fillRect(w * .90, h * .58, w * .12, ft - h * .58);
      poly(c, [[w * .72, h * .50], [w * .88, h * .50], [w * .80, h * .34]], "rgba(122,76,142,.38)");
      poly(c, [[w * .88, h * .58], [w * 1.04, h * .58], [w * .96, h * .44]], "rgba(122,76,142,.38)");
      c.fillStyle = grad(c, 0, ft, 0, h, [[0, "#9A4478"], [1, "#6E2A56"]]);
      c.fillRect(0, ft + 2, w, h - ft);
      for (var x = 2; x < w; x += 9) c.fillRect(x, ft, 4.5, 3);
      c.beginPath();
      c.moveTo(0, h * .10);
      c.quadraticCurveTo(w * .25, h * .16, w * .5, h * .10);
      c.quadraticCurveTo(w * .75, h * .16, w, h * .10);
      c.lineWidth = 1; c.strokeStyle = "rgba(138,59,110,.6)"; c.stroke();
      var flags = ["rgba(255,143,184,.8)", "rgba(255,209,102,.8)", "rgba(155,227,255,.8)",
                   "rgba(255,143,184,.8)", "rgba(255,209,102,.8)"];
      for (var f = 0; f < 5; f++) {
        var fx2 = w * (.1 + .2 * f), fy2 = h * .12 + (f % 2 ? 1.5 : 0);
        poly(c, [[fx2 - 2, fy2], [fx2 + 2, fy2], [fx2, fy2 + 4]], flags[f]);
      }
      miniTile(c, w * .26, h * .46, 34, 12, 3.5, "#FFFDF7", "#8A3B6E", "rgba(138,59,110,.4)");
    },
    dino: function (c, w, h) {
      c.save();
      c.scale(w / 70, h / 52);
      c.fillStyle = grad(c, 0, 0, 0, 52, [[0, "#FFC58A"], [.5, "#FFD48A"], [1, "#FFE3A6"]]);
      c.fillRect(0, 0, 70, 52);
      var sg = c.createRadialGradient(52, 22, 0, 52, 22, 9);
      sg.addColorStop(0, "rgba(255,241,184,.7)"); sg.addColorStop(1, "rgba(255,241,184,0)");
      c.fillStyle = sg; c.fillRect(0, 0, 70, 52);
      c.fillStyle = "rgba(185,160,194,.55)";
      c.beginPath();
      c.moveTo(0, 32); c.quadraticCurveTo(18, 20, 36, 30);
      c.lineTo(50, 30); c.quadraticCurveTo(56, 22, 58, 14);
      c.lineTo(62, 14); c.quadraticCurveTo(64, 22, 70, 30);
      c.lineTo(70, 42); c.lineTo(0, 42); c.closePath(); c.fill();
      circle(c, 60, 14.5, 2, "#FF8C4B");
      c.fillStyle = "rgba(109,181,92,.7)";
      c.beginPath();
      c.moveTo(0, 36); c.quadraticCurveTo(15, 28, 35, 34);
      c.quadraticCurveTo(55, 30, 70, 35);
      c.lineTo(70, 44); c.lineTo(0, 44); c.closePath(); c.fill();
      c.fillStyle = "rgba(63,138,58,.6)";
      var lobes = [[5.92, 36.45, 2, 30, 2.08, 37.55], [8, 35, 6, 26, 4, 35], [10.4, 37.13, 11, 29, 6.6, 35.87]];
      for (var i = 0; i < lobes.length; i++) {
        var L = lobes[i];
        c.beginPath();
        c.moveTo(6, 44);
        c.quadraticCurveTo(L[0], L[1], L[2], L[3]);
        c.quadraticCurveTo(L[4], L[5], 6, 44);
        c.closePath(); c.fill();
      }
      line(c, 4, 47, 16, 28, 4, "#7CC47A");
      ellipse(c, 18, 27, 5, 3.5, "#7CC47A");
      circle(c, 20, 26, 1.2, "#2C3A1C");
      circle(c, 20.4, 25.6, 0.5, "#FFFFFF");
      ellipse(c, 58, 41, 3.5, 4.5, "#FFF3D6");
      c.fillStyle = "#9AD37A"; c.fillRect(0, 42, 70, 5);
      c.fillStyle = "#C8EC9A"; c.fillRect(0, 42, 70, 1);
      c.fillStyle = "#B07A48"; c.fillRect(0, 47, 70, 5);
      miniTile(c, 18, 30, 34, 12, 4, "#FFFBEE", "#2F5A1F", "rgba(47,90,31,.35)", 1.5, 1.5);
      c.restore();
    }
  };

  function miniTile(c, x, y, w, h, r, face, edge, shadow, drop, edgeW) {
    if (shadow) {
      c.fillStyle = shadow;
      c.beginPath(); rrect(c, x, y + (drop || 1.5), w, h, r); c.fill();
    }
    c.fillStyle = face;
    c.beginPath(); rrect(c, x, y, w, h, r); c.fill();
    if (edge) {
      c.lineWidth = edgeW || 1;
      c.strokeStyle = edge;
      c.beginPath(); rrect(c, x + 0.5, y + 0.5, w - 1, h - 1, r - 0.5); c.stroke();
    }
  }

  window.SYVT_SCENERY = {
    stage: function (back, front) { return new Stage(back, front); },
    /* The sounds this world's creatures can make, so the page can have them
       decoded before the first tap. A creature with no voice - the cloud -
       contributes nothing and answers a poke with its burst alone. */
    voicesOf: function (themeId) {
      var t = THEMES[themeId] || light;
      var out = [];
      for (var i = 0; i < t.visitors.length; i++) {
        var v = t.visitors[i].voice;
        if (v && out.indexOf(v) === -1) out.push(v);
      }
      return out;
    },
    preview: function (canvas, themeId, cssW, cssH) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      var c = canvas.getContext("2d");
      c.setTransform(canvas.width / 70, 0, 0, canvas.height / 52, 0, 0);
      (previews[themeId] || previews.light)(c, 70, 52);
    },
    reduced: reduced
  };
})();
