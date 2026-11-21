# Strumming Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Python engine that turns a song's YouTube recording into rhythm data (meter, tempo, strumming pattern, chord durations), plus the editor tooling to link a recording, review the proposal by ear, correct it and save it next to the `.cho`.

**Architecture:** The engine (`rhythm/`) splits into a model-dependent audio stage (download, stems, beats, onset envelope, chroma → `features.json`) and a pure numpy analysis (features + `.cho` → `analysis.json` with ranked meter readings), both cached in `rhythm/.cache/`. The editor reads the cached analysis through local-only routes, plays it against the decoded recording on one `AudioContext`, and saves `<song>.rhythm.json` through a local API. Shared TypeScript (`shared/rhythm.ts`) owns the saved-file types, the chord-layout fingerprint and staleness.

**Tech Stack:** Python 3.14, numpy, librosa 1.0.0, Demucs 4.1.0, Beat This! 1.1.0, PyTorch 2.15.0, pytest; SvelteKit 3 / Svelte 5 runes, Playwright; `yt-dlp` and `ffmpeg` from Homebrew.

**Spec:** `docs/superpowers/specs/2026-11-09-strumming-engine-design.md`

**Repository rules for this run:** work on branch `feat/motore-ritmo`; do **not** commit (the maintainer commits after reviewing). Wherever a task would commit, leave the changes in the working tree.

## Global Constraints

- All user-facing text (editor UI, engine terminal messages) is in Italian; code, comments, identifiers in English, comments describing the present state only.
- Editor styles stay local to components and take colours, sizes, spacings and radii only from `shared/tokens.css` variables.
- Nothing is written to `canzoni/` except by the review page's "Salva" (the `.rhythm.json`) and by the existing song form (the `{x_youtube}` directive).
- Audio, stems and analyses live only in `rhythm/.cache/` (git-ignored, overridable with `RHYTHM_CACHE_DIR` for tests); the virtual environment in `rhythm/.venv/` (git-ignored).
- Editor, reader, PDF build and CI must work without Python audio libraries: the engine's pure modules import only numpy and the standard library; `engine/audio.py` is the only module importing librosa, soundfile, torch, demucs or beat_this, and it is imported lazily by the CLI.
- The review page and its routes are local-only: no link to them in online mode (`online` from `#lib/online.js`), and the load errors with 404 when `online` is true.
- `{x_youtube:<id>}`: `<id>` matches `/^[A-Za-z0-9_-]{11}$/`; stored without URL.
- Pattern strings use `D`, `U`, `.` only, one char per slot, length `beatsPerBar * slotsPerBeat`.
- Durations are whole beats of the meter, ≥ 1.
- Fingerprint: FNV-1a 32-bit over the string of chord counts per timed line joined by `,` (timed lines as `isTimedLine` in `shared/pauses.ts`), output `(hash >>> 0).toString(16)`; Python must produce the same string.

### Data formats (both sides must match exactly)

`rhythm/.cache/<category>/<slug>/analysis.json`, written by the engine, read by the editor:

```json
{
  "version": 1,
  "song": "canti_scout/la_gioia.cho",
  "video": "jv_i536nIvc",
  "analyzed": "2026-11-10",
  "audio": "audio.m4a",
  "fingerprint": "8c1f2a3b",
  "guitarShare": 0.92,
  "status": "heard",
  "transpose": 0,
  "chords": ["Do", "Fa", "Do", "Fa"],
  "readings": [
    {
      "meter": "6/8",
      "beatsPerBar": 2,
      "slotsPerBeat": 3,
      "score": 0.53,
      "bpm": 105.2,
      "beats": [0.312, 0.915],
      "beatChord": [0, 0],
      "pattern": "D..D..",
      "chorusPattern": null,
      "durations": [4, 4, 4, 4],
      "estimated": [false, false, false, false],
      "chordStarts": [0.312, 2.71, null, 7.5],
      "disagreements": [{ "chord": 7, "time": 22.1, "expected": "Sol", "heard": "Fa" }]
    }
  ]
}
```

`readings` is sorted by `score`, best first; `beats` are the meter's beats in seconds starting at a downbeat (bars are consecutive groups of `beatsPerBar`); `beatChord[k]` indexes `chords` or is `-1` (not aligned: intro, outro, noise); `chordStarts`, `durations`, `estimated` have one entry per `chords` item; `chords` is the `.cho` chord sequence in reading order (`songChords`).

`canzoni/<category>/<slug>.rhythm.json`, written by the review page:

```json
{
  "version": 1,
  "teaching": {
    "fingerprint": "8c1f2a3b",
    "status": "heard",
    "meter": "6/8",
    "beatsPerBar": 2,
    "slotsPerBeat": 3,
    "bpm": 105,
    "pattern": "D..D..",
    "chorusPattern": null,
    "durations": [4, 4],
    "estimated": [false, false]
  },
  "recording": {
    "video": "jv_i536nIvc",
    "analyzed": "2026-11-10",
    "transpose": 0,
    "beats": [0.312, 0.915],
    "chordStarts": [0.312, null],
    "disagreements": [{ "chord": 1, "time": 22.1, "expected": "Sol", "heard": "Fa" }]
  }
}
```

Seconds are rounded to milliseconds; `bpm` to an integer.

## Review Focus

