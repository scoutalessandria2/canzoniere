# Strumming engine: rhythm data from a recording

## Intent

The "Impara la chitarra" section of the reader teaches strumming with three
fixed patterns (`reader/src/lib/components/StrumTrainer.svelte`). What people
actually get stuck on is the strumming of a specific song: when to go down,
when to go up and how fast. Nobody in the group knows it for every song,
including the person who teaches it at camp, who plays it by feel.

The idea is to derive that knowledge from a recording: given the chords of a
song (already in its `.cho`) and a recording of it on YouTube, an engine
extracts the meter, the tempo, the strumming pattern and how long each chord
lasts. The result is reviewed by ear by the maintainer and saved statically
in the repository next to the song, so a later reader feature can let people
play the whole song in time, with the chord changes at the right moment.

This document covers the engine and the editor tooling around it. The reader
UI that uses the data is a separate, later project: a throwaway prototype of
three possible views exists (https://claude.ai/artifact/1BnTwTqAA6o5uoWrPXti9c),
but the maintainer could not judge it without real data, which is why the
engine comes first.

## What the spike showed

A throwaway spike ran the pipeline on «La gioia» (`canti_scout/la_gioia.cho`)
against https://www.youtube.com/watch?v=jv_i536nIvc (a live voice-and-guitar
recording, 3:47). The maintainer listened to the original with a click and
with a synthesized strum overlaid, and confirmed both were in time.

| Step | Tool | Result |
|---|---|---|
| Download | `yt-dlp` (Homebrew) | the audio track was 5.1; it has to be downmixed to stereo before anything else |
| Stems | Demucs `htdemucs_6s` via `demucs.apply.apply_model` | guitar and vocals only; drums, bass and piano near zero |
| Beats, downbeats | Beat This! (`beat-this==1.1.0` from PyPI, checkpoint `final0`) | 578 beats, bars of 3 beats, tempo drifting from ~143 to ~167 BPM over the song (live performance) |
| Guitar hits | librosa onset strength on the guitar stem, sampled on the beat grid | hits fall on the beat and halfway between beats, never on thirds: an eighth-note grid |
| Meter | accent profile over the six eighths of a bar: 1.04, 0.07, 0.17, 0.35, 0.23, 0.19 | the strong second accent on the 4th eighth means 6/8, not the 3/4 the beat tracker implied; ~105 dotted-quarter BPM median |
| Pattern | per-bar hits thresholded | "1 and 4" in about half the bars, "1" only in a quarter, fills on 5 or 6 in about a fifth: no single repeated pattern |
| Chords | beat-synchronous chroma vs templates of the song's own chords, 12 transpositions tried, Viterbi smoothing | recording in the `.cho` key; two bars per chord in the verse, matching the `.cho`; where the `.cho` has two bars of Sol ("pen-sieri" ~0:22, "tra-monto" ~0:41) the recording seems to play one bar of Fa and one of Sol |
| Direction | lag between the low band (70–250 Hz) and the high band (1.2–5 kHz) rising, per hit | barely measurable: 55% low-first on the 1st eighth, ~42% on the 4th to 6th. Not usable hit by hit |

Lessons that shape the design:

- Beats, tempo and chord timing are reliable, at least when the guitar is
  audible.
- The meter is a musical ambiguity the beat tracker does not resolve; the
  accent profile does, and the maintainer confirms it.
- Strum direction cannot be heard reliably; it comes from a convention about
  how the strumming hand moves, editable by the maintainer.
- A real guitarist varies the pattern bar by bar: the engine has to summarize
  it into one pattern to teach, and a person has to confirm it by ear.
- The recording can disagree with the `.cho`.
- Model choice is not the bottleneck: the two neural models used (Demucs,
  Beat This!) are among the best freely available, and the open problems
  above are about meaning, not accuracy.

The spike's scripts (`separate.py`, `analyze.py`, `direction.py`,
`render.py`) live outside the repository, in the session's scratchpad; they
are reference material, not code to keep.

## Goals

- A YouTube link per song, entered by the maintainer in the editor's song
  metadata form and stored in the `.cho`.
- An engine the maintainer runs on their Mac for one song at a time. It
  downloads the recording, analyzes it and writes a proposal: meter, teaching
  tempo, strumming pattern, the duration of every chord of the `.cho`, the
  recording's beat times, and the places where the recording's chords
  disagree with the `.cho`.
- A review page in the local editor where the maintainer listens to the
  recording with a click and a synthesized strum of the proposal overlaid,
  sees the bars with their chords and the flagged disagreements, corrects
  meter, tempo and pattern, listens again and saves.
- The saved rhythm data lives in the repository next to the song, readable by
  the web apps without Python, and is recognisably stale when the song's
  chords change afterwards.
