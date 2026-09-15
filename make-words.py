#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Builds words.js: levels 1 to 5 of the app's word lists, for the web.

Usage:  python make-words.py [--manifest URL|PATH] [--out PATH]

        Needs ../SYVT checked out beside this, and the network for the corpus
        manifest (see below) unless --manifest names a local copy, such as
        ../SYVT/tool/tts/out/tts/v1/manifest.json. --out defaults to words.js.

The app generates lib/game/words.dart from the same JSON, so the site and the
Android game teach the same words in the same order. Levels 1 to 5 come
across. The free version plays the first four, and so does the web version;
the fifth stays in the file, out of reach, so moving the ceiling is a change
to FREE_MAX_TIER in syvt.js rather than a regeneration.

Each entry is [correct, ...misspellings]; the game picks one misspelling at
random when it decides to show a wrong word.

It also writes SYVT_CLIPS: the spoken clip for every word the page can ever
read out loud, which is levels 1 and 2 (see below). The ids are
computed HERE, by importing the app's own tool/tts/speech_key.py, rather than
hashed in the browser. A third implementation of the normaliser and the hash
would be a third chance to drift from the other two -- and a drifted hash
does not throw, it just misses every file, and the voice goes quiet with no
error anywhere. This way the page never hashes anything: it looks a word up.

For German the id is Germany's spelling, from ../SYVT/tool/words/de_germany.json,
for the words the two countries spell differently -- the same
`WordEntry.spoken` rule the app follows. The map is keyed by the SWISS form,
because that is what words.js carries.

Each value is the clip's OBJECT NAME, not just its id: the bare id for the
first take, `<id>.<take>` for a word recorded again after release, as the
app's voiceObject() names it (voice_object() in speech_key.py). The app learns
which words have a later take from the corpus manifest's `revisions`, at run
time (lib/voice/voice_manifest.dart). The page cannot: the bucket sends no
CORS header, and the voice's probe is a no-cors fetch whose response is
opaque -- it can tell the manifest is there, not read a byte of it. So the
takes are resolved HERE, from the PUBLISHED manifest,
https://audio.syvt.me/tts/v1/manifest.json, which names a take only once its
file is on the bucket; --manifest reads a local copy instead. A manifest that
cannot be read, does not parse, or has a revisions block not in the shape the
generator writes stops the run before anything is written, so words.js stays
the last good table. For a retake the order is: publish the clips, publish
the manifest, run this, push words.js. Cloudflare does not cache the manifest
and this fetches it uncached, so there is nothing to wait out. Until then the
page plays the old take.

The same file gives the tiles Germany's forms: SYVT_GERMANY maps each Swiss
right form among the words written here to [Germany's right form, ...its
misspellings], in the same shape as an entry, for a browser whose German is
not Switzerland's or Liechtenstein's (see localeDefaults in syvt.js).
"""
import io
import json
import os
import re
import sys
import urllib.request

SRC = os.path.join('..', 'SYVT', 'tool', 'words')
TTS = os.path.join('..', 'SYVT', 'tool', 'tts')
OUT = 'words.js'
MANIFEST = 'https://audio.syvt.me/tts/v1/manifest.json'
USAGE = 'usage: python make-words.py [--manifest URL|PATH] [--out PATH]'
CLIP_ID = re.compile(r'[0-9a-f]{20}')
LANGS = ('en', 'de', 'fr')
FREE_LEVELS = 5

# The levels the page reads aloud. Two, as in the app (Limits.freeVoiceMaxLevel),
# and the pool at level 2 reaches no further back than level 1, so these two
# levels are exactly the words that can ever be spoken here.
VOICE_LEVELS = 2

sys.path.insert(0, os.path.abspath(TTS))
from speech_key import speech_key, voice_id, voice_object  # noqa: E402


def parse_args(argv):
    """(manifest source, output path) from --manifest and --out."""
    opts = {'--manifest': MANIFEST, '--out': OUT}
    i = 0
    while i < len(argv):
        if argv[i] not in opts or i + 1 >= len(argv):
            raise SystemExit(USAGE)
        opts[argv[i]] = argv[i + 1]
        i += 2
    return opts['--manifest'], opts['--out']


def read_manifest(src):
    """The corpus manifest's parsed root, from a URL or a local file."""
    try:
        if src.startswith(('http://', 'https://')):
            req = urllib.request.Request(src, headers={
                'User-Agent': 'make-words.py', 'Cache-Control': 'no-cache'})
            with urllib.request.urlopen(req, timeout=20) as r:
                if r.status != 200:
                    raise ValueError('HTTP %d' % r.status)
                body = r.read().decode('utf-8')
        else:
            with io.open(src, encoding='utf-8') as f:
                body = f.read()
        return json.loads(body)
    except Exception as err:
        raise SystemExit('manifest: cannot read %s (%s); words.js left as it '
                         'was. Offline? --manifest '
                         '../SYVT/tool/tts/out/tts/v1/manifest.json'
                         % (src, err))