1. A song without `{x_youtube}`: the engine stops with "La canzone non ha un link YouTube: aggiungilo nei metadati dall'editor." and exit code 1; the review page shows the command to run. (Task 4 test.)
2. A song without chords: the engine stops with "La canzone non ha accordi: non c'è niente da allineare." and exit code 1. (Task 4 test.)
3. The song is edited after the engine ran (cached `fingerprint` ≠ current): the review page warns "L'analisi è di una versione precedente della canzone: rilancia il motore." and disables "Salva". (Task 8 test.)
4. The link is changed after the engine ran (cached `video` ≠ song's `{x_youtube}`): the review page warns "L'analisi è di un'altra registrazione: rilancia il motore." and disables "Salva"; rerunning the engine clears the cache for the new video. (Task 8 test; Task 4 cache test.)
5. Switching meter reading resets pattern, durations and tempo from that reading, so a pattern of the wrong length can never be saved; `isRhythmFile` rejects one anyway. (Task 7 and Task 1 tests.)

---

### Task 1: Shared rhythm model, YouTube link and fingerprint

**Files:**
- Create: `shared/youtube.ts`, `shared/rhythm.ts`, `shared/fixtures/chord-layout.json`
- Modify: `shared/chordpro.ts` (SongMeta, parse, serialize), `editor/src/lib/directives.ts` (catalog + `'youtube'` value kind)
- Test: `editor/e2e/rhythm-shared.spec.ts`

**Interfaces:**
- Produces (`shared/youtube.ts`): `YOUTUBE_ID_RE: RegExp`; `youtubeId(input: string): string | null` (accepts a bare id and `youtube.com/watch?v=`, `m.`/`music.youtube.com`, `youtu.be/<id>`, `/shorts/<id>`, `/embed/<id>`, `/live/<id>`, with extra parameters; trims; else null); `youtubeUrl(id: string): string` → `https://www.youtube.com/watch?v=<id>`.
- Produces (`shared/chordpro.ts`): `SongMeta.youtube: string | null`; `{x_youtube:<valid id>}` parsed into it; an invalid value stays a `{ type: 'directive' }` line; serialized as `{x_youtube:<id>}` right after `{x_scroll}`.
- Produces (`shared/rhythm.ts`):
  - `type Stroke = 'D' | 'U' | '.'`
  - `interface SongChord { chord: string; line: number; text: string; chorus: boolean; block: number }` — `line` is the timed-line index, `text` the lyric line text, `block` increments at every empty line and chorus start/end.
  - `songChords(song: Song): SongChord[]` — chords of lyric lines in reading order.
  - `chordLayoutFingerprint(song: Song): string`
  - `interface RhythmTeaching`, `interface RhythmRecording`, `interface RhythmDisagreement { chord: number; time: number; expected: string; heard: string }`, `interface RhythmFile { version: 1; teaching: RhythmTeaching; recording: RhythmRecording }` with the fields of the saved format above.
  - `isRhythmFile(x: unknown): x is RhythmFile` — checks every field: version 1, status enum, meter `/^\d+\/\d+$/`, `beatsPerBar` 1–12, `slotsPerBeat` 1–4, bpm 20–300, pattern(s) `/^[DU.]+$/` of the right length, durations positive integers with `estimated` of equal length, video matches `YOUTUBE_ID_RE`, numbers finite.
  - `rhythmStaleness(file: RhythmFile, song: Song): { teaching: boolean; recording: boolean }` — teaching stale when the fingerprint differs; recording stale when teaching is stale, or `song.meta.youtube` is null or differs from `file.recording.video`.

- [ ] **Step 1: Write the failing tests** in `editor/e2e/rhythm-shared.spec.ts` (pure tests, importing `../../shared/...` like `pauses.spec.ts`):
  - `youtubeId` returns `jv_i536nIvc` for `jv_i536nIvc`, `https://www.youtube.com/watch?v=jv_i536nIvc&t=42s`, `https://youtu.be/jv_i536nIvc?si=x`, `https://m.youtube.com/watch?feature=share&v=jv_i536nIvc`, `https://www.youtube.com/shorts/jv_i536nIvc`, `https://www.youtube.com/embed/jv_i536nIvc`; returns null for `''`, `https://vimeo.com/123`, `jv_i536nIv` (10 chars), `https://www.youtube.com/watch?v=`.
  - `{x_youtube:jv_i536nIvc}` round-trips through `parse`/`serialize` and sets `meta.youtube`; `{x_youtube:nope}` parses to a `directive` line and `meta.youtube === null`.
  - `songChords` on `{title:T}\n\n[Do]uno [Fa]due\n{c:Rit.}\n\n{start_of_chorus}\n[Sol]tre\n{end_of_chorus}` returns chords `Do, Fa, Sol` with lines `0, 0, 2`, chorus `false, false, true`, and `Sol`'s block greater than `Fa`'s.
  - `chordLayoutFingerprint` is unchanged when a chord is renamed or transposed, changes when a chord is added or moved to another line, ignores pauses and empty lines.
  - every case of `shared/fixtures/chord-layout.json` (`[{ "source": string, "chords": string[], "fingerprint": string }]`) matches `songChords(...).map(c => c.chord)` and `chordLayoutFingerprint(...)`.
  - `rhythmStaleness`: same song → both false; chord added → both true; only link changed → `{ teaching: false, recording: true }`; link removed → recording true.
  - `isRhythmFile` accepts the saved-format example and rejects: pattern length ≠ `beatsPerBar*slotsPerBeat`, a `0` duration, mismatched `estimated` length, status `"maybe"`, video `"abc"`.
- [ ] **Step 2: Run** `cd editor && npx playwright test e2e/rhythm-shared.spec.ts` — expected: FAIL (modules missing).
- [ ] **Step 3: Implement** `shared/youtube.ts`, the `SongMeta.youtube` changes in `shared/chordpro.ts` (every `SongMeta` literal in the repo gains `youtube: null`; `npm run check` in both apps finds them), and `shared/rhythm.ts`. Build `shared/fixtures/chord-layout.json` with four cases: «La gioia» copied verbatim from `canzoni/canti_scout/la_gioia.cho`, the `songChords` example above, a song with a tab block and a comment, a song with no chords; fill `chords` and `fingerprint` from the TS implementation once it passes the other tests.
- [ ] **Step 4: Add the catalog entry** in `editor/src/lib/directives.ts`: `DirectiveSpec.value` gains `'youtube'`; spec `{ name: 'x_youtube', kind: 'custom', value: 'youtube', placeholder: 'id del video', description: 'video YouTube della registrazione (id di 11 caratteri)', suggest: true }` after `x_scroll`; the value check flags a non-matching value with `«x_youtube» vuole l'id di un video YouTube (11 caratteri)`. Add a case to the existing directive tests if a spec file covers `directives.ts` (`grep -l directives editor/e2e`), otherwise to `rhythm-shared.spec.ts`: `{x_youtube:abc}` is flagged, `{x_youtube:jv_i536nIvc}` is not.
- [ ] **Step 5: Run** `cd editor && npx playwright test e2e/rhythm-shared.spec.ts && npm run check && cd ../reader && npm run check` — expected: PASS, 0 errors.

### Task 2: Link field in the song form

**Files:**
- Modify: `editor/src/lib/components/SongEditor.svelte` (metadata form, around the `meta-scroll` label at line ~437)
- Test: `editor/e2e/rhythm-link.spec.ts`

**Interfaces:**
- Consumes: `youtubeId`, `youtubeUrl` (Task 1), `SongMeta.youtube`.

- [ ] **Step 1: Write the failing E2E test** `rhythm-link.spec.ts`: open `/edit/varie/stella_del_mattino.cho`, open the metadata form like the existing specs do, fill `[data-testid="meta-youtube"]` with `https://youtu.be/jv_i536nIvc?si=abc`, blur, save; the file `e2e/.tmp-songs/varie/stella_del_mattino.cho` contains `{x_youtube:jv_i536nIvc}`; reload: the field shows `https://www.youtube.com/watch?v=jv_i536nIvc`; fill `https://vimeo.com/1`, blur: `[data-testid="meta-youtube-error"]` reads `Link YouTube non valido` and the song's `meta.youtube` is unchanged; empty the field and save: the directive is gone. Restore the seed content at the end (as other specs do) so later specs see the original song.
- [ ] **Step 2: Run** `cd editor && npx playwright test e2e/rhythm-link.spec.ts` — expected: FAIL.
- [ ] **Step 3: Implement** a `<label>Registrazione (YouTube)<input type="url" … data-testid="meta-youtube"></label>` after the scroll field: shows `youtubeUrl(meta.youtube)` or empty; on `change`, empty → `meta.youtube = null`, valid → `meta.youtube = youtubeId(value)`, invalid → keep the typed text, show the error, leave `meta.youtube` unchanged. Available online too (it is song metadata).
- [ ] **Step 4: Run** the spec and `npm run check` — expected: PASS.

### Task 3: Engine core — `.cho` reading, chord templates, meter and pattern

**Files:**
- Create: `rhythm/engine/__init__.py`, `rhythm/engine/cho.py`, `rhythm/engine/harmony.py`, `rhythm/engine/meter.py`, `rhythm/engine/pattern.py`, `rhythm/pytest.ini`, `rhythm/requirements.txt`, `rhythm/requirements-test.txt`, `rhythm/tests/test_cho.py`, `rhythm/tests/test_harmony.py`, `rhythm/tests/test_meter.py`, `rhythm/tests/test_pattern.py`
- Modify: `.gitignore` (add `rhythm/.cache/`, `rhythm/.venv/`, `__pycache__/`, `.pytest_cache/`, `.superpowers/`)

**Interfaces:**
- Produces (`cho.py`): `@dataclass ChoChord(name: str, line: int, chorus: bool, block: int)`; `@dataclass ChoSong(title: str, youtube: str | None, chords: list[ChoChord], chord_counts: list[int], line_texts: list[str])` where `chord_counts`/`line_texts` have one entry per timed line; `parse_cho(text: str) -> ChoSong` mirroring `shared/chordpro.ts` (directive regex `^\{\s*([\w-]+)\s*(?::\s*(.*?)\s*)?\}\s*$`, `x_youtube` valid only when it matches the id regex, tab blocks as one timed line, `comment`/`c` timed, `[` without `]` is text); `chord_layout_fingerprint(song: ChoSong) -> str`.
- Produces (`harmony.py`): `chord_template(name: str) -> np.ndarray | None` (12-dim, unit norm; Latin roots `Do Re Mi Fa Sol La Si` with `#`/`b`; minor `m` (not `maj`), `7`, `maj7`, `sus2`, `sus4`, `dim`, `aug`; slash bass added at 0.5; root weight 1.0, other tones 0.8; None when the root cannot be parsed); `same_chord(a: str, b: str) -> bool` (equal templates).
- Produces (`meter.py`):
  - `@dataclass MeterCandidate(meter: str, beats_per_bar: int, slots_per_beat: int)`
  - `choose_subdivision(phase_profile: np.ndarray) -> int` — `phase_profile` is the mean onset strength at the 12 phases `k/12` of the tracker beat; returns 4 when the mean at phases 3 and 9 exceeds 0.75 × the value at phase 6, 3 when the mean at phases 4 and 8 exceeds the value at phase 6, else 2.
  - `bar_starts(downbeats: list[int], n_beats: int, beats_per_bar: int) -> list[int]` — tracker-beat indices where bars start: between consecutive downbeats, a gap that is a multiple of `beats_per_bar` yields that many bars, any other gap is skipped (re-anchor at the next downbeat); after the last downbeat, bars continue while complete.
  - `CANDIDATES: dict[int, list[MeterCandidate]]` keyed by pulses per bar: `4: [2/4 (2,2)]`, `6: [6/8 (2,3), 3/4 (3,2)]`, `8: [4/4 (4,2)]`, `9: [9/8 (3,3)]`, `12: [12/8 (4,3), 3/4 (3,4)]`, `16: [4/4 (4,4)]`.
  - `rank_meters(pulses_per_bar: int, profile: np.ndarray) -> list[tuple[MeterCandidate, float]]` — score = mean of `profile` at beat slots (`slot % slots_per_beat == 0`) minus mean at the others; best first.
- Produces (`pattern.py`): `CORE_FRACTION = 0.3`; `core_slots(strengths: np.ndarray) -> list[bool]` (rows = bars, columns = slots; a slot is core when its mean ≥ `CORE_FRACTION` × the highest slot mean); `strokes(core: list[bool], beats_per_bar: int, slots_per_beat: int) -> str`; `DEFAULT_PATTERNS: dict[tuple[str, int], str]` = `("4/4",2): "D.DU.UDU"`, `("4/4",4): "D...D...D...D..."`, `("3/4",2): "D.U.U."`, `("3/4",4): "D...D...D..."`, `("2/4",2): "D.DU"`, `("6/8",3): "D..D.."`, `("9/8",3): "D..D..D.."`, `("12/8",3): "D..D..D..D.."`.

Direction rule for `strokes` (write it in the module docstring too): with 2 or 4 slots per beat the hand swings on the slot grid, so even slots are `D` and odd slots `U`; with 3 slots per beat (compound meters) each beat is strummed down-down-up, so slot `k % 3` maps to `D`, `D`, `U`. Non-core slots are `.`.

- [ ] **Step 1: Write the failing tests**:
  - `test_cho.py`: parsing `shared/fixtures/chord-layout.json` sources gives the fixture's `chords` and `fingerprint` exactly (load the file via `Path(__file__).parents[2] / "shared/fixtures/chord-layout.json"`); `x_youtube` valid/invalid as in Task 1; chorus and block flags on the Task 1 `songChords` example.
  - `test_harmony.py`: `Do` has ones at 0, 4, 7; `Lam` at 9, 0, 4 with root weight on 9; `Re7` includes 0 (the 7th); `Sol/Si` adds 11; `same_chord("Do", "Do")`; `chord_template("X7")` is None.
  - `test_meter.py`: `choose_subdivision` → 2 for the spike profile (phase 0 = 0.48, phase 6 = 0.20, phases 3/9 = 0.14/0.10, phases 4/8 = 0.08/0.19, others 0.05), 3 when phases 4 and 8 are 0.4 and phase 6 is 0.1, 4 when phases 3, 6, 9 are 0.4; `bar_starts([0, 3, 6, 12, 13, 16], 20, 3) == [0, 3, 6, 9, 13, 16]`; `rank_meters(6, [1.04, 0.07, 0.17, 0.35, 0.23, 0.19])[0][0].meter == "6/8"` and the 3/4 score is lower; `rank_meters(8, …)` returns only 4/4.
  - `test_pattern.py`: a 10-bar matrix whose means are `[1.04, 0.07, 0.17, 0.35, 0.23, 0.19]` gives `core_slots == [True, False, False, True, False, False]` and `strokes(…, 2, 3) == "D..D.."`; all-core 4/4 eighths → `"DUDUDUDU"`; all-core 6/8 → `"DDUDDU"`; every `DEFAULT_PATTERNS` value has length `beats_per_bar * slots_per_beat` for its meter.
- [ ] **Step 2: Create the test environment and run**: `/opt/homebrew/bin/python3.14 -m venv rhythm/.venv-test && rhythm/.venv-test/bin/pip install -q -r rhythm/requirements-test.txt && rhythm/.venv-test/bin/python -m pytest rhythm/tests -q` — expected: FAIL (modules missing). `requirements-test.txt`: `numpy==2.5.4`, `pytest` pinned to the current release. `pytest.ini`: `[pytest]` with `pythonpath = .` and `testpaths = tests`. Add `rhythm/.venv-test/` to `.gitignore`.
- [ ] **Step 3: Implement** the four modules (numpy and stdlib only). `requirements.txt` pins the full engine set: `torch==2.15.0`, `torchaudio==2.11.1`, `demucs==4.1.0`, `beat-this==1.1.0`, `librosa==1.0.0`, `soundfile==0.14.0`, `soxr==1.1.0`, `einops==0.8.2`, `numpy==2.5.4`, `scipy==1.18.1`, `rotary-embedding-torch` and `pytest` at their current versions (check with `pip index versions`).
- [ ] **Step 4: Run** the pytest command — expected: PASS.

### Task 4: Engine analysis, audio stage, CLI and `make rhythm`

**Files:**
- Create: `rhythm/engine/align.py`, `rhythm/engine/durations.py`, `rhythm/engine/analysis.py`, `rhythm/engine/audio.py`, `rhythm/engine/cli.py`, `rhythm/engine/__main__.py`, `rhythm/README.md`, `rhythm/tests/test_align.py`, `rhythm/tests/test_durations.py`, `rhythm/tests/test_analysis.py`, `rhythm/tests/test_cli.py`, `rhythm/tests/fixtures/canti_scout/la_gioia.cho`, `rhythm/tests/fixtures/la_gioia_features.json`, `rhythm/tests/test_la_gioia.py`
- Modify: `Makefile` (targets `rhythm`, `rhythm-test`), `.github/actions/test-stack/action.yml`

**Interfaces:**
- Consumes: Task 3 modules.
- Produces (`align.py`):
  - `best_transposition(beat_chroma: np.ndarray, names: list[str]) -> int` — shift 0–11 maximizing the mean over beats of the best cosine similarity among the transposed templates of `names` (unique names, None templates skipped).
  - `similarities(beat_chroma: np.ndarray, names: list[str], shift: int) -> np.ndarray` — shape `(len(names), n_beats)`, cosine of each transposed template with each beat; rows of unparseable names are 0.
  - `align(sims: np.ndarray, section_starts: list[int], bar_start: np.ndarray) -> list[int]` — `sims` has one row per `.cho` chord (in sequence order); returns per beat the aligned chord index or -1.
  - `recognize(sims: np.ndarray, penalty: float = 2.5) -> list[int]` — free Viterbi over the rows (switching costs `penalty`, emissions `8 * sims`), as in the spike.
- Produces (`durations.py`):
  - `teaching_durations(beat_chord: list[int], chords: list[ChoChord], line_texts: list[str], beats_per_bar: int) -> tuple[list[int], list[bool]]`
  - `chord_starts(beat_chord: list[int], beat_times: list[float], n_chords: int) -> list[float | None]` — time of the first beat aligned to each chord.
  - `disagreements(beat_chord: list[int], heard: list[int], beat_times: list[float], chords: list[ChoChord], vocab: list[str], beats_per_bar: int) -> list[dict]` — `heard` indexes `vocab`; a run of at least `beats_per_bar` consecutive aligned beats where `not same_chord(vocab[heard[t]], chords[beat_chord[t]].name)` yields one `{"chord", "time", "expected", "heard"}` at the run start (time rounded to ms).
- Produces (`analysis.py`):
  - `@dataclass Features(beats: list[float], downbeats: list[int], onset: list[list[float]], chroma: list[list[list[float]]], guitar_share: float)` — `onset[k]` = 12 onset-strength samples at phases `j/12` of tracker beat `k` (envelope normalized by its 99th percentile, max over ±35 ms); `chroma[k]` = 6 chroma vectors (12 each) for the sixths of tracker beat `k`; `to_json()` / `from_json(d)`.
  - `GUITAR_SHARE_MIN = 0.3`
  - `analyze(features: Features, song: ChoSong, meta: dict) -> dict` — returns the `analysis.json` dict; `meta` carries `song`, `video`, `analyzed`, `audio`.
- Produces (`audio.py`, not unit-tested): `check_tools() -> None` (raises `EngineError` naming `yt-dlp`/`ffmpeg` and `brew install …`), `download(video: str, dest: Path) -> Path`, `prepare(source: Path, dest: Path) -> tuple[Path, Path]` (`stereo.wav` 44.1 kHz 2 ch for analysis, `audio.m4a` AAC 128k for the browser; the source may be 5.1), `separate(stereo: Path, stems: Path) -> None` (Demucs `htdemucs_6s` through `demucs.apply.apply_model`, `soundfile` I/O, `mps` when available, as the spike's `separate.py`), `extract_features(stereo: Path, stems: Path) -> Features` (Beat This! `File2Beats(checkpoint_path="final0", dbn=False)` on the mix; onset envelope `librosa.onset.onset_strength(lag=1, max_size=3)` on the guitar stem at 22050 Hz, hop 128; chroma `chroma_cqt` on `librosa.effects.harmonic` of the guitar stem — or of the sum of the non-vocal, non-drum stems when the guitar share is under `GUITAR_SHARE_MIN` — hop 512, aggregated by median into the sixths; `guitar_share` = RMS of the guitar stem over RMS of the sum of all non-vocal stems).
- Produces (`cli.py`): `class EngineError(Exception)`; `main(argv: list[str]) -> int`. Usage `python -m engine <song.cho> [--songs-dir DIR] [--cache-dir DIR] [--reanalyze]`; the song path is relative to `--songs-dir` (default `../canzoni` from `rhythm/`) or absolute.

`align` algorithm (not determined by the signature): Viterbi over states `0…N-1` (the `.cho` chords) plus `FREE` (index N). Emission of chord state `i` at beat `t` = `8 * sims[i, t]`; of `FREE` = `8 * median(sims[:, t]) - 1`. Transitions in log-score: stay 0; `i → i+1` costs 0.5 and gains 0.5 when `bar_start[t]`; any state → a section start `s` (other than `i+1`) costs 6; any → `FREE` costs 6; `FREE → FREE` 0; `FREE →` section start costs 3. Start in `FREE` or at a section start; end anywhere. `section_starts` are the indices of the first chord of each `block`. Tune the constants on the La gioia fixture; document the final values in the module.

`teaching_durations` algorithm: (1) measured duration of chord `i` = median length of its runs in `beat_chord` (rounded, ≥ 1); measured start-in-bar from its first run (`start % beats_per_bar == 0` means "starts on a downbeat"). (2) walking the chords in order with a running position, when chord `i+1` starts on a downbeat, round the end of chord `i` to the nearest bar boundary after its start, so the meter never breaks. (3) group lines by `(chorus, tuple of chord names on the line)`; each measured line contributes its duration vector; every line of the group takes the most common vector (estimated stays false for lines that were measured). (4) chords never measured take the group's value or, without one, `beats_per_bar`, with `estimated = True`.

`analyze` pipeline: phase profile → `choose_subdivision` → pulses (`sub` per tracker beat) and per-pulse strengths and times → `bar_starts` over tracker beats → pulses per bar = tracker beats per bar (mode of the downbeat gaps) × `sub` → `rank_meters` on the mean per-slot profile of complete bars → for each candidate: meter beats (pulse times every `slots_per_beat` pulses from each bar start), per-beat chroma (median of the sixths whose start falls in the beat), `similarities` with the global transposition, `align`, `teaching_durations`, `chord_starts`, `recognize` over the song's unique chord names plus `disagreements`, `core_slots` on the bar × slot strengths → `strokes`; chorus pattern from the bars whose first beat is aligned to a chorus chord, kept only when it differs; `bpm` = 60 / median beat interval; when `guitar_share < GUITAR_SHARE_MIN` the status is `proposed` and patterns come from `DEFAULT_PATTERNS` (fallback `"D" + "." * (n - 1)` repeated per beat when the meter/grid has no entry). Global: `transpose = best_transposition` over the tracker-beat chroma; `fingerprint = chord_layout_fingerprint(song)`; `chords = [c.name for c in song.chords]`. Round seconds to ms and scores/bpm to 2 decimals.

CLI flow: parse the song (errors: no link → "La canzone non ha un link YouTube: aggiungilo nei metadati dall'editor."; no chords → "La canzone non ha accordi: non c'è niente da allineare."; both exit 1 before importing `audio`); cache dir `<cache>/<category>/<slug>/`; if `video.txt` there differs from the link, empty the directory; unless `--reanalyze` and `features.json` exists, run `check_tools`, `download`, `prepare`, `separate` (skipped when the stems exist), `extract_features`, write `features.json` and `video.txt`; then `analyze` and write `analysis.json`; print a short Italian summary (meter, bpm, pattern, number of disagreements, status) and `Controlla e salva: http://localhost:5173/ritmo/<category>/<file>`. `EngineError` messages print without a traceback, exit 1.

- [ ] **Step 1: Write the failing tests**:
  - `test_align.py`: synthetic `sims` for a 4-chord song in 2 blocks (`[Do Fa] [Sol Do]`) over a recording "4 free beats, then each chord 4 beats, then the second block again" → `align` returns `[-1]*4 + [0]*4 + [1]*4 + [2]*4 + [3]*4 + [2]*4 + [3]*4`; `best_transposition` finds 2 when the chroma is built from the templates shifted by 2; `recognize` on a clean two-chord sequence returns it.
  - `test_durations.py`: two identical-chord lines where one was measured `[4, 4]` and the other not → both `[4, 4]`, the second `estimated`; a measured `[4, 5]` where the next line starts on a downbeat and `beats_per_bar = 2` → `[4, 4]`; a never-measured chord with no group → `beats_per_bar`, estimated; `disagreements` flags a 2-beat Fa inside an expected Sol run with `beats_per_bar = 2` and ignores a 1-beat one.
  - `test_analysis.py`: `analyze` on a small synthetic `Features` (12 bars of 4/4 eighths, strong onsets on beats and offbeats, chroma alternating Do/Sol every bar, song `[Do]uno\n[Sol]due` repeated) returns `readings[0].meter == "4/4"`, `pattern == "DUDUDUDU"`, `durations` all 4, `status == "heard"`; with `guitar_share = 0.1` → `status == "proposed"` and `pattern == "D.DU.UDU"`; the top-level and reading-level key sets equal those of `editor/e2e/fixtures/rhythm-analysis.json` (created in Task 8 — until then compare with the key list in this plan's "Data formats" section, and switch to the file in Task 8).
  - `test_cli.py`: `main([path])` on a temp song without `{x_youtube}` returns 1 and prints the no-link message; on a song with a link and no chords returns 1 with the no-chords message; neither imports `engine.audio` (`"engine.audio" not in sys.modules`).
- [ ] **Step 2: Run** `rhythm/.venv-test/bin/python -m pytest rhythm/tests -q` — expected: FAIL.
- [ ] **Step 3: Implement** `align.py`, `durations.py`, `analysis.py`, `cli.py`, `__main__.py` (calls `sys.exit(main(sys.argv[1:]))`), then `audio.py`. Makefile:
  ```make
  RHYTHM_PYTHON ?= python3.14

  rhythm:
  	@test -n "$(SONG)" || { echo "uso: make rhythm SONG=categoria/canzone.cho"; exit 1; }
  	@command -v $(RHYTHM_PYTHON) >/dev/null || { echo "serve Python 3.14: brew install python@3.14"; exit 1; }
  	@test -x rhythm/.venv/bin/python || { $(RHYTHM_PYTHON) -m venv rhythm/.venv && rhythm/.venv/bin/pip install -q -r rhythm/requirements.txt; }
  	cd rhythm && .venv/bin/python -m engine $(SONG)

  rhythm-test:
  	@test -x rhythm/.venv-test/bin/python || { $(RHYTHM_PYTHON) -m venv rhythm/.venv-test && rhythm/.venv-test/bin/pip install -q -r rhythm/requirements-test.txt; }
  	rhythm/.venv-test/bin/python -m pytest rhythm/tests -q
  ```
  (add both to `.PHONY`). `rhythm/README.md`: prerequisites (`brew install python@3.14 yt-dlp ffmpeg`), first-run downloads (~1–2 GB of Python packages, ~160 MB of model weights), usage, cache layout, `--reanalyze`, the direction rule, how to update `yt-dlp` when downloads fail.
- [ ] **Step 4: Run** the pytest command — expected: PASS.
- [ ] **Step 5: Run the engine for real**: add `{x_youtube:jv_i536nIvc}` to a scratch copy of the song only if `canzoni/canti_scout/la_gioia.cho` lacks it — do **not** edit `canzoni/` for this: copy `canzoni/canti_scout/la_gioia.cho` to `rhythm/tests/fixtures/canti_scout/la_gioia.cho`, add the directive there, and run `cd rhythm && .venv/bin/python -m engine canti_scout/la_gioia.cho --songs-dir tests/fixtures --cache-dir .cache` after `make rhythm`'s venv exists (create it with the Makefile's venv line). Expected: summary with meter `6/8`, bpm 100–110, pattern `D..D..`, status `heard`, at least one disagreement expecting `Sol`. Copy the produced `features.json` to `rhythm/tests/fixtures/la_gioia_features.json` (round floats to 3 decimals to keep it small).
- [ ] **Step 6: Write and pass the regression test** `test_la_gioia.py`: `analyze(Features.from_json(fixture), parse_cho(fixture .cho), meta)` gives `readings[0]` with meter `6/8`, `100 <= bpm <= 110`, pattern `D..D..`; the four chords of the first verse line (indices 4–7) last 4 beats each and every chord of the first verse (indices 4–19) lasts a whole number of bars; a disagreement with `expected == "Sol"` and `heard == "Fa"` within 3 s of 22 s and another within 3 s of 41 s; `readings[1].meter == "3/4"`. If a criterion cannot be met by tuning the documented constants, keep the test for what is met, mark the rest `xfail` with the reason, and report it.
- [ ] **Step 7: CI** — in `.github/actions/test-stack/action.yml`, before "Vet backend": a step `uses: actions/setup-python@v6` with `python-version: '3.14'`, then `Test rhythm engine (pure parts)` running `pip install -r rhythm/requirements-test.txt && python -m pytest rhythm/tests -q`. Update the action's `description` to mention the engine tests.

### Task 5: Shared audio

**Files:**
- Move: `reader/src/lib/audio.ts` → `shared/audio.ts`
- Modify: `shared/diagrams.ts` (export `OPEN_MIDI`, add `chordMidi`), `reader/src/lib/harmony.ts` (import `OPEN_MIDI` from shared), the six reader components importing `#lib/audio.js`: `StrumTrainer`, `ChordHelp`, `StringTuner`, `CapoFinder`, `ChordChange`, `FretboardMap`
- Test: `editor/e2e/rhythm-shared.spec.ts` (one more case)

**Interfaces:**
- Produces (`shared/audio.ts`): everything `audio.ts` exports today, unchanged, plus `audioContext(): AudioContext | null` (the shared lazily-created context, resumed when suspended).
- Produces (`shared/diagrams.ts`): `OPEN_MIDI = [40, 45, 50, 55, 59, 64]`; `chordMidi(latinChord: string): (number | null)[] | null` — MIDI per string from the 6ª to the 1ª of `getChordDefinition`'s shape (frets above position 1 offset by `base - 1`), null strings when muted, null when no definition.

- [ ] **Step 1: Write the failing test**: `chordMidi("Do")` equals `[null, 48, 52, 55, 60, 64]`, `chordMidi("Xyz")` is null. (`shared/diagrams.ts` imports a JSON file; if Playwright's loader rejects that import in a pure spec, assert the same through `page.evaluate` on a page that bundles it, or move the case to Task 8's E2E.)
- [ ] **Step 2: Run** `cd editor && npx playwright test e2e/rhythm-shared.spec.ts` — expected: FAIL.
- [ ] **Step 3: Move and rewire** (`git mv`), imports become `@canzoniere/shared/audio`; implement `chordMidi` and `audioContext`.
- [ ] **Step 4: Run** the spec, `cd reader && npm run check && npm test`, `cd editor && npm run check` — expected: PASS.

### Task 6: Editor server: rhythm files, cache, routes

**Files:**
- Create: `editor/src/lib/rhythm-model.ts` (only the `AnalysisReading` and `RhythmAnalysis` types of Task 7, which adds the functions), `editor/src/lib/server/rhythm.ts`, `editor/src/routes/api/rhythm/[category]/[file]/+server.ts`, `editor/src/routes/api/rhythm/[category]/[file]/audio/+server.ts`
- Modify: `editor/src/lib/server/songs.ts` (export `songsPath`, `moveSong`, `deleteSong`), `editor/playwright.config.ts` (env `RHYTHM_CACHE_DIR: 'e2e/.tmp-rhythm-cache'`), `editor/e2e/global-setup.ts`
- Test: `editor/e2e/rhythm-files.spec.ts`

**Interfaces:**
- Consumes: `isRhythmFile`, `RhythmFile` (Task 1).
- Produces (`songs.ts`): `songsPath(...parts: string[]): string` (today's `safeJoin`, exported); `moveSong` moves `<slug>.rhythm.json` to the new category when present (refusing, like the `.cho`, if the target already has one); `deleteSong` deletes it when present. `deleteCategory` needs no change beyond these.
- Produces (`server/rhythm.ts`):
  - `rhythmFileName(file: string): string` — `la_gioia.cho` → `la_gioia.rhythm.json`
  - `readRhythm(category: string, file: string): Promise<RhythmFile | null>` (null when missing or invalid)
  - `writeRhythm(category: string, file: string, data: RhythmFile): Promise<void>`
  - `CACHE_DIR` = `path.resolve(process.env.RHYTHM_CACHE_DIR ?? path.join(process.cwd(), '..', 'rhythm', '.cache'))`
  - `readAnalysis(category: string, file: string): Promise<RhythmAnalysis | null>` (from `<CACHE_DIR>/<category>/<slug>/analysis.json`; `RhythmAnalysis` from `#lib/rhythm-model.js`)
  - `analysisAudioPath(category: string, file: string): Promise<string | null>` — the `audio` file named in the analysis, when it exists.
- Produces (routes): `PUT /api/rhythm/<category>/<file>` with a `RhythmFile` body → 400 when `!isRhythmFile`, 404 when the song does not exist, else writes and returns `{ ok: true }`; `GET /api/rhythm/<category>/<file>/audio` streams the cached audio (`audio/mp4` for `.m4a`, `audio/wav` for `.wav`) or 404.

- [ ] **Step 1: Write the failing tests** `rhythm-files.spec.ts` (API-level with `request`): global-setup seeds `varie/ritmo_di_prova.cho` (`{title:Ritmo di prova}\n{tag:Varie}\n{x_youtube:jv_i536nIvc}\n\n[Do]Prima riga [Sol]qui\n[Do]Seconda [Sol]riga\n`); PUT a valid `RhythmFile` (fingerprint from `chordLayoutFingerprint`) → 200 and the file exists next to the `.cho`; PUT with pattern `"DX"` → 400; PATCH `/api/songs/varie/ritmo_di_prova.cho` to `clan` → the rhythm file is now in `clan/` and not in `varie/`; move it back; DELETE a throwaway song created for the test that has a rhythm file → both files gone; GET audio for a song without cache → 404.
- [ ] **Step 2: Run** `cd editor && npx playwright test e2e/rhythm-files.spec.ts` — expected: FAIL.
- [ ] **Step 3: Implement** the server module, the `songs.ts` changes, the routes, the config env and the seed.
- [ ] **Step 4: Run** the spec and the full editor suite (`npm test`) — expected: PASS.

### Task 7: Review model and player

**Files:**
- Modify: `editor/src/lib/rhythm-model.ts` (types from Task 6)
- Create: `editor/src/lib/rhythm-player.ts`
- Test: `editor/e2e/rhythm-model.spec.ts`

**Interfaces:**
- Consumes: `SongChord`, `RhythmFile`, `Stroke` (Task 1); `audioContext`, `playClick`, `playStrum`, `now` (Task 5); `chordMidi` (Task 5).
- Produces (`rhythm-model.ts`):
  - `interface AnalysisReading` and `interface RhythmAnalysis` — exactly the `analysis.json` format above.
  - `interface ReviewState { reading: number; bpm: number; pattern: string; chorusPattern: string | null; durations: number[]; estimated: boolean[]; status: 'heard' | 'proposed' }`
  - `initialState(analysis: RhythmAnalysis, saved: RhythmFile | null, fingerprint: string): ReviewState` — from `saved.teaching` when its fingerprint equals `fingerprint` and its meter and grid match one of the readings (that reading selected), else from `readings[0]` and `analysis.status`.
  - `selectReading(analysis: RhythmAnalysis, index: number, status: ReviewState['status']): ReviewState` — pattern, chorus pattern, durations, estimated and `Math.round(bpm)` from that reading.
  - `setDuration(state: ReviewState, chord: number, beats: number): ReviewState` — clamps to ≥ 1, clears `estimated[chord]`.
  - `confirmDuration(state: ReviewState, chord: number): ReviewState` — clears `estimated[chord]`.
  - `cycleSlot(pattern: string, slot: number): string` — `D → U → . → D`.
  - `interface BarSegment { chord: number; beats: number }`, `teachingBars(durations: number[], beatsPerBar: number): BarSegment[][]` — splits chords across bar lines; a trailing incomplete bar is kept.
  - `interface PlayEvent { at: number; kind: 'click' | 'strum'; accent: boolean; chord: number; down: boolean }` (`chord` = index into the song's chords, -1 for none; `down` only meaningful for strums)
  - `recordingEvents(reading: AnalysisReading, pattern: string, chorusPattern: string | null, chorus: boolean[]): PlayEvent[]` — slot times interpolated between `reading.beats`; clicks on beats (accent on bar starts); strums on non-`.` slots with the chord of `beatChord`, skipped when -1; the chorus pattern on beats aligned to chorus chords.
  - `teachingEvents(state: ReviewState, reading: AnalysisReading, chorus: boolean[]): PlayEvent[]` — the same from time 0 at `state.bpm` through `state.durations`.
  - `toRhythmFile(state: ReviewState, analysis: RhythmAnalysis): RhythmFile` — teaching from the state and the selected reading's meter and grid; recording from the analysis and the selected reading (beats and times rounded to ms).
- Produces (`rhythm-player.ts`): `createPlayer(): { load(url: string): Promise<void>; play(events: PlayEvent[], opts: { from: number; recording: boolean; click: boolean; strum: boolean; chords: string[] }): void; stop(): void; position(): number; playing(): boolean }` — decodes the recording into an `AudioBuffer` on `audioContext()`, starts it with an `AudioBufferSourceNode` at offset `from`, schedules events with a 0.14 s look-ahead pumped every 25 ms (as `StrumTrainer`), so recording and overlay share one clock; `position()` returns song seconds.

- [ ] **Step 1: Write the failing tests** (pure): an analysis literal with two readings (4/4 and 2/4) for a 2-chord song; `initialState` without saved data takes reading 0; with a saved file whose fingerprint differs it ignores it; `selectReading(…, 1, …)` gives the 2/4 pattern and durations; `setDuration` clamps 0 to 1 and clears `estimated`; `cycleSlot("D.", 1) === "DU"`, `cycleSlot("DU", 1) === "D."`; `teachingBars([6, 2], 4)` is `[[{0,4}], [{0,2},{1,2}]]`; `recordingEvents` on beats `[0, 0.5, 1, 1.5]`, pattern `"DUDUDUDU"`, `beatChord [0,0,1,1]` has 4 clicks (one accented) and 8 strums, the last four on chord 1; `teachingEvents` at 120 bpm with durations `[4]` ends its last strum before 2 s; `toRhythmFile` output passes `isRhythmFile`.
- [ ] **Step 2: Run** `cd editor && npx playwright test e2e/rhythm-model.spec.ts` — expected: FAIL.
- [ ] **Step 3: Implement** both modules.
- [ ] **Step 4: Run** the spec and `npm run check` — expected: PASS.

### Task 8: Review page

**Files:**
- Create: `editor/src/routes/ritmo/[category]/[file]/+page.server.ts`, `editor/src/routes/ritmo/[category]/[file]/+page.svelte`, `editor/src/lib/components/PatternEditor.svelte`, `editor/src/lib/components/ChordDurations.svelte`, `editor/e2e/fixtures/rhythm-analysis.json`
- Modify: `editor/e2e/global-setup.ts` (write the fixture analysis — with the real fingerprint of `ritmo_di_prova.cho` — and a 3-second 22050 Hz mono 16-bit WAV of silence as `audio.wav` into `e2e/.tmp-rhythm-cache/varie/ritmo_di_prova/`), `rhythm/tests/test_analysis.py` (compare keys with the new fixture)
- Test: `editor/e2e/rhythm-review.spec.ts`

**Interfaces:**
- Consumes: Tasks 1, 6, 7.
- Produces: page `/ritmo/<category>/<file>`; load returns `{ category, file, content, analysis, saved, fingerprint }` and errors 404 when `online` or the song is missing.

Page content (Italian copy fixed here; layout is the builder's, in the editor's look):
- Title "Ritmo — <titolo>", breadcrumb back to the song's edit page.
- No analysis: "Nessuna analisi per questa canzone." and the command `make rhythm SONG=<category>/<file>` in a `<code data-testid="rhythm-command">`; when the song has no link, the line "Prima aggiungi il link YouTube nei metadati." above it.
- Analysis of another video (`analysis.video !== meta.youtube`): notice `data-testid="rhythm-other-video"` "L'analisi è di un'altra registrazione: rilancia il motore." and the command; "Salva" disabled.
- Analysis of an older song version (`analysis.fingerprint !== fingerprint`): notice `data-testid="rhythm-old-song"` "L'analisi è di una versione precedente della canzone: rilancia il motore."; "Salva" disabled.
- Listening: a toggle "Sulla registrazione" / "Versione da imparare" (`data-testid="rhythm-mode"`), buttons "▶ Ascolta" / "■ Ferma" (`rhythm-play`), switches "Click" and "Chitarra".
- Meter select `data-testid="rhythm-meter"` with one option per reading (`6/8`, `3/4`…), tempo number input `rhythm-bpm`, status select `rhythm-status` ("Ascoltato dalla registrazione" = heard, "Proposto" = proposed).
- `PatternEditor` (`data-testid="pattern"`, one button per slot `pattern-slot-<i>` showing ↓ ↑ ·, counts above them: `1 e 2 e…` for 2 slots per beat, `1 2 3 4 5 6` for 6/8, `1 e & a…` for 4); a second one labelled "Ritornello" when `chorusPattern` is not null.
- `ChordDurations`: bars from `teachingBars`; each chord shows its name, the start of its lyric (from `songChords`), its duration with `−`/`+` (`duration-minus-<i>`, `duration-plus-<i>`, value `duration-<i>`), and, when estimated, a mark "stimata" (`estimated-<i>`) that a click confirms; during playback the current chord is highlighted; in recording mode clicking a chord seeks to `chordStarts[i]` when not null.
- Disagreements list (`data-testid="disagreements"`): "0:22 · «pen-sieri» · nel .cho Sol, nella registrazione Fa", each seeking there.
- "Salva" (`rhythm-save`) PUTs `toRhythmFile(...)` and shows "Salvato." on success, the server error otherwise.

- [ ] **Step 1: Write the fixture and the failing E2E tests** `rhythm-review.spec.ts`: with the fixture, the page shows meter `4/4` selected, 8 pattern slots `D.DU.UDU`, two chords with durations 4 and 4, the second marked "stimata", one disagreement; clicking `pattern-slot-1` makes it ↓; `duration-plus-0` makes `duration-0` read 5 and the bars reflow; `rhythm-play` starts and `■ Ferma` appears (no audio assertions); "Salva" writes `e2e/.tmp-songs/varie/ritmo_di_prova.rhythm.json` whose `teaching.pattern` is `DDDU.UDU` and `durations` `[5, 4]`; switching the meter to the second reading resets pattern and durations; after changing the song's link via the API (PUT `.cho` with another id) the page shows `rhythm-other-video` and the save button is disabled; after adding a chord to the song it shows `rhythm-old-song`; a song without cache shows `rhythm-command` with `make rhythm SONG=varie/stella_del_mattino.cho`. Restore the song content at the end.
- [ ] **Step 2: Run** `cd editor && npx playwright test e2e/rhythm-review.spec.ts` — expected: FAIL.
- [ ] **Step 3: Implement** the load, page and components; switch the Python key-set test to read `editor/e2e/fixtures/rhythm-analysis.json`.
- [ ] **Step 4: Run** the spec, `npm run check`, and `rhythm/.venv-test/bin/python -m pytest rhythm/tests -q` — expected: PASS.

### Task 9: Song page notices and link

**Files:**
- Modify: `editor/src/routes/edit/[category]/[file]/+page.server.ts` (load `saved` via `readRhythm`, local only), `editor/src/routes/edit/[category]/[file]/+page.svelte`
- Test: `editor/e2e/rhythm-review.spec.ts` (more cases)

**Interfaces:**
- Consumes: `readRhythm` (Task 6), `rhythmStaleness` (Task 1).

Local mode only (nothing changes online): a link "Ritmo" (`data-testid="rhythm-link"`) to `/ritmo/<category>/<file>` when the song has a link or saved rhythm data; with saved data, `rhythmStaleness` against the song being edited: teaching stale → notice `rhythm-stale-teaching` "Il ritmo salvato è da rifare: gli accordi sono cambiati." linking to the review page; else recording stale → notice `rhythm-stale-recording` "La registrazione è cambiata: rilancia il motore per aggiornare i tempi."

- [ ] **Step 1: Write the failing tests**: with the file saved in Task 8's test (or written by the test itself), the edit page of `ritmo_di_prova.cho` shows `rhythm-link` and neither notice; after changing only the link → `rhythm-stale-recording`; after adding a chord → `rhythm-stale-teaching`; the edit page of `stella_del_mattino.cho` (no link, no data) shows no `rhythm-link`.
- [ ] **Step 2: Run** — expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the full editor suite and `npm run check` — expected: PASS.

### Task 10: Documentation and full verification

**Files:**
- Modify: `AGENTS.md`, `ARCHITECTURE.md`

- [ ] **Step 1: Update `AGENTS.md`**: repository layout gains `rhythm/` (engine, `make rhythm SONG=…`, `make rhythm-test`, cache, README) and the `*.rhythm.json` files next to the songs; the `{x_youtube:<id>}` directive in the `canzoni/` bullet; `shared/` lists `youtube.ts`, `rhythm.ts`, `audio.ts` (moved from the reader), `fixtures/`; the web editor section describes the link field and the local-only "Ritmo" review page; the reader's modules list drops `audio.ts` (now shared); CI section mentions the Python step.
- [ ] **Step 2: Update `ARCHITECTURE.md`** in the matching sections (directory structure, `.cho` format, editor routes and API endpoints).
- [ ] **Step 3: Full verification**: `make rhythm-test`; `cd editor && npm run check && npm test && VITE_ONLINE=1 BASE_PATH=/editor npm run build`; `cd reader && npm run check && npm test && BASE_PATH=/app npm run build`; `cd printer && go vet ./... && go build -o /dev/null .`. Expected: all green; the online editor build has no `ritmo/` pages (`ls editor/build | grep -c ritmo` → 0).
- [ ] **Step 4: Real run**: with the venv from Task 4, `cd rhythm && .venv/bin/python -m engine canti_scout/la_gioia.cho --songs-dir tests/fixtures --cache-dir .cache --reanalyze` succeeds; then start the editor against a temporary copy of the songs that includes the fixture song with its link (`SONGS_DIR=<tmp> RHYTHM_CACHE_DIR=../rhythm/.cache npm run dev`), open `/ritmo/canti_scout/la_gioia.cho` (the cache path must match: copy the fixture into `<tmp>/canti_scout/`), and check it loads with meter 6/8 and plays. Report what was and was not checked by hand.