- Songs whose recording has no audible guitar still get meter and tempo, with
  a typical pattern for the meter marked as "proposed" rather than "heard".

## Non-goals

- Any reader UI. The data is produced and stored; showing it on the song
  page, the play-along views, the "Impara" integration and playing along
  with the recording are a later project.
- Running the engine in CI, on the backend or in the browser.
- Changing the `.cho` from the engine. The only `.cho` change in this
  project is the link directive, entered by hand in the editor.
- Recognizing chords for songs that have none, or rewriting the chords of a
  song to match its recording.
- Tempo curves in the teaching data. The recording's beat times are stored
  as they are, but the teaching tempo is a single number.
- Training a model. Detecting strum direction with a guitar transcription
  model may be tried later as a separate experiment.
- Batch processing of the whole songbook. One song per run; a loop in the
  shell is enough if ever needed.

## Anti-goals

- Data that looks authoritative but nobody listened to: nothing is written to
  the repository without the review page's explicit save, and a pattern that
  was not derived from an audible guitar says so.
- Audio in the repository, or anything that redistributes the recording:
  only numbers derived from it are committed.
- Making Python, PyTorch or the models a requirement for anything other than
  running the engine. The editor (including the review page, given a cached
  analysis), the reader, the PDF build and CI keep working on a machine
  without them.
- Silent drift: rhythm data computed for one version of a song's chords is
  never presented as valid for another.

## Decisions made by the maintainer

- Engine first, UI later.
- The source recording is a YouTube video, one per song, chosen by the
  maintainer and entered in a new field of the editor's song metadata form.
- The engine is run by the maintainer on their Mac, with a command, one song
  at a time; it does not run by itself on GitHub.
- Review happens in an editor page: listen to the original with click and
  synthesized strum, see bars and chords, change meter, tempo and pattern,
  listen again, save. A plain "listen to files and confirm" flow was
  considered and rejected.
- When the recording and the `.cho` disagree, the `.cho` wins; the engine
  only flags the differences.

## Decisions made in the design (the maintainer can still override them)

### Language and location

The engine is a Python program in a new top-level directory `rhythm/`, next
to `printer/` and `backend/`. The audio models exist only in the Python
ecosystem; Go and TypeScript have nothing comparable. It is run from the
repository root through a `make` target taking the song path relative to
`canzoni/` (e.g. `make rhythm SONG=canti_scout/la_gioia.cho`); the target
creates the virtual environment on first use.

Constraints found in the spike:

- The Mac's default `python3` is 3.15, for which PyTorch has no wheels;
  Homebrew's `python@3.14` works. The `make` target uses an explicit,
  supported interpreter and says how to install it if missing.
- Dependencies are pinned (`requirements.txt` or `pyproject.toml` with a
  lock). Beat This! comes from PyPI (`beat-this`), not from GitHub.
- `yt-dlp` and `ffmpeg` are system tools (Homebrew), checked at start with a
  clear message when missing or failing (YouTube breaks `yt-dlp` regularly;
  the fix is updating it).
- Model weights download on first use (Demucs ~80 MB, Beat This! ~77 MB) into
  the usual user caches.
- Demucs is driven through its Python API with `soundfile` for I/O; its CLI
  saves through `torchaudio`, whose backends changed in recent versions.

### Link directive

`{x_youtube:<video id>}` in the song header, one per song. The editor field
accepts any YouTube URL form (`watch?v=`, `youtu.be/`, `shorts/`, with or
without extra parameters) and stores the bare 11-character id; an empty
field removes the directive. It is part of `SongMeta` in
`shared/chordpro.ts`, parsed and serialized like `{x_scroll:N}`, and listed
in the directive catalog of `editor/src/lib/directives.ts` (value checked as
a video id, suggested by the autocomplete). Like the other `x_` directives it
is ignored by the ChordPro CLI and by `printer/`, so the PDFs do not change.
The field also works in the online editor, since it is ordinary song
metadata saved through the existing pull request flow.

### Where the data lives

One JSON file per song, next to its `.cho`, with the same base name:
`canzoni/canti_scout/la_gioia.rhythm.json`. Everything rhythm-related is in
that one machine-written file, not split between directives and JSON: the
review page is the way to edit it. The `.cho` keeps only the link.

Because the file sits in the song's directory, the editor's local song
operations must carry it along: `moveSong` moves it, `deleteSong` deletes it,
`deleteCategory` (which moves the songs out and then removes the directory
with `fs.rmdir`, which fails on a non-empty directory) moves it with its
song, and `renameCategory` needs nothing because it renames the directory.
The song lists keep filtering on `.cho`, so the JSON files never show up as
songs.

