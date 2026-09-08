/* The two worlds the free game plays in, drawn the way the Android game
   draws them, plus a thumbnail for all six.

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
  function offscreen(w, h) {
    var c = document.createElement("canvas");
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  }

  // =================================================================== DAY
  // Day's static scenery is CSS (aurora, dots, ceiling line, vignette); only
  // the ground and the visitors are drawn here.

  var day = {
    id: "day",

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

  var WATER = [[0, "#9fe9f5"], [0.38, "#4fc4e3"], [0.78, "#2593c4"], [1, "#1b6fa3"]];
  var INK = "rgba(18,52,77,0.558)";

  function aquaRamp(ctx, colour, top, bottom) {
    if (bottom - top < 5) return colour;
    var g = ctx.createLinearGradient(0, top, 0, bottom);
    g.addColorStop(0, mix(colour, "#ffffff", 0.20));
    g.addColorStop(0.52, colour);
    g.addColorStop(1, mix(colour, "#12344d", 0.26));
    return g;
  }
  function eye(ctx, cx, cy, r) {
    circle(ctx, cx, cy, r, "#ffffff");
    circle(ctx, cx + 0.15 * r, cy + 0.12 * r, 0.52 * r, INK);
    circle(ctx, cx - 0.28 * r, cy - 0.3 * r, 0.2 * r, "#ffffff");
  }

  var aquarium = {
    id: "aquarium",
    baked: null,
    ray: null,

    bake: function (px) {
      // the still parts of the water, baked once: two blurred reef mounds
      // are the only expensive thing in the whole scene
      var c = offscreen(W * px, H * px), x = c.getContext("2d");
      x.scale(px, px);
      x.fillStyle = grad(x, 0, 0, 0, H, WATER);
      x.fillRect(0, 0, W, H);
      var sun = x.createRadialGradient(126, -74.667, 0, 126, -74.667, 378);
      sun.addColorStop(0, "rgba(255,255,255,0.28)");
      sun.addColorStop(0.7, "rgba(255,255,255,0)");
      x.fillStyle = sun;
      x.fillRect(0, 0, W, H);
      if (x.filter !== undefined) x.filter = "blur(16px)";
      ellipse(x, 66, 686.667, 90, 46, "rgba(27,111,163,0.45)");
      ellipse(x, 356, 690.667, 78, 40, "rgba(27,111,163,0.45)");
      if (x.filter !== undefined) x.filter = "none";
      x.fillStyle = "rgba(221,243,250,0.9)";
      x.fillRect(0, 0, W, CEIL);
      this.baked = c;

      // one light ray, blurred once and blitted four times
      var r = offscreen(220 * px, 480 * px), y = r.getContext("2d");
      y.scale(px, px);
      if (y.filter !== undefined) y.filter = "blur(14px)";
      y.fillStyle = grad(y, 0, 24, 0, 456,
        [[0, "#ffffff"], [1, "rgba(255,255,255,0)"]]);
      poly(y, [[64, 24], [112, 24], [196, 456], [92, 456]], y.fillStyle);
      this.ray = r;
    },

    ground: function (ctx) {
      // the strip is 52 tall: 46 of sand plus a 6 px crest above it
      var top = H - 52;
      ctx.save();
      ctx.translate(0, top);
      function crest(t, amp, lam) {
        var pts = [];
        for (var x = -4; x <= 424; x += 5) pts.push([x, t + amp * Math.sin(2 * Math.PI * x / lam)]);
        return pts;
      }
      function path(pts) {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      }
      var body = crest(7, 2.5, 70);
      path(body);
      ctx.lineTo(424, 56);
      ctx.lineTo(-4, 56);
      ctx.closePath();
      ctx.fillStyle = grad(ctx, 0, 6, 0, 52, [[0, "#f0d08a"], [1, "#d9b573"]]);
      ctx.fill();
      ctx.save();
      ctx.clip();
      path(crest(11, 2.5, 70));
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(201,154,85,0.35)";
      ctx.stroke();
      ctx.restore();
      path(body);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff3cf";
      ctx.stroke();

      var pebbles = [[22, 42, 6, 3.5], [96, 46, 4.5, 2.5], [178, 44, 7, 4.5],
                     [262, 47, 4, 2.5], [398, 43, 5.5, 3]];
      for (var i = 0; i < pebbles.length; i++) {
        ellipse(ctx, pebbles[i][0], pebbles[i][1], pebbles[i][2], pebbles[i][3],
          "rgba(201,154,85,0.45)");
      }
      var shells = [[58, 46], [336, 47]];
      for (var s = 0; s < shells.length; s++) {
        var sx = shells[s][0], sy = shells[s][1];
        ctx.beginPath();
        ctx.arc(sx, sy, 7, Math.PI, 0);
        ctx.closePath();
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        ctx.fill();
        for (var a = 0; a < 3; a++) {
          var ang = (225 + a * 45) * Math.PI / 180;
          line(ctx, sx, sy, sx + Math.cos(ang) * 6.5, sy + Math.sin(ang) * 6.5,
            1, "rgba(201,154,85,0.5)");
        }
      }
      var star = [];
      for (var k = 0; k < 10; k++) {
        var ang2 = (-90 + k * 36) * Math.PI / 180;
        var rad = k % 2 === 0 ? 8 : 3.6;
        star.push([300 + Math.cos(ang2) * rad, 42 + Math.sin(ang2) * rad]);
      }
      poly(ctx, star, "rgba(255,159,67,0.75)");
      ctx.restore();
    },

    backdrop: function (ctx, t, px) {
      if (!this.baked) this.bake(px);
      ctx.drawImage(this.baked, 0, 0, W, H);

      // four light rays, swaying
      var rays = [[36, 150, 0.07], [128, 190, 0.05], [226, 165, 0.06], [322, 205, 0.04]];
      for (var i = 0; i < rays.length; i++) {
        var x = rays[i][0] + 18 * wave(t, 16, i * 0.25);
        var a = clamp(rays[i][2] + 0.015 * wave(t, 4, i * 0.3), 0, 1);
        ctx.globalAlpha = a;
        ctx.drawImage(this.ray, x, 44, rays[i][1], 470);
      }
      ctx.globalAlpha = 1;

      // the far school: the only moving thing allowed in the fall lane
      for (var f = 0; f < 8; f++) {
        var off = 140 + f * 14 + 10 * noise(f, 1);
        var fx = ((t * 480 + off) % 480) - 30;
        var fy = 313.6 + (f % 3 - 1) * 18 + 12 * noise(f, 2) + 3 * wave(t, 12, f * 0.2);
        ellipse(ctx, fx, fy, 4, 2, "rgba(190,233,255,0.25)");
      }

      // three fish in their lanes
      var lanes = [[150, 2, 1, "rgba(227,154,107,0.5)", 0],
                   [330, 2, -1, "rgba(201,167,224,0.5)", 324],
                   [470, 1, 1, "rgba(143,214,234,0.5)", 462]];
      for (var l = 0; l < lanes.length; l++) {
        var travel = ((t * lanes[l][1] * 480 + lanes[l][4]) % 480) - 30;
        var dir = lanes[l][2];
        var bx = dir > 0 ? travel : 450 - travel;
        var by = lanes[l][0] + 6 * wave(t, 12, l * 0.33);
        var wag = 3 * wave(t, 120, l * 0.5);
        var col = lanes[l][3];
        ellipse(ctx, bx, by, 13, 7, col);
        poly(ctx, [[bx - dir * 11, by], [bx - dir * 20, by - 6 + wag],
                   [bx - dir * 20, by + 6 + wag]], col);
        circle(ctx, bx + dir * 7, by - 2, 2, "rgba(255,255,255,0.7)");
        circle(ctx, bx + dir * 7.5, by - 2, 1.1, "rgba(18,52,77,0.6)");
      }

      // seaweed, rooted under the sand's crest
      var weeds = [[28, 120, 12, "rgba(30,122,107,0.55)"],
                   [64, 92, 10, "rgba(44,156,122,0.45)"],
                   [352, 150, 14, "rgba(30,122,107,0.55)"],
                   [384, 104, 10, "rgba(44,156,122,0.45)"],
                   [408, 132, 12, "rgba(30,122,107,0.55)"]];
      for (var wI = 0; wI < weeds.length; wI++) {
        var wx = weeds[wI][0], hgt = weeds[wI][1];
        var sway = 14 * wave(t, 16, wI * 0.17);
        ctx.beginPath();
        ctx.moveTo(wx, 704.667);
        ctx.quadraticCurveTo(wx + sway * 0.5 + (wI % 2 === 0 ? 8 : -8),
          FLOOR_TOP - hgt * 0.55, wx + sway, FLOOR_TOP - hgt);
        ctx.lineWidth = weeds[wI][2];
        ctx.lineCap = "round";
        ctx.strokeStyle = weeds[wI][3];
        ctx.stroke();
      }

      if (!reduced) {
        // far bubbles
        for (var b = 0; b < 18; b++) {
          var bf = (t + noise(b, 3)) % 1;
          var byy = 754.667 - bf * 704.667;
          var bxx = bubbleX(b, 4, true) + 6 * wave(t, 20, noise(b, 6));
          var br = 3 + 4 * noise(b, 5);
          var ba = 0.14 + 0.08 * noise(b, 7);
          if (bf > 0.92) ba *= (1 - bf) / 0.08;
          if (b % 3 === 2) ba *= 0.5;
          ring(ctx, bxx, byy, br, 1.5, "rgba(255,255,255," + ba + ")");
        }
        // near bubbles, at the edges only
        for (var n = 0; n < 8; n++) {
          var nf = (t * 2 + noise(n, 8)) % 1;
          var ny = 762.667 - nf * 696.667;
          var nx = bubbleX(n, 9, false) + 10 * wave(t, 20, noise(n, 10));
          var nr = 8 + 6 * noise(n, 11), k = 1;
          if (nf > 0.95) { var pop = (nf - 0.95) / 0.05; nr *= 1 + 0.3 * pop; k = 1 - pop; }
          circle(ctx, nx, ny, nr, "rgba(255,255,255," + (0.06 * k) + ")");
          ring(ctx, nx, ny, nr, 2, "rgba(255,255,255," + (0.28 * k) + ")");
          circle(ctx, nx - 0.4 * nr, ny - 0.4 * nr, 2, "rgba(255,255,255," + (0.6 * k) + ")");
        }
      }

      // the water line, last
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(0, 57, W, 6);
      ctx.beginPath();
      for (var rx = -6; rx <= 426; rx += 6) {
        var ry = CEIL + 2 * Math.sin(2 * Math.PI * (rx + t * 1200) / 60);
        if (rx === -6) ctx.moveTo(rx, ry); else ctx.lineTo(rx, ry);
      }
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.stroke();
    },

    puff: "bubbles",
    puffColour: "rgba(255,255,255,.8)",

    visitors: [
      {
        name: "school", voice: "pop", w: 120, h: 60, band: [0.10, 0.50], secs: 8, bob: 6,
        weight: 1.5, shadow: 0.13,
        draw: function (ctx, phase) {
          var at = [[104, 30], [82, 14], [80, 46], [58, 28], [34, 38]];
          for (var i = 0; i < at.length; i++) {
            var cx = at[i][0], cy = at[i][1] + Math.sin(phase * 5 + i * 1.1) * 2.5;
            var wag = Math.sin(phase * 9 + i * 0.8) * 2;
            poly(ctx, [[cx - 6, cy], [cx - 13, cy - 4 + wag], [cx - 13, cy + 4 + wag]], "#bee9ff");
            ellipse(ctx, cx, cy, 9, 4.5, aquaRamp(ctx, "#e6f4fb", cy - 4.5, cy + 4.5));
            line(ctx, cx - 6, cy - 2.2, cx + 5, cy - 2.2, 2, "#8fd6ea");
            circle(ctx, cx + 5.5, cy - 0.6, 1.1, INK);
          }
        }
      },
      {
        name: "clownfish", voice: "warble", w: 70, h: 44, band: [0.15, 0.60], secs: 9, bob: 6,
        weight: 1.0, shadow: 0.13,
        draw: function (ctx, phase) {
          var wag = Math.sin(phase * 7) * 3, flap = Math.sin(phase * 7 + 1.2) * 2;
          ctx.fillStyle = "#ffb765";
          ctx.beginPath();
          ctx.moveTo(19, 22); ctx.lineTo(3, 9 + wag);
          ctx.quadraticCurveTo(11, 22 + wag * 0.5, 3, 35 + wag);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(27, 12); ctx.quadraticCurveTo(38, -3 + wag * 0.3, 51, 11);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(29, 33); ctx.quadraticCurveTo(35, 45, 45, 34);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(65, 22);
          ctx.bezierCurveTo(65, 11, 53, 6, 40, 7);
          ctx.bezierCurveTo(26, 8, 17, 14, 17, 22);
          ctx.bezierCurveTo(17, 30, 26, 36, 40, 37);
          ctx.bezierCurveTo(53, 38, 65, 33, 65, 22);
          ctx.closePath();
          ctx.fillStyle = aquaRamp(ctx, "#ff9f43", 6, 38);
          ctx.fill();
          ctx.save();
          ctx.clip();
          var bands = [[21, 4], [35, 6], [47, 5]];
          for (var i = 0; i < bands.length; i++) {
            for (var pass = 0; pass < 2; pass++) {
              ctx.beginPath();
              ctx.moveTo(bands[i][0] + 1, 4);
              ctx.quadraticCurveTo(bands[i][0] - 3, 22, bands[i][0] + 1, 40);
              ctx.lineWidth = pass === 0 ? bands[i][1] + 2.5 : bands[i][1];
              ctx.strokeStyle = pass === 0 ? "#d9731f" : "#ffffff";
              ctx.stroke();
            }
          }
          ctx.restore();
          ctx.fillStyle = "#ffb765";
          ctx.beginPath();
          ctx.moveTo(48, 24);
          ctx.quadraticCurveTo(38, 27 + flap, 37, 34 + flap);
          ctx.quadraticCurveTo(44, 33 + flap, 49, 29);
          ctx.closePath(); ctx.fill();
          eye(ctx, 57, 17, 3.6);
          ctx.beginPath();
          ctx.moveTo(59, 27); ctx.quadraticCurveTo(62, 29.5, 64.5, 27);
          ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
        }
      },
      {
        name: "tang", voice: "warble", w: 80, h: 50, band: [0.20, 0.65], secs: 11, bob: 6,
        weight: 1.0, shadow: 0.13,
        draw: function (ctx, phase) {
          var wag = Math.sin(phase * 6) * 3, flap = Math.sin(phase * 6 + 1) * 1.5;
          ctx.fillStyle = "#ffb703";
          ctx.beginPath();
          ctx.moveTo(20, 25); ctx.lineTo(3, 11 + wag);
          ctx.quadraticCurveTo(11, 25 + wag * 0.5, 3, 39 + wag);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = "#2d63cf";
          ctx.beginPath();
          ctx.moveTo(22, 15); ctx.quadraticCurveTo(42, -6, 64, 13);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(24, 36); ctx.quadraticCurveTo(42, 56, 62, 38);
          ctx.closePath(); ctx.fill();
          ctx.beginPath();
          ctx.moveTo(71, 26);
          ctx.bezierCurveTo(71, 15, 59, 9, 45, 9);
          ctx.bezierCurveTo(29, 9, 17, 16, 17, 26);
          ctx.bezierCurveTo(17, 36, 29, 43, 45, 43);
          ctx.bezierCurveTo(59, 43, 71, 37, 71, 26);
          ctx.closePath();
          ctx.fillStyle = aquaRamp(ctx, "#3f7ff0", 9, 43);
          ctx.fill();
          ctx.save();
          ctx.clip();
          ctx.beginPath();
          ctx.moveTo(56, 16);
          ctx.quadraticCurveTo(30, 10, 23, 26);
          ctx.quadraticCurveTo(30, 42, 54, 36);
          ctx.lineWidth = 5; ctx.strokeStyle = "rgba(18,52,77,0.70)"; ctx.stroke();
          ellipse(ctx, 50, 39, 18, 8, "rgba(143,214,234,0.549)");
          ctx.restore();
          ctx.fillStyle = "#ffb703";
          ctx.beginPath();
          ctx.moveTo(51, 27);
          ctx.quadraticCurveTo(41, 30 + flap, 40, 37 + flap);
          ctx.quadraticCurveTo(47, 36 + flap, 52, 31);
          ctx.closePath(); ctx.fill();
          eye(ctx, 61, 21, 4);
          ctx.beginPath();
          ctx.moveTo(64, 31); ctx.quadraticCurveTo(66.5, 33.5, 69, 31);
          ctx.lineWidth = 1.6; ctx.strokeStyle = INK; ctx.stroke();
        }
      },
      {
        name: "jelly", voice: "hum", w: 64, h: 90, band: [0.05, 0.40], secs: 16, bob: 14,
        weight: 0.8, shadow: 0.13,
        draw: function (ctx, phase) {
          var pulse = Math.sin(phase * 2.4);
          for (var i = 0; i < 4; i++) {
            var x0 = 20 + 8 * i, y0 = 30;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            for (var k = 0; k < 3; k++) {
              ctx.quadraticCurveTo(
                x0 + Math.sin(phase * 3 + i * 0.9 + k * 1.7) * 4, y0 + 9 + k * 18,
                x0 - 3 * (k + 1), y0 + 18 + k * 18);
            }
            ctx.lineWidth = 2.4;
            ctx.strokeStyle = "rgba(232,121,181,0.851)";
            ctx.stroke();
          }
          for (var a = 0; a < 2; a++) {
            var ax = a === 0 ? 27 : 37;
            ctx.beginPath();
            ctx.moveTo(ax, 30);
            ctx.quadraticCurveTo(ax + Math.sin(phase * 2.6 + a * 1.3) * 3, 42, ax - 2, 54);
            ctx.lineWidth = 4;
            ctx.strokeStyle = "rgba(255,201,228,0.702)";
            ctx.stroke();
          }
          ctx.save();
          ctx.translate(32, 30);
          ctx.scale(1 + 0.06 * pulse, 1 - 0.05 * pulse);
          ctx.translate(-32, -30);
          ctx.beginPath();
          ctx.moveTo(10, 30);
          ctx.bezierCurveTo(10, 15, 20, 6, 32, 6);
          ctx.bezierCurveTo(44, 6, 54, 15, 54, 30);
          ctx.quadraticCurveTo(48.5, 26, 43, 30);
          ctx.quadraticCurveTo(37.5, 26, 32, 30);
          ctx.quadraticCurveTo(26.5, 26, 21, 30);
          ctx.quadraticCurveTo(15.5, 26, 10, 30);
          ctx.closePath();
          ctx.fillStyle = "rgba(255,158,200,0.62)";
          ctx.fill();
          ellipse(ctx, 26, 15, 7, 4, "rgba(255,255,255,0.349)");
          circle(ctx, 25, 22, 1.6, "rgba(232,121,181,0.502)");
          circle(ctx, 33, 17, 1.6, "rgba(232,121,181,0.502)");
          circle(ctx, 41, 22, 1.6, "rgba(232,121,181,0.502)");
          ctx.restore();
        }
      }
    ]
  };

  function bubbleX(i, salt, laneAllowed) {
    var n = noise(i, salt);
    if (laneAllowed && i % 3 === 2) return 130 + n * 160;
    return (i % 2 === 0) ? 12 + n * 100 : 308 + n * 100;
  }

  var THEMES = { day: day, aquarium: aquarium };

  // ============================================================ the stage

  function Stage(back, front) {
    this.back = back;
    this.front = front;
    this.bctx = back.getContext("2d");
    this.fctx = front.getContext("2d");
    this.theme = day;
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
    // the baked water is resolution-dependent
    aquarium.baked = null;
    this.drawGround();
  };

  Stage.prototype.setTheme = function (id) {
    this.theme = THEMES[id] || day;
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
      y: lerp(pick.band[0], pick.band[1], Math.random()) * FLOOR_TOP,
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
    d.draw(ctx, age);
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
    this.theme.backdrop(ctx, t, this.px);
    if (!reduced) {
      if (!this.visitor && this.clock >= this.nextVisit) this.callVisitor();
      this.drawVisitor(ctx);
    }
  };

  // ========================================================== thumbnails
  // 70 x 52, the picker's own box. Static, drawn once each.

  var previews = {
    day: function (c, w, h) {
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
    night: function (c, w, h) {
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
      var t = THEMES[themeId] || day;
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
      (previews[themeId] || previews.day)(c, 70, 52);
    },
    reduced: reduced
  };
})();
