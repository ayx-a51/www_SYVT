/* SYVT on the web: the Android game's free tier, rule for rule.

   Everything the app's free player gets is here — the two open worlds, all
   three languages, levels 1 to 5, the same words, the same sums, the same
   fall speeds. Where the app would sell SYVT+, this asks the player to go to
   the Play Store instead: a locked world, or the end of level 5.

   The physics runs in screen px (design px × S) so a body's position is the
   tile's position; the stylesheet gets the same S, so what is drawn and what
   is simulated cannot drift apart. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var gameEl = $("game");
  var field = $("field");
  var scoreEl = $("score"), scoreKicker = $("scoreKicker");
  var levelLabel = $("levelLabel"), levelFill = $("levelFill");
  var pauseBtn = $("pauseBtn");
  var dangerEl = $("danger");
  var levelUpEl = $("levelUp"), levelUpLabel = $("levelUpLabel");
  var flashEl = $("flash");
  var pauseVeil = $("pauseVeil"), pauseTitle = $("pauseTitle");
  var resumeBtn = $("resumeBtn"), quitBtn = $("quitBtn");
  var overlay = $("overlay");
  var taglineEl = $("tagline"), overTitle = $("overTitle"), overStats = $("overStats");
  var statScore = $("statScore"), statScoreLbl = $("statScoreLbl");
  var statBest = $("statBest"), statBestLbl = $("statBestLbl"), bestStat = $("bestStat");
  var picker = $("themePicker"), langRow = $("langRow");
  var startBtn = $("startBtn"), legendText = $("legendText");
  var storeLinkLabel = $("storeLinkLabel");
  var modal = $("modal"), modalTitle = $("modalTitle"), modalBody = $("modalBody");
  var modalBuy = $("modalBuy"), modalKeep = $("modalKeep");

  var Engine = Matter.Engine, Bodies = Matter.Bodies, Body = Matter.Body,
      Composite = Matter.Composite, Events = Matter.Events;

  var WORDS = window.SYVT_WORDS;

  // ------------------------------------------------------------- strings

  var I18N = {
    en: {
      tagline: "Words fall from the sky. Swipe right if a word is spelled correctly — left if it’s misspelled.",
      legend: "Be quick — be sure. Wrong swipes hit the wall and pile up.\nWhen the stack reaches the top, the game ends.",
      hintLeft: "misspelled", hintRight: "correctly spelled",
      level: "Level", start: "Start", again: "Play again",
      over: "Stack Overflow", scoreLbl: "Score", bestLbl: "Best",
      paused: "Paused", resume: "Continue", quit: "End round", pauseAction: "Pause",
      store: "SYVT+ on Google Play",
      buy: "Get SYVT+", notNow: "Not now", keepPlaying: "Keep playing",
      capTitle: "Level 5 reached!",
      capBody: "That is the last level of the free game. With SYVT+ on Android the words go on to level 10 — or keep playing here for as long as you like.",
      lockTitle: "A SYVT+ world",
      lockBody: "This world is part of SYVT+. Six worlds and ten levels — in the Android app."
    },
    de: {
      tagline: "Wörter fallen vom Himmel. Wische nach rechts, wenn ein Wort richtig geschrieben ist — nach links, wenn es falsch ist.",
      legend: "Sei schnell — sei sicher. Falsche Wischer prallen an die Wand und stapeln sich.\nErreicht der Stapel die Decke, ist das Spiel vorbei.",
      hintLeft: "falsch geschrieben", hintRight: "richtig geschrieben",
      level: "Stufe", start: "Los", again: "Nochmal",
      over: "Stack Overflow", scoreLbl: "Punkte", bestLbl: "Rekord",
      paused: "Pausiert", resume: "Weiter", quit: "Runde beenden", pauseAction: "Pause",
      store: "SYVT+ bei Google Play",
      buy: "SYVT+ holen", notNow: "Nicht jetzt", keepPlaying: "Weiterspielen",
      capTitle: "Level 5 geschafft!",
      capBody: "Das ist das letzte Level der Gratis-Version. Mit SYVT+ für Android geht es weiter bis Level 10 — oder du spielst hier weiter, so lange du magst.",
      lockTitle: "Eine SYVT+ Welt",
      lockBody: "Diese Welt gehört zu SYVT+. Sechs Welten und zehn Level — in der Android-App."
    },
    fr: {
      tagline: "Des mots tombent du ciel. Glisse à droite si un mot est bien orthographié — à gauche s’il est mal écrit.",
      legend: "Sois rapide — sois sûr. Les mauvais choix heurtent le mur et s’empilent.\nQuand la pile atteint le haut, la partie est finie.",
      hintLeft: "mal orthographié", hintRight: "bien orthographié",
      level: "Niveau", start: "Démarrer", again: "Rejouer",
      over: "Stack Overflow", scoreLbl: "Score", bestLbl: "Record",
      paused: "En pause", resume: "Continuer", quit: "Terminer la partie", pauseAction: "Pause",
      store: "SYVT+ sur Google Play",
      buy: "Passer à SYVT+", notNow: "Pas maintenant", keepPlaying: "Continuer à jouer",
      capTitle: "Niveau 5 atteint !",
      capBody: "C’est le dernier niveau de la version gratuite. Avec SYVT+ sur Android les mots continuent jusqu’au niveau 10 — ou reste ici aussi longtemps que tu veux.",
      lockTitle: "Un monde SYVT+",
      lockBody: "Ce monde fait partie de SYVT+. Six mondes et dix niveaux — dans l’app Android."
    }
  };

  // the app's picker order; the first two are what the free game opens
  var WORLDS = [
    { id: "night",    free: false, names: { en: "Night", de: "Nacht", fr: "Nuit" } },
    { id: "day",      free: true,  names: { en: "Day", de: "Tag", fr: "Jour" } },
    { id: "aquarium", free: true,  names: { en: "Aquarium", de: "Aquarium", fr: "Aquarium" } },
    { id: "space",    free: false, names: { en: "Space", de: "Weltall", fr: "Espace" } },
    { id: "castle",   free: false, names: { en: "Princess Castle", de: "Schloss", fr: "Château" } },
    { id: "dino",     free: false, names: { en: "Dinosaurs", de: "Dinos", fr: "Dinos" } }
  ];

  // an explicit allowlist, not a property lookup: "__proto__" would pass a
  // truthy check on any object and then crash the round
  var LANGS = ["en", "de", "fr"];
  var STORE = "syvt.";

  var lang = localStorage.getItem(STORE + "lang");
  if (LANGS.indexOf(lang) === -1) lang = "en";

  var themeId = localStorage.getItem(STORE + "theme");
  if (themeId !== "day" && themeId !== "aquarium") themeId = "day";

  // ------------------------------------------------------------ the rules

  var SWIPE_THRESHOLD = 30;      // design px of drag before a release counts
  var FLY_SPEED = 1400;          // design px/s for a swiped tile
  var BASE_FALL_VY = 55;
  var FALL_PER_TIER = 14;
  var STEP_MS = 1000 / 60;
  var PX_PER_STEP = STEP_MS / 1000;
  var GAMEOVER_HOLD = 0.5;
  var PER_LEVEL = 30;            // the app's kPerLevel
  var FREE_MAX_TIER = 4;         // level 5 is the last free one
  var RECENT_LIMIT = 10;
  var MATH_SHARE = 0.20;
  var BASE_W = 420;

  var CAT_WORLD = 0x0001, CAT_FALLING = 0x0002, CAT_SETTLED = 0x0004, CAT_FLYING = 0x0008;
  var MASK_FALLING = CAT_WORLD | CAT_FALLING | CAT_SETTLED;
  var MASK_ALL = CAT_WORLD | CAT_FALLING | CAT_SETTLED | CAT_FLYING;
  var MASK_FLYING = CAT_WORLD | CAT_SETTLED | CAT_FLYING;

  var engine = Engine.create({ enableSleeping: true });
  var walls = [];

  var S = 1, fieldWidth = 0, fieldHeight = 0, floorY = 0, ceilingY = 0;
  var blocks = [];
  var score = 0;
  var best = +(localStorage.getItem(STORE + "best." + lang) || 0);
  var running = false, paused = false, capShown = false;
  var lastTime = 0, spawnTimer = 0, stepAcc = 0;
  var activeDrag = null;
  var shownTier = 0;
  var recent = [];

  var stage = window.SYVT_SCENERY.stage($("sceneBack"), $("sceneFront"));

  function t() { return I18N[lang]; }

  // --------------------------------------------------------- measurement

  function measureField() {
    fieldWidth = gameEl.clientWidth;
    fieldHeight = gameEl.clientHeight;
    S = fieldWidth / BASE_W;
    document.documentElement.style.setProperty("--s", S + "px");
    // gravity is an acceleration in px/step², so it scales too: without this
    // a tumble would flatten out on a larger field
    engine.gravity.scale = 0.001 * S;
    floorY = fieldHeight - 46 * S;
    ceilingY = 56 * S;
    stage.resize(fieldWidth, fieldHeight);
  }

  function buildWalls() {
    if (walls.length) Composite.remove(engine.world, walls);
    var T = 400;   // fat, so a 1400 px/s tile cannot tunnel through
    var side = { isStatic: true, friction: 0.1, restitution: 0.4 };
    walls = [
      Bodies.rectangle(fieldWidth / 2, floorY + T / 2, fieldWidth + 2 * T, T,
        { isStatic: true, friction: 0.6, restitution: 0.2 }),
      Bodies.rectangle(-T / 2, 0, T, fieldHeight * 6, side),
      Bodies.rectangle(fieldWidth + T / 2, 0, T, fieldHeight * 6, side)
    ];
    walls[1].plugin.isSideWall = true;
    walls[2].plugin.isSideWall = true;
    Composite.add(engine.world, walls);
  }

  // ------------------------------------------------------- level and pace

  // the raw tier is what the score has actually earned; `tier` is what the
  // free game will play. They part company at score 150, which is where the
  // offer comes up.
  function rawTier() { return Math.min(Math.floor(score / PER_LEVEL), 9); }
  function tier() { return Math.min(rawTier(), FREE_MAX_TIER); }

  function fallSpeed() { return (BASE_FALL_VY + tier() * FALL_PER_TIER) * S; }
  function spawnInterval() { return Math.max(0.95, 2.3 - tier() * 0.27); }

  // ------------------------------------------------------- what falls next

  function remember(key) {
    recent.push(key);
    if (recent.length > RECENT_LIMIT) recent.shift();
  }

  function pickEntry() {
    var levels = WORDS[lang], top = tier();
    var pool = [];
    for (var i = Math.max(0, top - 2); i <= top; i++) pool = pool.concat(levels[i]);
    var e = pool[(Math.random() * pool.length) | 0];
    for (var k = 0; k < 14 && recent.indexOf(e[0]) !== -1; k++) {
      e = pool[(Math.random() * pool.length) | 0];
    }
    remember(e[0]);
    return e;
  }

  function rint(lo, hi) { return lo + ((Math.random() * (hi - lo + 1)) | 0); }

  /* The sums track the words in kind as well as in difficulty: every one is
     a fact you either hold or you don't, never one you have to work out.
     There is barely one spawn interval to answer. */
  var TIER_EQ = [
    function () {                                   // level 1 — bonds within ten
      if (Math.random() < 0.55) {
        var a = rint(1, 8), b = rint(1, 9 - a);
        return { expr: a + "+" + b, value: a + b };
      }
      var c = rint(3, 10), d = rint(1, c - 1);
      return { expr: c + "−" + d, value: c - d };
    },
    function () {                                   // level 2 — within twenty
      var r = Math.random(), a, b;
      if (r < 0.35) { a = rint(2, 12); b = rint(2, 20 - a); return { expr: a + "+" + b, value: a + b }; }
      if (r < 0.65) { a = rint(6, 20); b = rint(2, a - 2); return { expr: a + "−" + b, value: a - b }; }
      a = rint(2, 10); b = [2, 5, 10][rint(0, 2)];
      return { expr: a + "×" + b, value: a * b };
    },
    function () {                                   // level 3 — round numbers
      var r = Math.random(), a, b, q;
      if (r < 0.2) { a = rint(2, 8) * 10; b = rint(1, 9) * 5; return { expr: a + "+" + b, value: a + b }; }
      if (r < 0.4) { a = rint(4, 10) * 10; b = rint(1, 7) * 5; return { expr: a + "−" + b, value: a - b }; }
      if (r < 0.8) { a = rint(2, 10); b = rint(2, 5); return { expr: a + "×" + b, value: a * b }; }
      b = rint(2, 5); q = rint(2, 10);
      return { expr: (q * b) + "÷" + b, value: q };
    },
    function () {                                   // level 4 — the whole table
      var r = Math.random(), a, b, q;
      if (r < 0.5) { a = rint(2, 10); b = rint(2, 10); return { expr: a + "×" + b, value: a * b }; }
      if (r < 0.8) { b = rint(2, 10); q = rint(2, 10); return { expr: (q * b) + "÷" + b, value: q }; }
      a = rint(2, 10);
      return { expr: a + "²", value: a * a };
    },
    function () {                                   // level 5 — out to twelve
      var r = Math.random(), a, b, q;
      if (r < 0.4) { a = rint(3, 12); b = rint(6, 12); return { expr: a + "×" + b, value: a * b }; }
      if (r < 0.7) { b = rint(3, 12); q = rint(3, 12); return { expr: (q * b) + "÷" + b, value: q }; }
      if (r < 0.85) { a = rint(4, 12); return { expr: a + "²", value: a * a }; }
      a = rint(4, 12);
      return { expr: "√" + (a * a), value: a };
    }
  ];

  function pickEquation() {
    var gen = TIER_EQ[Math.min(tier(), TIER_EQ.length - 1)];
    var eq;
    for (var k = 0; k < 15; k++) {
      eq = gen();
      if (recent.indexOf(eq.expr) === -1) break;
    }
    remember(eq.expr);

    var correct = Math.random() < 0.5;
    var shown = eq.value;
    if (!correct) {
      var deltas = [1, -1, 2, -2];
      shown = eq.value + deltas[(Math.random() * deltas.length) | 0];
      if (shown === eq.value) shown += 1;
      if (shown < 1) shown = eq.value + 1;   // never zero: it gives the answer away
    }
    return { expr: eq.expr, answer: shown, isWrong: !correct };
  }

  // ------------------------------------------------------------------ HUD

  function retrigger(el, cls) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  function updateHUD() {
    scoreEl.textContent = score;
    var tr = tier();
    levelLabel.textContent = (t().level + " " + (tr + 1)).toUpperCase();
    levelFill.style.transform = "scaleX(" + ((score % PER_LEVEL) / PER_LEVEL) + ")";
    if (running && tr > shownTier) {
      levelUpLabel.textContent = t().level + " " + (tr + 1);
      retrigger(levelUpEl, "show");
    }
    shownTier = tr;
  }

  function wrongFeedback() {
    retrigger(flashEl, "show");
    retrigger(field, "shake");
  }

  function puffAt(x, y) {
    var p = document.createElement("div");
    p.className = "puff";
    p.style.left = x + "px";
    p.style.top = y + "px";
    field.appendChild(p);
    setTimeout(function () { p.remove(); }, 620);
  }

  function popScore(b) {
    var pop = document.createElement("div");
    pop.className = "score-pop";
    pop.textContent = "+1";
    pop.style.left = (b.body.position.x - 10 * S) + "px";
    pop.style.top = (b.body.position.y - b.height / 2) + "px";
    field.appendChild(pop);
    setTimeout(function () { pop.remove(); }, 800);
  }

  // ----------------------------------------------------------- the tiles

  function syncDOM(b) {
    var p = b.body.position;
    var deg = b.body.angle * 180 / Math.PI;
    // tilt with the finger only while the tile can still be called; once it
    // has landed mid-drag, show its real physics angle
    if (b.dragging && b.state === "falling") deg += b.dragX / (28 * S);
    b.el.style.transform =
      "translate(" + (p.x - b.width / 2) + "px," + (p.y - b.height / 2) + "px) rotate(" + deg + "deg)";
    if (b.state === "falling") {
      var top = p.y - b.height / 2;
      if (top < 30 * S) {
        var o = (top + 10 * S) / (40 * S);
        b.el.style.opacity = o < 0 ? 0 : o > 1 ? 1 : o;
      } else if (b.el.style.opacity !== "") {
        b.el.style.opacity = "";
      }
    }
  }

  function spawnX(w) {
    var m = 8 * S, gap = 36 * S;
    for (var k = 0; k < 25; k++) {
      var x = m + w / 2 + Math.random() * Math.max(1, fieldWidth - w - 2 * m);
      var ok = true;
      for (var i = 0; i < blocks.length; i++) {
        var b = blocks[i];
        if (b.state !== "falling") continue;
        if (Math.abs(b.body.position.x - x) < (b.width + w) / 2 + gap) { ok = false; break; }
      }
      if (ok) return x;
    }
    return null;   // no clean column — the caller waits a frame
  }

  function spawn() {
    var word, misspelled, eq = null;
    if (Math.random() < MATH_SHARE) {
      eq = pickEquation();
      word = eq.expr + "=" + eq.answer;
      misspelled = eq.isWrong;              // "misspelled" = "swipe me left"
    } else {
      var e = pickEntry();
      misspelled = e.length > 1 && Math.random() < 0.5;
      word = misspelled ? e[1 + ((Math.random() * (e.length - 1)) | 0)] : e[0];
    }

    var el = document.createElement("div");
    el.className = eq ? "block eq" : "block";
    if (eq) {
      var lineA = document.createElement("span");
      lineA.textContent = eq.expr;
      var lineB = document.createElement("span");
      lineB.textContent = "= " + eq.answer;
      el.appendChild(lineA);
      el.appendChild(lineB);
    } else {
      el.textContent = word;
    }
    field.appendChild(el);

    var width, height;
    if (eq) {
      // a w×h box fits inside a circle of diameter sqrt(w²+h²) — its corners
      // land on the rim — so that plus a little air always holds the sum,
      // however long the expression turns out to be
      var tw = el.offsetWidth, th = el.offsetHeight;
      width = height = Math.ceil(Math.sqrt(tw * tw + th * th) + 21 * S);
      el.style.width = width + "px";
      el.style.height = height + "px";
    } else {
      width = el.offsetWidth;
      height = el.offsetHeight;
    }

    var x = spawnX(width);
    if (x === null) { el.remove(); return false; }

    var shape = {
      friction: 0.28,
      frictionStatic: 0.35,
      restitution: eq ? 0.14 : 0.22,
      frictionAir: eq ? 0.03 : 0.01,
      sleepThreshold: 110,
      collisionFilter: { category: CAT_FALLING, mask: MASK_FALLING }
    };
    if (!eq) shape.chamfer = { radius: 12 * S };
    var body = eq
      ? Bodies.circle(x, -height / 2 - 6 * S, width / 2, shape)
      : Bodies.rectangle(x, -height / 2 - 6 * S, width, height, shape);

    var block = {
      el: el, body: body, word: word, misspelled: misspelled, isEq: !!eq,
      width: width, height: height,
      state: "falling", penalty: false, revealed: false, revealAt: 0,
      dragging: false, dragX: 0, startX: 0, bodyStartX: 0, overTime: 0
    };
    body.plugin.block = block;
    Composite.add(engine.world, body);
    blocks.push(block);
    attachSwipe(block);
    syncDOM(block);
    return true;
  }

  function showTruth(block) {
    block.el.classList.add("locked", block.misspelled ? "mis" : "ok");
  }

  function land(block) {
    block.state = "landed";
    block.body.collisionFilter.category = CAT_SETTLED;
    block.body.collisionFilter.mask = MASK_ALL;
    // a penalty tile stays neutral in flight; reveal() colours it on impact
    if (!block.penalty) {
      showTruth(block);
      puffAt(block.body.position.x, block.body.position.y + block.height / 2);
    }
  }

  function reveal(body) {
    var blk = body.plugin && body.plugin.block;
    if (blk && blk.penalty && !blk.revealed) {
      blk.revealed = true;
      showTruth(blk);
      puffAt(blk.body.position.x, blk.body.position.y + blk.height / 2);
      body.collisionFilter.category = CAT_SETTLED;
      body.collisionFilter.mask = MASK_ALL;
    }
  }

  Events.on(engine, "collisionStart", function (ev) {
    for (var k = 0; k < ev.pairs.length; k++) {
      var pair = ev.pairs[k];
      if (pair.bodyA.isSensor || pair.bodyB.isSensor) continue;
      reveal(pair.bodyA);
      reveal(pair.bodyB);
      if (pair.bodyA.plugin.isSideWall || pair.bodyB.plugin.isSideWall) continue;
      var a = pair.bodyA.plugin && pair.bodyA.plugin.block;
      var b = pair.bodyB.plugin && pair.bodyB.plugin.block;
      // two tiles both still in the air never land each other: the solver
      // shoulders them apart, but neither call is over
      if (a && b && a.state === "falling" && b.state === "falling") continue;
      if (a && a.state === "falling") land(a);
      if (b && b.state === "falling") land(b);
    }
  });

  // contacts already active when a body entered the flying state never fire a
  // fresh collisionStart, and would leave it grey and non-colliding
  Events.on(engine, "collisionActive", function (ev) {
    for (var k = 0; k < ev.pairs.length; k++) {
      var pair = ev.pairs[k];
      if (pair.bodyA.isSensor || pair.bodyB.isSensor) continue;
      reveal(pair.bodyA);
      reveal(pair.bodyB);
    }
  });

  // --------------------------------------------------------------- swipes

  function attachSwipe(block) {
    var el = block.el;

    el.addEventListener("pointerdown", function (e) {
      if (!running || paused) return;
      if (block.state !== "falling") return;
      if (activeDrag && activeDrag !== block) return;   // ignore a second finger
      activeDrag = block;
      block.dragging = true;
      block.startX = e.clientX;
      block.bodyStartX = block.body.position.x;
      block.dragX = 0;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.classList.add("dragging");
      e.preventDefault();
    });

    el.addEventListener("pointermove", function (e) {
      if (!block.dragging) return;
      block.dragX = e.clientX - block.startX;
    });

    function finish() {
      if (!block.dragging) return;
      block.dragging = false;
      if (activeDrag === block) activeDrag = null;
      el.classList.remove("dragging");

      if (block.state !== "falling" || !running || paused) { block.dragX = 0; return; }

      if (Math.abs(block.dragX) > SWIPE_THRESHOLD * S) {
        var userSaysCorrect = block.dragX > 0;
        var userRight = userSaysCorrect === !block.misspelled;
        var dir = block.dragX > 0 ? 1 : -1;
        var body = block.body;

        if (userRight) {
          block.state = "cleared";
          // collide with nothing, three ways: isSensor stops the response,
          // mask 0 stops the pair being detected at all (a tile swiped while
          // already touching a wall), frictionAir 0 stops air drag parking it
          // mid-flight as a phantom
          body.isSensor = true;
          body.collisionFilter.mask = 0;
          body.frictionAir = 0;
          Body.setVelocity(body, { x: dir * FLY_SPEED * S * PX_PER_STEP, y: -4 * S });
          Body.setAngularVelocity(body, dir * 0.04);
          score++;
          updateHUD();
          popScore(block);
          retrigger(scoreEl, "bump");
          checkCap();
        } else {
          wrongFeedback();
          block.penalty = true;
          block.revealAt = performance.now() + 160;
          land(block);
          body.collisionFilter.category = CAT_FLYING;
          body.collisionFilter.mask = MASK_FLYING;
          Body.setVelocity(body, { x: dir * FLY_SPEED * S * PX_PER_STEP, y: -3 * S });
          Body.setAngularVelocity(body, dir * 0.12);
        }
      }
      block.dragX = 0;
    }

    el.addEventListener("pointerup", finish);
    el.addEventListener("pointercancel", finish);
  }

  // ----------------------------------------------------------- the loop

  function preStep() {
    // gravity is integrated on top of the velocity we set, so subtract its
    // per-step contribution: the net fall speed is then exactly fallSpeed()
    var drift = engine.gravity.y * engine.gravity.scale * STEP_MS * STEP_MS;
    var vy = Math.max(0.1, fallSpeed() * PX_PER_STEP - drift);
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.state !== "falling") continue;
      if (b.dragging) {
        var half = b.width / 2;
        var tx = Math.max(half, Math.min(fieldWidth - half, b.bodyStartX + b.dragX));
        Body.setPosition(b.body, { x: tx, y: b.body.position.y });
      }
      Body.setVelocity(b.body, { x: 0, y: vy });
      Body.setAngularVelocity(b.body, 0);
    }
  }

  function postFrame(dt) {
    var ended = false;
    var highestTop = fieldHeight;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i], body = b.body;

      if (b.state === "landed" && body.bounds.min.y < highestTop) highestTop = body.bounds.min.y;

      if (b.state === "cleared") {
        if (body.position.x < -b.width || body.position.x > fieldWidth + b.width ||
            body.position.y > fieldHeight + 400 * S || body.position.y < -400 * S) {
          Composite.remove(engine.world, body);
          b.el.remove();
          b.state = "gone";
          continue;
        }
      } else if (b.state === "landed") {
        if (b.penalty && !b.revealed) {
          var inStack = body.bounds.max.y > floorY - 200 * S && body.speed < 4 * S;
          if (body.isSleeping || body.speed < 1.6 * S ||
              (b.revealAt && performance.now() > b.revealAt) || inStack) {
            reveal(body);
          }
        }
        // every landed tile must end up showing its truth colour
        if (!b.el.classList.contains("ok") && !b.el.classList.contains("mis")) {
          if (!b.penalty || b.revealed) showTruth(b);
        }
        if (body.position.y > fieldHeight + 400 * S) {
          Composite.remove(engine.world, body);
          b.el.remove();
          b.state = "gone";
          continue;
        }
        // resting above the line, not merely passing through it
        if (body.bounds.min.y < ceilingY && (body.isSleeping || body.speed < 0.2 * S)) {
          b.overTime += dt;
          if (b.overTime > GAMEOVER_HOLD) ended = true;
        } else {
          b.overTime = 0;
        }
      }
      syncDOM(b);
    }
    blocks = blocks.filter(function (b) { return b.state !== "gone"; });

    var dangerStart = ceilingY + fieldHeight * 0.34;
    var d = (dangerStart - highestTop) / (dangerStart - ceilingY);
    d = d < 0 ? 0 : d > 1 ? 1 : d;
    dangerEl.style.opacity = d;
    dangerEl.classList.toggle("crit", d > 0.75);

    if (ended) gameOver();
  }

  /* One loop for everything. The scenery keeps breathing behind the start
     panel and behind the pause veil — the world is not a thing the round
     switches on. */
  function frame(now) {
    requestAnimationFrame(frame);
    stage.frame(now);
    if (!running || paused) { lastTime = 0; return; }

    if (!lastTime) lastTime = now;
    var dtMs = Math.min(50, now - lastTime);
    lastTime = now;

    spawnTimer += dtMs / 1000;
    if (spawnTimer >= spawnInterval()) {
      // reset only if a tile was actually placed, so spawns never double up
      if (spawn()) spawnTimer = 0;
    }

    stepAcc += dtMs;
    var steps = 0;
    while (stepAcc >= STEP_MS && steps < 4) {
      preStep();
      Engine.update(engine, STEP_MS);
      stepAcc -= STEP_MS;
      steps++;
    }
    if (steps === 4) stepAcc = 0;   // dropped frames: don't spiral

    postFrame(dtMs / 1000);
  }

  // -------------------------------------------------------- round control

  function setPhase(p) { gameEl.dataset.phase = p; }

  function clearField() {
    for (var i = 0; i < blocks.length; i++) {
      Composite.remove(engine.world, blocks[i].body);
      blocks[i].el.remove();
    }
    blocks = [];
    var stale = field.querySelectorAll(".score-pop, .puff");
    for (var k = 0; k < stale.length; k++) stale[k].remove();
  }

  function start() {
    measureField();
    buildWalls();
    clearField();
    recent = [];
    activeDrag = null;
    paused = false;
    capShown = false;
    pauseVeil.hidden = true;
    closeModal();
    dangerEl.style.opacity = 0;
    dangerEl.classList.remove("crit");
    shownTier = 0;
    score = 0;
    // start the clock at zero, not part-way through an interval: the opening
    // spawn below is the first tile, and a head start on top of it put a
    // second one on screen 0.6 s later
    spawnTimer = 0;
    lastTime = 0;
    stepAcc = 0;
    updateHUD();
    overlay.classList.add("hidden");
    setPhase("playing");
    running = true;
    spawn();
  }

  function gameOver() {
    running = false;
    paused = false;
    pauseVeil.hidden = true;
    closeModal();
    if (score > best) {
      best = score;
      localStorage.setItem(STORE + "best." + lang, String(best));
    }
    setPanel(true);
    setPhase("over");
    overlay.classList.remove("hidden");
  }

  function pause() {
    if (!running || paused) return;
    paused = true;
    if (activeDrag) {
      activeDrag.dragging = false;
      activeDrag.dragX = 0;
      activeDrag.el.classList.remove("dragging");
      activeDrag = null;
    }
    pauseTitle.textContent = t().paused.toUpperCase();
    pauseVeil.hidden = false;
    setPhase("paused");
  }

  function resume() {
    if (!running || !paused) return;
    if (!modal.hidden) return;      // the offer is still up; it owns the veil
    paused = false;
    pauseVeil.hidden = true;
    setPhase("playing");
    lastTime = 0;
    stepAcc = 0;
  }

  // --------------------------------------------------------- the offer

  function openModal(title, body, keepLabel) {
    modalTitle.textContent = title;
    modalBody.textContent = body;
    modalBuy.textContent = t().buy.toUpperCase();
    modalKeep.textContent = keepLabel;
    modal.hidden = false;
  }

  function closeModal() { modal.hidden = true; }

  // level 5 is the last free one. The app pauses the round and offers SYVT+
  // once; dismissing it leaves the pause veil, and play carries on at level 5
  // for as long as the player likes.
  function checkCap() {
    if (capShown || rawTier() <= FREE_MAX_TIER) return;
    capShown = true;
    pause();
    openModal(t().capTitle, t().capBody, t().keepPlaying);
  }

  function offerWorld() {
    openModal(t().lockTitle, t().lockBody, t().notNow);
  }

  // ------------------------------------------------------------- chrome

  function setPanel(over) {
    taglineEl.hidden = over;
    overTitle.hidden = !over;
    overStats.hidden = !over;
    if (over) {
      overTitle.textContent = t().over;
      statScore.textContent = score;
      statScoreLbl.textContent = t().scoreLbl.toUpperCase();
      statBest.textContent = best;
      statBestLbl.textContent = t().bestLbl.toUpperCase();
      bestStat.hidden = !best;
    }
    startBtn.textContent = (over ? t().again : t().start).toUpperCase();
  }

  function buildPicker() {
    picker.innerHTML = "";
    for (var i = 0; i < WORLDS.length; i++) {
      (function (world) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "world" + (world.free ? "" : " locked");
        btn.setAttribute("aria-current", world.id === themeId ? "true" : "false");

        var thumb = document.createElement("span");
        thumb.className = "thumb";
        var cv = document.createElement("canvas");
        thumb.appendChild(cv);
        if (!world.free) {
          var lock = document.createElement("span");
          lock.className = "lock";
          lock.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>' +
            '<rect x="5.5" y="10" width="13" height="10" rx="2.6"/></svg>';
          thumb.appendChild(lock);
        }
        var name = document.createElement("span");
        name.className = "name";
        name.textContent = world.names[lang];

        btn.appendChild(thumb);
        btn.appendChild(name);
        btn.addEventListener("click", function () {
          if (!world.free) { offerWorld(); return; }
          applyTheme(world.id);
        });
        picker.appendChild(btn);
        world.el = btn;
        world.canvas = cv;
      })(WORLDS[i]);
    }
    drawThumbs();
  }

  function drawThumbs() {
    for (var i = 0; i < WORLDS.length; i++) {
      if (WORLDS[i].canvas) window.SYVT_SCENERY.preview(WORLDS[i].canvas, WORLDS[i].id, 70 * S, 52 * S);
    }
  }

  function applyTheme(id) {
    themeId = id;
    localStorage.setItem(STORE + "theme", id);
    document.documentElement.dataset.theme = id;
    stage.setTheme(id);
    for (var i = 0; i < WORLDS.length; i++) {
      if (WORLDS[i].el) WORLDS[i].el.setAttribute("aria-current", WORLDS[i].id === id ? "true" : "false");
    }
    // the fonts differ between worlds, so every tile is a new size
    requestAnimationFrame(function () {
      measureField();
      buildWalls();
      drawThumbs();
    });
  }

  function applyLang() {
    var s = t();
    $("hintLeft").textContent = s.hintLeft;
    $("hintRight").textContent = s.hintRight;
    scoreKicker.textContent = s.scoreLbl.toUpperCase();
    legendText.textContent = s.legend;
    storeLinkLabel.textContent = s.store;
    pauseBtn.setAttribute("aria-label", s.pauseAction);
    resumeBtn.textContent = s.resume.toUpperCase();
    quitBtn.textContent = s.quit;
    taglineEl.textContent = s.tagline;
    for (var i = 0; i < WORLDS.length; i++) {
      if (WORLDS[i].el) WORLDS[i].el.querySelector(".name").textContent = WORLDS[i].names[lang];
    }
    var buttons = langRow.querySelectorAll(".lang");
    for (var k = 0; k < buttons.length; k++) {
      buttons[k].classList.toggle("active", buttons[k].dataset.lang === lang);
    }
    best = +(localStorage.getItem(STORE + "best." + lang) || 0);
    setPanel(false);
    updateHUD();
  }

  // -------------------------------------------------------------- wiring

  startBtn.addEventListener("click", start);
  pauseBtn.addEventListener("click", pause);
  resumeBtn.addEventListener("click", resume);
  quitBtn.addEventListener("click", gameOver);

  // tapping the veil itself resumes, the way the app's does; the buttons
  // stop the event from reaching it
  pauseVeil.addEventListener("pointerdown", function (e) {
    if (e.target === pauseVeil) { e.preventDefault(); resume(); }
  });

  modalKeep.addEventListener("click", closeModal);
  modal.addEventListener("pointerdown", function (e) {
    if (e.target === modal) closeModal();   // the barrier is the quiet way out
  });

  var langButtons = langRow.querySelectorAll(".lang");
  for (var li = 0; li < langButtons.length; li++) {
    langButtons[li].addEventListener("click", function () {
      var next = this.dataset.lang;
      if (LANGS.indexOf(next) === -1) return;
      lang = next;
      localStorage.setItem(STORE + "lang", lang);
      recent = [];
      applyLang();
      // a different language is a different font metric on every tile
      requestAnimationFrame(function () { measureField(); buildWalls(); });
    });
  }

  // a round that runs on without its player is worse than one that waits
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause();
  });

  /* A resize changes --s, so every tile has just been redrawn at a new size.
     Scale the bodies to match, and keep the stack resting on the floor in the
     same columns — otherwise the simulation runs against the old boxes. */
  function rescaleBlocks(prevW, prevFloorY) {
    if (!prevW || prevW === fieldWidth || !blocks.length) return;
    var r = fieldWidth / prevW;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      // a disc's diameter is an inline px value, so unlike a brick it does
      // not follow --s on its own
      if (b.isEq) {
        b.el.style.width = (b.width * r) + "px";
        b.el.style.height = (b.height * r) + "px";
      }
      var w = b.el.offsetWidth, h = b.el.offsetHeight;
      if (w && h && (w !== b.width || h !== b.height)) {
        Body.scale(b.body, w / b.width, h / b.height);
        b.width = w;
        b.height = h;
      }
      var pos = b.body.position;
      Body.setPosition(b.body, { x: pos.x * r, y: floorY - (prevFloorY - pos.y) * r });
    }
  }

  window.addEventListener("resize", function () {
    var w = gameEl.clientWidth, h = gameEl.clientHeight;
    if (running && w === fieldWidth && h === fieldHeight) return;
    var prevW = fieldWidth, prevFloorY = floorY;
    measureField();
    buildWalls();
    rescaleBlocks(prevW, prevFloorY);
    drawThumbs();
  });

  // ------------------------------------------------------------- go

  document.documentElement.dataset.theme = themeId;
  measureField();
  stage.setTheme(themeId);
  buildWalls();
  buildPicker();
  applyLang();
  setPhase("idle");
  requestAnimationFrame(frame);

  // the webfonts change every tile's metrics; re-measure once they land
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      measureField();
      buildWalls();
      drawThumbs();
    });
  }
})();