### What the file contains

The exact schema is the builder's, but it carries at least:

- a format version;
- the source: the video id the analysis came from, and the analysis date;
- the status: `heard` (the pattern was derived from an audible guitar) or
  `proposed` (typical pattern for the meter, the guitar was not usable);
- a fingerprint of the song's chord layout, so stale data can be detected
  (below);
- the meter (`4/4`, `3/4`, `6/8`, `12/8`, `2/4`…) and the teaching tempo as a
  single BPM in the meter's beat (the dotted quarter in 6/8);
- the strumming pattern for one bar, as one slot per subdivision of the grid
  (eighths or sixteenths), each slot down, up or rest; optionally a second
  pattern for the chorus when it differs (see below);
- the teaching duration of every chord of the `.cho`, in reading order, in
  whole beats of the meter, each marked when it was estimated rather than
  measured (see "Teaching durations" below);
- the recording data needed later to play along with it: its beat times in
  seconds, its downbeats, the start of every `.cho` chord in it when found,
  and its transposition relative to the `.cho` (semitones);
- the disagreements between recording and `.cho`, each with its position (bar
  and seconds, and the `.cho` line) and the two chords.

### Two parts, two kinds of staleness

The file has a teaching part (meter, tempo, pattern, status, teaching
durations) and a recording part (video id, beat times, downbeats, chord
starts, transposition, disagreements). They go stale for different reasons,
and a shared helper in `shared/` reports the two separately. (My call: a
new video usually leaves the song's rhythm unchanged, so the teaching part
should survive a link change.)

- The teaching part is stale when the song's chord layout changes. A
  fingerprint covers it: which timed line carries how many chords, in order,
  computed with the same FNV-1a approach as `linesFingerprint` in
  `shared/pauses.ts` (the engine computes it in Python from the same
  definition; a shared test fixture keeps the two implementations equal).
  Renaming or transposing chords does not change it; adding, removing or
  moving a chord to another line does.
- The recording part is stale when the song's `{x_youtube}` is not the video
  the analysis came from, or the song has no link any more; also when the
  teaching part is stale, since chord starts refer to the chord layout.

The editor's song page shows "da rifare" when the teaching part is stale,
and a lighter notice ("la registrazione è cambiata: rilancia il motore") when
only the recording part is, including after the link was changed in the
online editor. The reader, later, uses each part only when it is not stale.

### Teaching durations: regular, from the `.cho` sequence

(My call, all of this section: the data is for learning to play the song, and
a beginner needs a steady meter, while the performance's own timing is kept
in the recording part for anyone who wants to play along with it.)

The engine does not transcribe chords freely: it aligns the `.cho`'s own
chord sequence to the bars of the recording. The recording may have an intro
or outro not written in the `.cho`, repeat a chorus more times, skip a verse,
or play a passing chord; the alignment has to tolerate all of these. The
result of the alignment is the recording part's chord starts, as measured.

The teaching durations are derived from those measurements and regularized:

- every chord lasts a whole number of beats of the meter, and the meter never
  breaks: bars stay complete, so a beat the performer held at the end of a
  line is dropped and a missing one added, and the pattern always restarts
  on a downbeat;
- repeated material agrees: chords on lines that repeat (the chorus, verses
  with the same chord sequence) get the durations of the most common reading;
- a chord the alignment did not find in the recording (e.g. a verse the
  recording skips) takes its duration from the same chord sequence elsewhere
  in the song or, failing that, one bar, and is marked as estimated.

A free recognition pass constrained to the song's chord vocabulary, like the
spike's, runs alongside and produces the disagreement list; it never changes
the chord names.

### Meter

The engine proposes the meter from the accent profile of the guitar hits over
the beat tracker's grid, as the spike did by hand. Meters with the same
number of pulses per bar (3/4 and 6/8; 4/4 and 12/8 in some readings) are
told apart by where the second strongest accent falls. Because the beat
tracker can be off by a metrical level, the engine keeps the plausible
alternatives (at least the top two readings, each with its own bar grid,
pattern summary and chord durations) so the review page can switch meter
without rerunning the engine.

### Pattern

The pattern to teach is a summary of the per-bar hits: slots hit in most bars
form the core pattern, slots hit in a minority of bars are dropped from it
(they can be mentioned as fills later, but the stored pattern is the core).
Thresholds are the builder's, tuned on real songs. The chorus gets its own
pattern only when its summary differs from the verse's; the `.cho`'s
`{start_of_chorus}` blocks say which bars belong to it.

Direction is assigned by a documented default rule per meter, never from the
audio: the hand moves on the grid's subdivision, down on the beat and up off
it (in 4/4 on eighths: down on 1-2-3-4, up on the "e"); for compound meters
(6/8, 12/8) the rule is the builder's to pick from common teaching practice
and to document. Every slot can be changed in the review page.