def takes_of(root):
    """({lang: {clip id: take}}, generated_at) from a manifest's revisions.

    VoiceManifest.parse in the app, but strict: at run time the app skips an
    entry it cannot read and keeps the take it has, while here a skipped entry
    would roll that word back to its first take on every browser, so anything
    out of shape stops the run. No revisions block at all is an answer -- the
    corpus has no retakes, which is also how one is rolled back.
    """
    if not isinstance(root, dict):
        raise SystemExit('manifest: not a JSON object')
    block = root.get('revisions')
    if block is None:
        block = {}
    if not isinstance(block, dict):
        raise SystemExit('manifest: revisions is not an object')
    takes = {}
    for lang, clips in block.items():
        if not isinstance(clips, dict):
            raise SystemExit('manifest: revisions.%s is not an object' % lang)
        for vid, take in clips.items():
            if not CLIP_ID.fullmatch(vid):
                raise SystemExit('manifest: revisions.%s: %r is not a clip id'
                                 % (lang, vid))
            # type() rather than isinstance(): True is an int to Python
            if type(take) is not int or take < 2:
                raise SystemExit('manifest: revisions.%s.%s: %r is not a take '
                                 'of 2 or more' % (lang, vid, take))
        takes[lang] = dict(clips)
    stamp = root.get('generated_at')
    # it goes into a comment line of words.js, so one printable line or none
    if not isinstance(stamp, str) or not re.fullmatch(r'[ -~]+', stamp):
        stamp = None
    return takes, stamp


def germany_of(lang):
    """{Swiss right form -> Germany's right form}, empty where there is none."""
    path = os.path.join(SRC, '%s_germany.json' % lang)
    if not os.path.exists(path):
        return {}
    with io.open(path, encoding='utf-8') as f:
        data = json.load(f)
    return dict((w['swiss'], w['r']) for w in data['words'])


def germany_forms():
    """{Swiss right form: [Germany's right form, ...its misspellings]}."""
    with io.open(os.path.join(SRC, 'de_germany.json'), encoding='utf-8') as f:
        data = json.load(f)
    forms = {}
    for w in data['words']:
        swiss, right = w['swiss'], w['r']
        wrongs = [x for x in w['w'] if x and x != right]
        if swiss in forms:
            raise SystemExit('de_germany.json: duplicate %r' % swiss)
        if right == swiss:
            raise SystemExit('de_germany.json: %r is not spelled differently'
                             % swiss)
        if not wrongs:
            raise SystemExit('de_germany.json: %r has no misspelling' % right)
        forms[swiss] = [right] + wrongs
    return forms


def load(lang):
    with io.open(os.path.join(SRC, '%s.json' % lang), encoding='utf-8') as f:
        data = json.load(f)
    levels = []
    for level in data['levels'][:FREE_LEVELS]:
        entries = []
        for w in level['words']:
            wrongs = [x for x in w['w'] if x and x != w['r']]
            if not wrongs:
                raise SystemExit('%s level %d: %r has no misspelling'
                                 % (lang, level['level'], w['r']))
            entries.append([w['r']] + wrongs)
        levels.append(entries)
    return levels


