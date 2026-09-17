/* SYVT on the web: the Android game's free tier, rule for rule.

   Everything the app's free player gets is here — both sides of the game
   and the three worlds open across them, all three languages, levels 1 to 4,
   the same words, the same sums, the same fall speeds. Where the app would
   sell SYVT+, this says it is coming: a locked world, the end of level 4, or
   the voice going quiet. The Android app is not listed yet, so none of the
   three offers a link - see the note above openModal for what to put back
   the day it is.

   Which side is being played is the page's own answer to a setting the app
   keeps per player: there are no players here, so it is a switch on the
   start panel, and everything that follows from it - the worlds in the
   picker, the face, the palette, what a padlock is counted against - follows
   from that one value.

   The physics runs in screen px (design px × S) so a body's position is the
   tile's position; the stylesheet gets the same S, so what is drawn and what
   is simulated cannot drift apart. */
(function () {
  "use strict";

  var $ = function (id) { return document.getElementById(id); };

  var gameEl = $("game");
  var field = $("field");
  var scoreEl = $("score"), scoreKicker = $("scoreKicker"), scoreBonus = $("scoreBonus");
  var levelLabel = $("levelLabel"), levelFill = $("levelFill");
  var pauseBtn = $("pauseBtn");
  var dangerEl = $("danger");
  var levelUpEl = $("levelUp"), levelUpLabel = $("levelUpLabel");
  var flashEl = $("flash");
  var pauseVeil = $("pauseVeil"), pauseTitle = $("pauseTitle");
  var resumeBtn = $("resumeBtn"), quitBtn = $("quitBtn");
  var overlay = $("overlay");
  var taglineEl = $("tagline"), overTitle = $("overTitle"), overStats = $("overStats");
  var statScore = $("statScore"), statScoreLbl = $("statScoreLbl"), statScoreBonus = $("statScoreBonus");
  var statBest = $("statBest"), statBestLbl = $("statBestLbl"), bestStat = $("bestStat");
  var statBestBonus = $("statBestBonus");
  var picker = $("themePicker"), langRow = $("langRow");
  var audPills = [].slice.call(document.querySelectorAll("#audienceRow .aud"));
  var startBtn = $("startBtn"), legendText = $("legendText");
  var storeLinkLabel = $("storeLinkLabel");
  var modal = $("modal"), modalTitle = $("modalTitle"), modalBody = $("modalBody");
  var modalBuy = $("modalBuy"), modalKeep = $("modalKeep");
  var scoreInfo = $("scoreInfo");
  var voiceBtn = $("voiceBtn");

  var Engine = Matter.Engine, Bodies = Matter.Bodies, Body = Matter.Body,
      Composite = Matter.Composite, Events = Matter.Events;

  var WORDS = window.SYVT_WORDS;
  // Germany's forms of the German words Switzerland writes with ss, keyed by
  // the Swiss form; empty for a words.js from before they came across
  var GERMANY = window.SYVT_GERMANY || {};

  // ------------------------------------------------------------- strings

  var I18N = {
    en: {
      tagline: "Words fall from the sky. Swipe right if a word is spelled correctly — left if it’s misspelled.",
      legend: "Be quick — be sure. Wrong swipes hit the wall and pile up.\nWhen the stack reaches the top, the game ends.",
      hintLeft: "misspelled", hintRight: "correctly spelled",
      level: "Level", start: "Start", again: "Play again",
      over: "Stack Overflow", scoreLbl: "Score", bestLbl: "Best",
      paused: "Paused", resume: "Continue", quit: "End round", pauseAction: "Pause",
      store: "SYVT+ is coming to Android",
      buy: "Get SYVT+", notNow: "Not now", keepPlaying: "Keep playing",
      capTitle: "Level {level} reached!",
      capBody: "That is the last level of the free game. SYVT+ takes the words on to level 10, and it is coming to Android soon. Until then, keep playing here for as long as you like — anything past {score} is counted beside your score.",
      counterTitle: "Why {score}?",
      counterBody: "{score} is the whole free game: four levels of thirty points. Past that the words stay at level {level}, so those points come easier — they are counted beside your score rather than in it, so that every {score} means the same thing.",
      gotIt: "Got it",
      audienceKids: "Kids", audienceGrown: "Grown-ups",
      lockBodyGrown: "This world is part of SYVT+: both of the grown-ups’ worlds and ten levels. It is coming to Android soon.",
      lockTitle: "A SYVT+ world",
      lockBody: "This world is part of SYVT+: six worlds and ten levels. It is coming to Android soon.",
      voiceSetting: "Read words aloud",
      voiceOffline: "Needs a connection",
      voiceNeedsPlus: "SYVT+ reads the higher levels",
      voiceTitle: "A SYVT+ voice",
      voiceBody: "The free game reads the words out on levels 1 and 2. SYVT+ goes on reading them all the way up, and it is coming to Android soon."
    },
    de: {
      tagline: "Wörter fallen vom Himmel. Wische nach rechts, wenn ein Wort richtig geschrieben ist — nach links, wenn es falsch ist.",
      legend: "Sei schnell — sei sicher. Falsche Wischer prallen an die Wand und stapeln sich.\nErreicht der Stapel die Decke, ist das Spiel vorbei.",
      hintLeft: "falsch geschrieben", hintRight: "richtig geschrieben",
      level: "Stufe", start: "Los", again: "Nochmal",
      over: "Stack Overflow", scoreLbl: "Punkte", bestLbl: "Rekord",
      paused: "Pausiert", resume: "Weiter", quit: "Runde beenden", pauseAction: "Pause",
      store: "SYVT+ kommt bald für Android",
      buy: "SYVT+ holen", notNow: "Nicht jetzt", keepPlaying: "Weiterspielen",
      capTitle: "Level {level} geschafft!",
      capBody: "Das ist das letzte Level der Gratis-Version. Mit SYVT+ geht es weiter bis Level 10 — bald für Android. Bis dahin spielst du hier weiter, so lange du magst; alles über {score} wird neben deinem Punktestand gezählt.",
      counterTitle: "Warum {score}?",
      counterBody: "{score} ist die ganze Gratis-Version: vier Level à dreissig Punkte. Danach bleiben die Wörter auf Level {level}, diese Punkte sind also leichter — sie werden neben deinem Punktestand gezählt und nicht darin, damit {score} überall dasselbe bedeutet.",
      gotIt: "Alles klar",
      audienceKids: "Kinder", audienceGrown: "Erwachsene",
      lockBodyGrown: "Diese Welt gehört zu SYVT+: beide Welten für Erwachsene und zehn Level. Bald für Android.",
      lockTitle: "Eine SYVT+ Welt",
      lockBody: "Diese Welt gehört zu SYVT+: sechs Welten und zehn Level. Bald für Android.",
      voiceSetting: "Wörter vorlesen",
      voiceOffline: "Braucht eine Verbindung",
      voiceNeedsPlus: "SYVT+ liest auch die höheren Level vor",
      voiceTitle: "Eine SYVT+ Stimme",
      voiceBody: "Gratis werden die Wörter auf Level 1 und 2 vorgelesen. Mit SYVT+ geht es bis nach oben weiter — bald für Android."
    },
    fr: {
      tagline: "Des mots tombent du ciel. Glisse à droite si un mot est bien orthographié — à gauche s’il est mal écrit.",
      legend: "Sois rapide — sois sûr. Les mauvais choix heurtent le mur et s’empilent.\nQuand la pile atteint le haut, la partie est finie.",
      hintLeft: "mal orthographié", hintRight: "bien orthographié",
      level: "Niveau", start: "Démarrer", again: "Rejouer",
      over: "Stack Overflow", scoreLbl: "Score", bestLbl: "Record",
      paused: "En pause", resume: "Continuer", quit: "Terminer la partie", pauseAction: "Pause",
      store: "SYVT+ arrive bientôt sur Android",
      buy: "Passer à SYVT+", notNow: "Pas maintenant", keepPlaying: "Continuer à jouer",
      capTitle: "Niveau {level} atteint !",
      capBody: "C’est le dernier niveau de la version gratuite. Avec SYVT+ les mots continuent jusqu’au niveau 10 — bientôt sur Android. En attendant, reste ici aussi longtemps que tu veux ; tout ce qui dépasse {score} est compté à côté de ton score.",
      counterTitle: "Pourquoi {score} ?",
      counterBody: "{score}, c’est tout le jeu gratuit : quatre niveaux de trente points. Ensuite les mots restent au niveau {level}, donc ces points-là sont plus faciles — ils sont comptés à côté de ton score et non dedans, pour que {score} veuille toujours dire la même chose.",
      gotIt: "Compris",
      audienceKids: "Enfants", audienceGrown: "Adultes",
      lockBodyGrown: "Ce monde fait partie de SYVT+ : les deux mondes pour adultes et dix niveaux. Bientôt sur Android.",
      lockTitle: "Un monde SYVT+",
      lockBody: "Ce monde fait partie de SYVT+ : six mondes et dix niveaux. Bientôt sur Android.",
      voiceSetting: "Lire les mots à voix haute",
      voiceOffline: "Nécessite une connexion",
      voiceNeedsPlus: "SYVT+ lit aussi les niveaux supérieurs",
      voiceTitle: "Une voix SYVT+",
      voiceBody: "La version gratuite lit les mots aux niveaux 1 et 2. SYVT+ continue jusqu’en haut — bientôt sur Android."
    }
  };

  /* The app's own `kThemes`, in its own order: the grown-ups' two and then
     the children's six, each side's free worlds first so a first tap lands
     on something the player may keep. `free` is the app's
     `Limits.freeThemes` - Light on one side, Space and Day on the other -
     and it is what decides both the padlock and whether this page has the
     world drawn at all. The two sides never see each other's worlds, which
     is why one free set serves both: a locked world on one side must never
     have a free twin on the other, or a flip of the switch would be a way
     round the lock. */
  var WORLDS = [
    { id: "light",    audience: "grownups", free: true,  names: { en: "Light", de: "Hell", fr: "Clair" } },
    { id: "dark",     audience: "grownups", free: false, names: { en: "Dark", de: "Dunkel", fr: "Sombre" } },
    { id: "space",    audience: "kids",     free: true,  names: { en: "Space", de: "Weltall", fr: "Espace" } },
    { id: "day",      audience: "kids",     free: true,  names: { en: "Day", de: "Tag", fr: "Jour" } },
    { id: "night",    audience: "kids",     free: false, names: { en: "Night", de: "Nacht", fr: "Nuit" } },
    { id: "aquarium", audience: "kids",     free: false, names: { en: "Ocean", de: "Ozean", fr: "Oc\u00e9an" } },
    { id: "castle",   audience: "kids",     free: false, names: { en: "Princess Castle", de: "Schloss", fr: "Ch\u00e2teau" } },
    { id: "dino",     audience: "kids",     free: false, names: { en: "Dinosaurs", de: "Dinos", fr: "Dinos" } }
  ];

  var AUDIENCES = ["kids", "grownups"];

  function worldById(id) {
    for (var i = 0; i < WORLDS.length; i++) {
      if (WORLDS[i].id === id) return WORLDS[i];
    }
    return null;
  }

  function worldsFor(a) {
    var out = [];
    for (var i = 0; i < WORLDS.length; i++) {
      if (WORLDS[i].audience === a) out.push(WORLDS[i]);
    }
    return out;
  }

  /* The world a fresh player on this side opens in: the free one, so nobody
     begins somewhere they would be asked to pay to stay. The children's is
     Space rather than Day, though both are free, for the eight-year-old's
     sake: a first screen that is clearly a game. */
  function defaultThemeFor(a) { return a === "grownups" ? "light" : "space"; }

  /* Where a world goes when the switch is flipped: to its twin on the other
     side - Night and Dark, Day and Light are the same scene drawn twice - or,
     for a world with no twin, that side's default. So a grown-up who tries
     the children's side and comes back gets their sky back. The app's
     `themeAcross`, in lib/ui/themes/themes.dart. */
  function themeAcross(id, to) {
    if (to === "grownups") {
      if (id === "night") return "dark";
      if (id === "day") return "light";
    } else {
      if (id === "dark") return "night";
      if (id === "light") return "day";
    }
    return defaultThemeFor(to);
  }

  /* The page behind the letterboxed field, per world, so the browser's own
     chrome is the colour the world is. Only a world this page can play needs
     one; a locked world is never in force. */
  var PAGE_COLOUR = { light: "#e1e8ea", space: "#1a1546", day: "#2b8fd8" };

  // an explicit allowlist, not a property lookup: "__proto__" would pass a
  // truthy check on any object and then crash the round
  var LANGS = ["en", "de", "fr"];
  var STORE = "syvt.";

  /* What a first visit opens in, and which German it writes: the app's rule,
     from lib/profile/locale_defaults.dart in the Flutter repo.

     The browser lists its user's languages in order of preference, so the
     first of them the game speaks is the one to open in, and English if it
     speaks none. A language tapped on the panel is remembered, and wins.

     Which German is right is a matter of country, not of language.
     Switzerland and Liechtenstein write ss where everybody else writes an
     eszett, so the words fall the Swiss way only where the browser's German,
     or failing any German the browser itself, is in one of those two, and
     the way Germany writes them everywhere else. A browser that names no
     country keeps the list's own spelling, which is Swiss. The app lets a
     parent change it per player; the page has no switch, so this decides. */
  var SWISS_SPELLING = ["CH", "LI"];

  // A tag's language, and its region where it names one: "de-CH",
  // "zh-Hant-TW", "es-419", "de_AT". A lone letter opens an extension
  // ("de-u-co-phonebk"), and the two-letter parts after it are not countries.
  function parseTag(tag) {
    if (typeof tag !== "string" || !tag) return null;
    var parts = tag.split(/[-_]/), region = "";
    for (var i = 1; i < parts.length && parts[i].length > 1; i++) {
      if (/^([A-Za-z]{2}|[0-9]{3})$/.test(parts[i])) {
        region = parts[i].toUpperCase();
        break;
      }
    }
    return { language: parts[0].toLowerCase(), region: region };
  }

  function localeDefaults(tags) {
    var found = "", first = null, german = null;
    for (var i = 0; i < tags.length; i++) {
      var tag = parseTag(tags[i]);
      if (!tag) continue;
      if (!first) first = tag;
      if (!found && LANGS.indexOf(tag.language) !== -1) found = tag.language;
      if (!german && tag.language === "de") german = tag;
    }
    // the German the browser speaks says which German it writes; a browser
    // that speaks none is judged by where it is
    var region = (german || first || { region: "" }).region;
    return {
      lang: found || "en",
      germanSpelling: region !== "" && SWISS_SPELLING.indexOf(region) === -1
    };
  }

  var BROWSER = localeDefaults(navigator.languages && navigator.languages.length ?
    navigator.languages : [navigator.language]);

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

  // A stored best, or 0: unary plus on a corrupted value gives NaN, and no
  // score is ever greater than NaN, so a new best would never be saved.
  function storedBest(l) {
    var n = +(readPref(STORE + "best." + l) || 0);
    return isFinite(n) && n > 0 ? n : 0;
  }

  var lang = readPref(STORE + "lang");
  if (LANGS.indexOf(lang) === -1) lang = BROWSER.lang;

  /* Which side of the game the page opens on. A player is a child unless
     they say otherwise, which is the app's own reading and the safe one; the
     switch on the panel is where they say otherwise, and it is remembered. */
  var audience = readPref(STORE + "audience");
  if (AUDIENCES.indexOf(audience) === -1) audience = "kids";

  /* The world in force. It has to be one this page draws AND one on the side
     being played from: a stale id, or one left behind by a flip of the
     switch, opens the side's free world rather than stripping the scenery. */
  var themeId = readPref(STORE + "theme");
  (function () {
    var w = worldById(themeId);
    if (!w || !w.free || w.audience !== audience) themeId = defaultThemeFor(audience);
  })();

  // ------------------------------------------------------------ the rules

  var SWIPE_THRESHOLD = 30;      // design px of drag before a release counts
  var FLY_SPEED = 1400;          // design px/s for a swiped tile
  var BASE_FALL_VY = 55;
  var FALL_PER_TIER = 14;
  var STEP_MS = 1000 / 60;
  var PX_PER_STEP = STEP_MS / 1000;
  var GAMEOVER_HOLD = 0.5;
  var PER_LEVEL = 30;            // the app's kPerLevel
  var FREE_MAX_TIER = 3;         // level 4 is the last free one: the app's Limits.freeMaxLevel
  // The last level the words are read out on, the app's Limits.freeVoiceMaxLevel.
  // Two, not none: two levels of hearing the word said while looking at the
  // spelling is the feature itself, and those are the levels a new player
  // spends the most time in. It goes quiet on the way into level three, which
  // is where the free game starts asking something of them anyway.
  var VOICE_MAX_TIER = 1;
  var FREE_CAP = (FREE_MAX_TIER + 1) * PER_LEVEL;   // 120: where counting stops
  /* How many recently shown words and sums are kept out of the draw — one
     memory, shared, and it outlives the round. It used to hold ten and be
     wiped by `start()`, which is the top of every new round: a child who
     dies early and taps PLAY AGAIN was handed the same handful of words
     again, because the page had just forgotten it had shown them. Ten short
     rounds drawn the way the game really draws them: 64 different words out
     of 96, and the wipe made the ten all but pointless — a twelve-tile
     round only just reaches ten before the list is emptied again, so
     raising the limit alone changed nothing. Thirty and kept: 71 different
     words, and a repeat landing in the opening tiles of a round down from
     1.0 a session to 0.7.

     Thirty, not more. The pool is a hundred words a level (the draw takes
     this level and the two below), so thirty is deep enough to stop the
     circling and shallow enough that the order never feels decided in
     advance, which is worse to play than a repeat. */
  var RECENT_LIMIT = 30;
  var MATH_SHARE = 0.20;
  var BASE_W = 420;
  /* The app's kSpeakFromY. A tile is named on its way past this line, not when
     it spawns: it spawns above the ceiling, invisible and still fading in, and
     a word read there arrives before there is anything to look at, which is
     worse than no word because the child looks up at nothing.

     So this is the first instant there is something to look at and not one
     moment later - the same 30 the fade-in reaches full opacity at, in
     syncDOM below, which is what makes it the earliest line that can be
     defended at all. It used to be a tenth of the way down, more than twice
     as far; a tile accelerates, so that was much later than it sounded, late
     enough that the word could arrive after the tile had been read and
     swiped, naming something the player had stopped looking at. The tile is
     still crossing the HUD row here, and that is fine: behind the chips is a
     drawing problem, and it is opaque either way. */
  var SPEAK_FROM_Y = 30;

  var CAT_WORLD = 0x0001, CAT_FALLING = 0x0002, CAT_SETTLED = 0x0004, CAT_FLYING = 0x0008;
  var MASK_FALLING = CAT_WORLD | CAT_FALLING | CAT_SETTLED;
  var MASK_ALL = CAT_WORLD | CAT_FALLING | CAT_SETTLED | CAT_FLYING;
  var MASK_FLYING = CAT_WORLD | CAT_SETTLED | CAT_FLYING;

  var engine = Engine.create({ enableSleeping: true });
  var walls = [];

  var S = 1, fieldWidth = 0, fieldHeight = 0, floorY = 0, ceilingY = 0;
  var blocks = [];
  var score = 0;
  var best = storedBest(lang);
  var running = false, paused = false, capShown = false;
  var lastTime = 0, spawnTimer = 0, stepAcc = 0;
  var activeDrag = null;
  var shownTier = 0;
  var recent = [];
  var nextId = 1;

  var stage = window.SYVT_SCENERY.stage($("sceneBack"), $("sceneFront"));

  function t() { return I18N[lang]; }

  // ------------------------------------------------------------- the voice

  /* The words read out loud, on the two levels the free game reads them.
     voice.js is the whole of the policy; this hands it the things only the
     round knows — where the player is standing, whether a tile is still in
     the air, which words are still on their way to the line, and what to say
     when the switch is flipped mid-round. */
  var voice = window.SYVT_VOICE.create({
    entitled: function () { return tier() <= VOICE_MAX_TIER; },
    stillFalling: function (id) {
      for (var i = 0; i < blocks.length; i++) {
        if (blocks[i].id === id) return blocks[i].state === "falling";
      }
      return false;
    },
    onChange: updateVoiceBtn,
    // the words still on their way to the line, for voice.js to fetch
    // whenever it becomes able to (see inAirWords)
    inAir: function () { return { lang: lang, words: inAirWords() }; },
    // The moment it becomes able to speak: the switch has just been turned
    // on, or a round has come back from a tunnel. voice.js has already asked
    // for the words still in the air itself, through inAir; this only answers
    // with the word already falling, rather than leaving the player to wait
    // out a spawn and guess whether it worked.
    onLive: function () { announceNewest(); }
  });

  /* The words of the tiles whose word has not been said yet: falling, not
     yet announced, and still above the speak line. voice.js asks for their
     clips whenever it becomes able to fetch — the START tap, the switch
     turned on, the page or the network coming back — and resume() asks again
     after a pause has dropped whatever was waiting. Not gated on `paused`: a
     page back from the background comes live under the pause veil, with its
     tiles still in the air. Draws nothing: it touches neither `recent` nor
     the round's random numbers, so the voice still cannot change the round.

     It no longer warms whole levels, as the app's _warmVoice does. At three
     hundred words a level that was 600 files and 2.5 MB on the first START,
     for a page that has no disk cache of its own and cannot speak offline
     anyway; each word is asked for instead when its tile is placed (spawn),
     1.25-1.6 s before it reaches the line. */
  function inAirWords() {
    var words = [];
    if (!running) return words;
    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      if (b.state === "falling" && b.spoken && !b.announced &&
          b.body.bounds.min.y < SPEAK_FROM_Y * S) {
        words.push(b.spoken);
      }
    }
    return words;
  }

  /* The sounds the creatures of this world can make, so the first poke has a
     voice. Called from the START tap, where there is a gesture: before that
     sfx.js creates nothing and fetches nothing. */
  function warmPokes() {
    var list = window.SYVT_SCENERY.voicesOf(themeId);
    window.SYVT_SFX.warm(list);
  }

  /* Says the newest word still in the air again, if there is one. Newest
     rather than lowest, because the newest is the one whose word has just
     been withheld — and only one that is actually on screen, since naming a
     tile still above the line is the very thing the line prevents. */
  function announceNewest() {
    if (!running || paused) return;
    for (var i = blocks.length - 1; i >= 0; i--) {
      var b = blocks[i];
      if (b.state !== "falling" || !b.spoken) continue;
      if (b.body.bounds.min.y < SPEAK_FROM_Y * S) continue;
      b.announced = true;
      voice.say(b.spoken, lang, b.id);
      return;
    }
  }

  // ------------------------------------------------------------- the poke

  /* A tap on a passing creature startles it, sets off the theme's own burst
     and gets a squeak back. The scenery owns the motion and the hit test; all
     this does is route the tap and answer in the two idioms the page already
     has - the puff the tiles land with, and a sound.

     A tap that lands on a tile is the tile's, and a tap while a tile is being
     dragged is part of that drag: the creatures cross behind the words, and
     they must never take a swipe away from one. */
  function pokeVisitor(e) {
    // A creature crosses BEHIND everything, so a tap only reaches it if it
    // reached nothing else: not a tile, not a control, and not a panel or veil
    // laid over the field. The scenery keeps breathing behind the start panel
    // and the pause veil, but what is behind a scrim is not tappable.
    if (activeDrag) return;
    if (!running || paused) return;
    var el = e.target;
    if (el && el.closest &&
        el.closest(".block, button, a, #hud, #legend, #overlay, #pauseVeil, #modal")) {
      return;
    }
    var rect = gameEl.getBoundingClientRect();
    // the canvases are drawn in design px, so the tap has to arrive in them
    var hit = stage.pokeAt((e.clientX - rect.left) / S, (e.clientY - rect.top) / S);
    if (!hit) return;
    puffAt(hit.x * S, hit.y * S);
    if (hit.voice) window.SYVT_SFX.play(hit.voice, hit.depth, hit.pan);
  }

  /* Told by shape and by luminance rather than by colour, so the difference
     survives a colour-blind player and a bright window. It is never inert:
     being offline cannot make it so, because turning the switch on is the
     only thing that starts the probe — a button that waited for a connection
     before accepting a tap could never be turned on at all — and past level 2
     a tap is what opens the offer. */
  function updateVoiceBtn() {
    var s = t();
    var allowed = voice.entitled;
    var on = allowed && voice.on;
    var stranded = on && !voice.available;
    voiceBtn.setAttribute("aria-pressed", on ? "true" : "false");
    voiceBtn.classList.toggle("dim", !allowed || stranded);
    voiceBtn.setAttribute("aria-label", s.voiceSetting);
    voiceBtn.title = !allowed ? s.voiceNeedsPlus
      : (stranded ? s.voiceOffline : s.voiceSetting);
  }

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
  // free game will play. They part company at score 120, which is where the
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
    // not remembered here: only a word that actually falls is (see spawn)
    return e;
  }

  // The forms a picked entry falls in, [correct, ...misspellings]. The list
  // is Swiss; in Germany's German the words the two countries spell
  // differently fall as Germany writes them, right form and misspellings
  // alike. The voice keeps its own key, the Swiss form (SYVT_CLIPS).
  function formsOf(e) {
    if (lang === "de" && BROWSER.germanSpelling &&
        Object.prototype.hasOwnProperty.call(GERMANY, e[0])) {
      return GERMANY[e[0]];
    }
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
    // not remembered here either: see spawn

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

  /* The score is one number up to the free ceiling and two after it. A free
     player who keeps going past level 4 is still playing level-4 words, so
     those points are not the same currency as someone else's: 120 is what
     compares, and the rest is shown beside it as its own count. */
  function showScore(valueEl, bonusEl, value) {
    var over = value > FREE_CAP ? value - FREE_CAP : 0;
    valueEl.textContent = value - over;
    // the panel's counter wraps its digits so the "i" beside them survives
    (bonusEl.querySelector(".n") || bonusEl).textContent = "+" + over;
    bonusEl.hidden = over === 0;
    return over;
  }

  function updateHUD() {
    showScore(scoreEl, scoreBonus, score);
    var tr = tier();
    levelLabel.textContent = (t().level + " " + (tr + 1)).toUpperCase();
    // full once there is no next level to fill towards, rather than sweeping
    // every thirty points under a level number that can never change
    var p = tr >= FREE_MAX_TIER ? 1 : (score % PER_LEVEL) / PER_LEVEL;
    levelFill.style.transform = "scaleX(" + p + ")";
    if (running && tr > shownTier) {
      levelUpLabel.textContent = t().level + " " + (tr + 1);
      retrigger(levelUpEl, "show");
    }
    shownTier = tr;
    // The level is the other half of the voice's gate, and it moves under a
    // running round: a player crossing into level three loses the voice they
    // have been listening to for two levels, and the chip goes quiet with it.
    voice.refresh();
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
    // `spoken` is the correct spelling, for the voice — never the one on the
    // tile, which may well be a misspelling of it. A sum has none: it is not
    // a spelling, and there is nothing to say that the disc does not show.
    var word, misspelled, spoken = null, eq = null;
    // what the anti-repeat memory will hold for this tile once it falls: the
    // sum, or the word in the list's own Swiss spelling whichever it shows
    var recentKey;
    if (Math.random() < MATH_SHARE) {
      eq = pickEquation();
      recentKey = eq.expr;
      word = eq.expr + "=" + eq.answer;
      misspelled = eq.isWrong;              // "misspelled" = "swipe me left"
    } else {
      var e = pickEntry();
      recentKey = e[0];
      var forms = formsOf(e);
      misspelled = forms.length > 1 && Math.random() < 0.5;
      word = misspelled ? forms[1 + ((Math.random() * (forms.length - 1)) | 0)] : forms[0];
      spoken = e[0];
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
    // no clear column right now: the frame loop tries again next frame,
    // with a fresh draw, as the app's does
    if (x === null) { el.remove(); return false; }
    // Only now is this a tile the player will see, so only now is it
    // remembered. Remembered at the draw, every refused spawn burned a word
    // in, and a crowded field refuses one every frame: the memory filled
    // with words that never fell and forgot the ones that had. A wide tile
    // is refused more often, so long words were also kept away more, a
    // tilt toward the short end of every level. The app fixed the same.
    remember(recentKey);

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
      id: nextId++,
      el: el, body: body, word: word, misspelled: misspelled, isEq: !!eq,
      spoken: spoken, announced: false,
      width: width, height: height,
      state: "falling", penalty: false, revealed: false, settled: false, revealAt: 0,
      dragging: false, dragX: 0, startX: 0, bodyStartX: 0, overTime: 0
    };
    body.plugin.block = block;
    Composite.add(engine.world, body);
    blocks.push(block);
    attachSwipe(block);
    syncDOM(block);
    // The first moment the word is known to fall, 1.25-1.6 s before it
    // crosses the speak line, so this is when its clip is asked for. A
    // refused spawn returned above and fetched nothing; a sum has no word;
    // and `spoken` is the Swiss form the clips are keyed by, whatever
    // spelling the tile shows.
    if (spoken) voice.warm([spoken], lang);
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

  // A wrong call has come to rest, for the danger meter, once it touches the
  // floor or the pile. Bouncing off a side wall is still part of its flight,
  // as it is in the app (GameController._reveal, settle:).
  function settle(body) {
    var blk = body.plugin && body.plugin.block;
    if (blk && blk.penalty) blk.settled = true;
  }

  Events.on(engine, "collisionStart", function (ev) {
    for (var k = 0; k < ev.pairs.length; k++) {
      var pair = ev.pairs[k];
      if (pair.bodyA.isSensor || pair.bodyB.isSensor) continue;
      reveal(pair.bodyA);
      reveal(pair.bodyB);
      if (pair.bodyA.plugin.isSideWall || pair.bodyB.plugin.isSideWall) continue;
      settle(pair.bodyA);
      settle(pair.bodyB);
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
      settle(pair.bodyA);
      settle(pair.bodyB);
    }
  });

  // --------------------------------------------------------------- swipes

  function attachSwipe(block) {
    var el = block.el;

    el.addEventListener("pointerdown", function (e) {
      if (!running || paused) return;
      if (block.state !== "falling") return;
      // A second finger, on another tile or on THIS one, as the app refuses
      // it. The same tile used to get through: the swipe re-anchored under
      // the new finger, and whichever finger lifted first made the call.
      if (activeDrag) return;
      activeDrag = block;
      block.pointerId = e.pointerId;
      block.dragging = true;
      block.startX = e.clientX;
      block.bodyStartX = block.body.position.x;
      block.dragX = 0;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.classList.add("dragging");
      e.preventDefault();
    });

    // only the finger that started the swipe steers it or ends it
    el.addEventListener("pointermove", function (e) {
      if (!block.dragging || e.pointerId !== block.pointerId) return;
      block.dragX = e.clientX - block.startX;
    });

    function finish(e) {
      if (!block.dragging || (e && e.pointerId !== block.pointerId)) return;
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
          // bump whichever counter just moved
          retrigger(score > FREE_CAP ? scoreBonus : scoreEl, "bump");
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

      // A wrong call is "landed" from the moment it is thrown, so until it
      // has come to rest it is a tile in flight, and the meter is about the
      // pile: counted, every wrong call near the top flashed the warning to
      // full for the third of a second the tile flew, on an empty field.
      var inFlight = b.penalty && !b.settled;
      if (b.state === "landed" && !inFlight && body.bounds.min.y < highestTop) highestTop = body.bounds.min.y;

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
      } else if (b.state === "falling" && !b.announced && b.spoken &&
                 body.bounds.min.y >= SPEAK_FROM_Y * S) {
        // Far enough down to be worth looking at. Once each, and never for a
        // tile that has already been called.
        b.announced = true;
        voice.say(b.spoken, lang, b.id);
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
    // `recent` is deliberately NOT cleared here. A new round is the moment
    // the player has most recently read those words, and starting over is
    // no reason to forget them; the language switch below is, and it is the
    // only thing that empties the list.
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
    // A gesture is on the stack exactly here, and iOS lifts its lock per
    // element and only inside one. Miss this and the page is silent for the
    // rest of its life.
    voice.unlock();
    voice.refresh();
    warmPokes();
    spawn();
  }

  function gameOver() {
    running = false;
    paused = false;
    voice.hush();
    pauseVeil.hidden = true;
    closeModal();
    if (score > best) {
      best = score;
      writePref(STORE + "best." + lang, String(best));
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
    voice.hush();
  }

  function resume() {
    if (!running || !paused) return;
    if (!modal.hidden) return;      // the offer is still up; it owns the veil
    paused = false;
    pauseVeil.hidden = true;
    setPhase("playing");
    lastTime = 0;
    stepAcc = 0;
    // pause() hushed the voice, which drops warm requests still waiting, so
    // ask again for the tiles still above the line (anything already fetched
    // is skipped)
    voice.warm(inAirWords(), lang);
  }

  // --------------------------------------------------------- the offer

  function openModal(title, body, keepLabel, showBuy) {
    modalTitle.textContent = title;
    modalBody.textContent = body;
    modalBuy.textContent = t().buy.toUpperCase();
    modalBuy.hidden = showBuy === false;
    // with nothing to buy, the way out leads the panel instead of sitting
    // under an offer
    modalKeep.className = "pill " + (showBuy === false ? "primary" : "secondary");
    modalKeep.textContent = showBuy === false ? keepLabel.toUpperCase() : keepLabel;
    modal.hidden = false;
  }

  function cap(text) {
    return text.replace(/\{score\}/g, FREE_CAP).replace(/\{level\}/g, FREE_MAX_TIER + 1);
  }

  /* Behind the small "i" beside the second counter: why a free score stops
     where it does. It explains and nothing else — the player asked a
     question, not for an offer, and the panel they came from carries both. */
  function openCounterInfo() {
    openModal(cap(t().counterTitle), cap(t().counterBody), t().gotIt, false);
  }

  function closeModal() { modal.hidden = true; }

  /* All three of these pass showBuy FALSE while the app is not public: they
     say what SYVT+ is and that it is coming, and the way out leads the card
     rather than sitting under a button that would open nothing. Pass true
     again, and restore the two hrefs in index.html, the day it lists. */

  // Level 4 is the last free one, as in the app (Limits.freeMaxLevel). The
  // app pauses the round and offers SYVT+ once; dismissing it leaves the
  // pause veil, and play carries on at level 4 for as long as the player
  // likes. Level 5's words are still in words.js, out of reach.
  function checkCap() {
    if (capShown || rawTier() <= FREE_MAX_TIER) return;
    capShown = true;
    pause();
    openModal(cap(t().capTitle), cap(t().capBody), t().keepPlaying, false);
  }

  /* What SYVT+ opens is counted for the side being played on, as the app's
     paywall counts it: six worlds and four to open, or two and one. */
  function offerWorld() {
    var s = t();
    openModal(s.lockTitle,
      audience === "grownups" ? s.lockBodyGrown : s.lockBody, s.notNow, false);
  }

  /* A tap on the chip past the levels the free game reads. The stack stops
     climbing before anybody is asked to read an offer: every other gate on
     the page is reached from a screen where nothing is falling. */
  function offerVoice() {
    pause();
    openModal(t().voiceTitle, t().voiceBody, t().keepPlaying, false);
  }

  // ------------------------------------------------------------- chrome

  function setPanel(over) {
    taglineEl.hidden = over;
    overTitle.hidden = !over;
    overStats.hidden = !over;
    if (over) {
      overTitle.textContent = t().over;
      showScore(statScore, statScoreBonus, score);
      statScoreLbl.textContent = t().scoreLbl.toUpperCase();
      showScore(statBest, statBestBonus, best);
      statBestLbl.textContent = t().bestLbl.toUpperCase();
      bestStat.hidden = !best;
    }
    startBtn.textContent = (over ? t().again : t().start).toUpperCase();
  }

  /* The picker shows one side's worlds and nothing of the other's, so it is
     rebuilt when the switch is flipped rather than filtered in place: a card
     that is no longer on the screen must not keep a canvas the thumbnail
     loop would go on painting. */
  function buildPicker() {
    picker.innerHTML = "";
    for (var i = 0; i < WORLDS.length; i++) { WORLDS[i].el = null; WORLDS[i].canvas = null; }
    var shown = worldsFor(audience);
    for (i = 0; i < shown.length; i++) {
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
      })(shown[i]);
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
    writePref(STORE + "theme", id);
    document.documentElement.dataset.theme = id;
    document.documentElement.dataset.audience = audience;
    setThemeColour(id);
    stage.setTheme(id);
    /* The new world's creatures have their own voices. A tap on a picker card
       is a gesture, which is the one moment an AudioContext may be made, so
       this is where the clips are asked for rather than at the next START. */
    warmPokes();
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

  // the browser's own chrome, kept the colour the world behind the field is
  function setThemeColour(id) {
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta && PAGE_COLOUR[id]) meta.setAttribute("content", PAGE_COLOUR[id]);
  }

  /* Flipping the switch. The world goes across to its twin in the same
     movement, so a grown-up who looks in on the children's side and comes
     back finds their own sky waiting rather than the side's default. */
  function setAudience(next) {
    if (next === audience || AUDIENCES.indexOf(next) === -1) return;
    var carried = themeAcross(themeId, next);
    audience = next;
    writePref(STORE + "audience", next);
    document.documentElement.dataset.audience = next;
    markAudience();
    buildPicker();
    applyTheme(carried);
    // the pills' own labels are the one piece of text the side owns
    applyLang();
  }

  function markAudience() {
    for (var i = 0; i < audPills.length; i++) {
      audPills[i].setAttribute("aria-pressed",
        audPills[i].dataset.audience === audience ? "true" : "false");
    }
  }

  function applyLang() {
    var s = t();
    // The page's own language, which it now often is not English: a screen
    // reader picks its voice by it, and a browser reads it to decide whether
    // to offer a translation of German it has been told is English.
    document.documentElement.lang = lang;
    for (var a = 0; a < audPills.length; a++) {
      audPills[a].querySelector('[data-role="label"]').textContent =
        audPills[a].dataset.audience === "kids" ? s.audienceKids : s.audienceGrown;
    }
    $("hintLeft").textContent = s.hintLeft;
    $("hintRight").textContent = s.hintRight;
    scoreKicker.textContent = s.scoreLbl.toUpperCase();
    legendText.textContent = s.legend;
    storeLinkLabel.textContent = s.store;
    pauseBtn.setAttribute("aria-label", s.pauseAction);
    scoreInfo.setAttribute("aria-label", cap(s.counterTitle));
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
    best = storedBest(lang);
    setPanel(false);
    updateHUD();
    updateVoiceBtn();
  }

  // -------------------------------------------------------------- wiring

  startBtn.addEventListener("click", start);
  pauseBtn.addEventListener("click", pause);
  gameEl.addEventListener("pointerdown", pokeVisitor);
  voiceBtn.addEventListener("click", function () {
    if (!voice.entitled) { offerVoice(); return; }
    voice.toggle();
  });
  resumeBtn.addEventListener("click", resume);
  quitBtn.addEventListener("click", gameOver);

  // tapping the veil itself resumes, the way the app's does; the buttons
  // stop the event from reaching it
  pauseVeil.addEventListener("pointerdown", function (e) {
    if (e.target === pauseVeil) { e.preventDefault(); resume(); }
  });

  modalKeep.addEventListener("click", closeModal);
  scoreInfo.addEventListener("click", openCounterInfo);
  modal.addEventListener("pointerdown", function (e) {
    if (e.target === modal) closeModal();   // the barrier is the quiet way out
  });

  for (var ai = 0; ai < audPills.length; ai++) {
    audPills[ai].addEventListener("click", function () {
      setAudience(this.dataset.audience);
    });
  }

  var langButtons = langRow.querySelectorAll(".lang");
  for (var li = 0; li < langButtons.length; li++) {
    langButtons[li].addEventListener("click", function () {
      var next = this.dataset.lang;
      if (LANGS.indexOf(next) === -1) return;
      lang = next;
      writePref(STORE + "lang", lang);
      // the one place the memory is emptied: the words it holds are not in
      // the pool the draw is about to use anyway
      recent = [];
      // Whatever is half-said, or still waiting to be fetched, is in the
      // language the page has just left.
      voice.hush();
      applyLang();
      // a different language is a different font metric on every tile
      requestAnimationFrame(function () { measureField(); buildWalls(); });
    });
  }

  // a round that runs on without its player is worse than one that waits
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pause();
    // A backgrounded page does not fetch; a returning one asks again straight
    // away, because the network it comes back to is very often not the one it
    // left - unless it had a yes under five minutes old, which is the network
    // it left (voice.js).
    voice.awake(!document.hidden);
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
  document.documentElement.dataset.audience = audience;
  setThemeColour(themeId);
  markAudience();
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