### Songs without an audible guitar

The engine measures how much of the recording the guitar stem accounts for.
Below a threshold (the builder's, tuned on real songs) it still computes beats,
meter, tempo and chord durations, but writes the default pattern of the meter
(the reader's "Base", "Il classico" and "Valzer" are a starting point) with
status `proposed`.

The engine only proposes the status; the maintainer has the last word in the
review page, in both directions. (My call: the maintainer who rewrites the
pattern by ear from a recording without guitar has heard it, and a piano
mistaken for a guitar has not been heard as a guitar. The status says whether
a person who listened stands behind the pattern, so it stays two values.)

### Cache

Everything the engine downloads or computes stays in `rhythm/.cache/`
(git-ignored): the audio, the stems, and the full analysis the review page
reads, one directory per song. Rerunning on the same video reuses the audio
and stems; a different `{x_youtube}` starts over. The cache can be deleted at
any time.

### Review page (editor, local only)

A new editor page per song, reached from the song's edit page, hidden in
online mode like the other local-only management operations. It reads the
cached analysis through a local server route and the audio from the cache;
when there is no analysis it shows the command to run.

It shows, with the editor's design tokens:

- two ways to listen:
  - on the recording: the recording with a click (accent on the downbeat)
    and a synthesized strum of the current pattern on the chords the
    alignment found, each switchable, all scheduled on the recording's own
    beat times so they follow its tempo changes. This checks the engine's
    reading of the recording.
  - teaching version: no recording, just click and synthesized strum at the
    teaching tempo through the teaching durations. This checks what will be
    saved, including the maintainer's own changes.
- the meter, with the alternatives the engine kept;
- the teaching tempo, prefilled with the recording's median;
- the pattern as a row of slots, each cycling down / up / rest, plus the
  chorus pattern when present;
- the song's chords in reading order with their lyrics, grouped into bars by
  the teaching durations; each chord's duration editable in beats with − and
  + (the same idiom as the visual editor's pause chip), the bars reflowing
  after a change; estimated durations visibly marked until edited or
  confirmed; the current chord highlighted while playing, and in the
  recording mode a tap seeks the recording to where the alignment found it.
  The recording part's chord starts are not editable: they are what the
  engine measured, and a wrong one is fixed by rerunning the engine;
- the disagreements with the `.cho`, each seeking to its spot;
- the status (`heard` / `proposed`), editable, and a "Salva" that writes the
  JSON next to the `.cho`.

The synthesized strum reuses the sound of the reader's `audio.ts` (plucked
notes, strum, click); since both apps need it now, it moves to `shared/`. The
chord shapes come from `shared/chord-definitions.json` via the existing
diagram helpers.

When saved rhythm data exists and is stale, the song's edit page says so and
links to the review page.

### Repository plumbing

- `.gitignore`: `rhythm/.cache/` and the virtual environment.
- `AGENTS.md`: the new `rhythm/` directory, the `{x_youtube}` directive, the
  `*.rhythm.json` files, the review page; `ARCHITECTURE.md` likewise.
- CI: the test stack does not install PyTorch or download models. The
  engine's pure parts (meter decision, pattern summary, alignment, direction
  rule, fingerprint, JSON writing) are separated from the model calls and
  covered by fast unit tests on recorded fixture data, run by the test stack
  with a lightweight environment. The TypeScript side gets the usual unit and
  E2E tests (link field round-trip, review page against a fixture analysis
  and audio file, the rhythm file following move/delete).

## Left to the builder

- The JSON schema, field names and slot encoding.
- The alignment algorithm (HMM, DTW or other) and how it handles repeats,
  skips and intros.
- Thresholds: hit detection, core vs fill, guitar audibility.
- The direction rule for compound meters, documented.
- The review page's layout, within the editor's existing look.
- How the engine reports progress and errors in the terminal.
- Whether `yt-dlp` and `ffmpeg` are called as subprocesses or as libraries.

## Success criteria

- Running the engine on «La gioia» with the video above produces a proposal
  in 6/8 at about 105 BPM, with the `.cho` chords lasting two bars (four
  beats) each in the verse and the Sol bars flagged as disagreements, and the
  review page plays it in time with the recording, as the spike did.
- The maintainer can take a second song where the guitar is audible and one
  where it is not, run the engine, correct the result in the review page and
  save, without touching a terminal after the engine has run.
- The saved file survives moving the song to another category; its teaching
  part is reported stale after a chord is added to the song, and only its
  recording part after the link is changed.
- The test stack stays green on a machine without Python audio libraries.