def voices(lang, levels, takes):
    """({right form -> clip object name}, how many are at a later take) for
    the levels the page reads out loud."""
    germany = germany_of(lang)
    revised = takes.get(lang, {})
    out = {}
    later = 0
    for entries in levels[:VOICE_LEVELS]:
        for e in entries:
            right = e[0]
            key = speech_key(germany.get(right, right))
            if key is None:
                raise SystemExit('%s: %r has nothing sayable' % (lang, right))
            vid = voice_id(lang, key)
            out[right] = voice_object(vid, revised.get(vid, 1))
            if revised.get(vid, 1) > 1:
                later += 1
    return out, later


def main():
    manifest, out_path = parse_args(sys.argv[1:])
    # first, so a manifest that cannot be had writes nothing at all
    takes, stamp = takes_of(read_manifest(manifest))
    out = io.StringIO()
    out.write('// GENERATED by make-words.py from ../SYVT/tool/words/*.json.\n')
    out.write('// Levels 1 to 5 of the words the Android game teaches: the\n')
    out.write('// four the free game plays, and the fifth, out of reach.\n')
    out.write('// Each entry is [correct, ...misspellings].\n')
    out.write('window.SYVT_WORDS = {\n')
    spoken = {}
    written = {}
    applied = 0
    for lang in LANGS:
        levels = load(lang)
        written[lang] = levels
        spoken[lang], later = voices(lang, levels, takes)
        applied += later
        out.write('  %s: [\n' % lang)
        for i, entries in enumerate(levels):
            out.write('    [ // level %d\n' % (i + 1))
            for e in entries:
                out.write('      %s,\n' % json.dumps(e, ensure_ascii=False))
            out.write('    ],\n')
        out.write('  ],\n')
        print('%s  %d levels, %d words, %d spoken, %d at a later take'
              % (lang, len(levels), sum(len(x) for x in levels),
                 len(spoken[lang]), later))
    out.write('};\n')
    print('manifest  %s, %d revisions, %d of them on the voiced levels'
          % (stamp or 'no generated_at',
             sum(len(x) for x in takes.values()), applied))

    out.write('\n')
    out.write('// The clip of every word the page can read out loud: the\n')
    out.write('// first %d levels, which is as far as the free voice goes.\n'
              % VOICE_LEVELS)
    out.write('// Keyed by the spelling the tile shows; for German the clip is\n')
    out.write("// Germany's spelling, which is the one the voice can read.\n")
    out.write("// Each value is the clip's object name: its id, or <id>.<take>\n")
    out.write('// for a word recorded again after release, from the corpus\n')
    out.write("// manifest's revisions when this file was written.\n")
    if stamp:
        out.write('// Takes from the corpus manifest generated %s.\n' % stamp)
    else:
        out.write('// Takes from a corpus manifest with no generated_at.\n')
    out.write('window.SYVT_CLIPS = {\n')
    for lang in LANGS:
        out.write('  %s: {\n' % lang)
        for right, obj in spoken[lang].items():
            out.write('    %s: "%s",\n'
                      % (json.dumps(right, ensure_ascii=False), obj))
        out.write('  },\n')
    out.write('};\n')

    germany = germany_forms()
    shown = [e[0] for level in written['de'] for e in level if e[0] in germany]
    out.write('\n')
    out.write("// Germany's spelling of the German words above that Switzerland\n")
    out.write('// writes with ss, keyed by the Swiss form and in the same\n')
    out.write('// [correct, ...misspellings] shape: what falls for a browser\n')
    out.write("// whose German is not Switzerland's or Liechtenstein's.\n")
    out.write('window.SYVT_GERMANY = {\n')
    for swiss in shown:
        out.write('  %s: %s,\n' % (json.dumps(swiss, ensure_ascii=False),
                                  json.dumps(germany[swiss], ensure_ascii=False)))
    out.write('};\n')
    print('de  %d of them spelled differently in Germany' % len(shown))

    with io.open(out_path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(out.getvalue())
    print('%s  %.1f KB' % (out_path, len(out.getvalue()) / 1024))


if __name__ == '__main__':
    main()
