"""From the audio features and the .cho to `analysis.json`: meter readings, pattern, chord durations.

The beat tracker's beats ("tracker beats") are the time base: the features
hold, for each of them, the onset strength at 12 phases (of the guitar, or of
all the instruments when the guitar is not audible) and the chroma of its six
sixths. The pipeline splits each tracker beat into
`choose_subdivision` pulses, groups the pulses into the tracker's bars, ranks
the meters that fit a bar of that many pulses, and for each one computes a
reading on its own bars (the tracker's, or halves or pairs of them, see
`meter_bars`): the meter's beats, the .cho chords aligned to them, the teaching
durations, the pattern and the disagreements.
"""

from collections import Counter
from dataclasses import dataclass

import numpy as np

from engine.align import align, best_transposition, recognize, similarities
from engine.cho import ChoSong, chord_layout_fingerprint
from engine.cli import EngineError
from engine.durations import chord_starts, disagreements, teaching_durations
from engine.meter import MeterCandidate, bar_starts, choose_subdivision, meter_bars, rank_meters
from engine.pattern import DEFAULT_PATTERNS, core_slots, strokes

# Below this share of the instrumental energy the guitar is not audible
# enough to read a pattern from: the hits are then those of all the
# instruments (see `engine.audio`) and the reading proposes the meter's default
# pattern.
GUITAR_SHARE_MIN = 0.3

PHASES = 12  # onset samples per tracker beat
SIXTHS = 6  # chroma frames per tracker beat


def _rounded(values, digits: int = 3):
    if isinstance(values, (list, tuple)):
        return [_rounded(v, digits) for v in values]
    return round(float(values), digits)


@dataclass
class Features:
    beats: list[float]  # tracker beat times in seconds
    downbeats: list[int]  # indices into beats of the tracker's downbeats
    onset: list[list[float]]  # per tracker beat, the onset strength at phases j/12 of the beat (guitar, or all instruments)
    chroma: list[list[list[float]]]  # per tracker beat, 6 chroma vectors of 12, one per sixth
    guitar_share: float  # RMS of the guitar stem over RMS of all non-vocal stems

    def to_json(self) -> dict:
        """A JSON-ready dict, numbers rounded to 3 decimals."""
        return {
            "beats": _rounded(self.beats),
            "downbeats": [int(d) for d in self.downbeats],
            "onset": _rounded(self.onset),
            "chroma": _rounded(self.chroma),
            "guitar_share": round(float(self.guitar_share), 3),
        }

    @classmethod
    def from_json(cls, d: dict) -> "Features":
        return cls(d["beats"], d["downbeats"], d["onset"], d["chroma"], d["guitar_share"])


def _pulse_times(beats: np.ndarray, sub: int) -> np.ndarray:
    """`sub` equally spaced pulses per tracker beat; the last beat lasts as long as the one before."""
    gaps = np.diff(beats)
    gaps = np.append(gaps, gaps[-1] if len(gaps) else 0.0)
    return (beats[:, None] + gaps[:, None] * np.arange(sub)[None, :] / sub).reshape(-1)


def _default_pattern(candidate: MeterCandidate) -> str:
    fallback = ("D" + "." * (candidate.slots_per_beat - 1)) * candidate.beats_per_bar
    return DEFAULT_PATTERNS.get((candidate.meter, candidate.slots_per_beat), fallback)


def analyze(features: Features, song: ChoSong, meta: dict) -> dict:
    """The `analysis.json` dict; `meta` carries `song`, `source`, `analyzed` and `audio`."""
    beats = np.asarray(features.beats, dtype=float)
    n = len(beats)
    onset = np.asarray(features.onset, dtype=float).reshape(n, PHASES)
    sixths = np.asarray(features.chroma, dtype=float).reshape(n * SIXTHS, 12)

    downbeats = sorted(set(features.downbeats))
    gaps = Counter(int(g) for g in np.diff(downbeats))
    tracker_per_bar = gaps.most_common(1)[0][0] if gaps else 0
    starts = bar_starts(downbeats, n, tracker_per_bar) if tracker_per_bar else []
    if not starts:
        raise EngineError("Il battito della registrazione non ha battute riconoscibili: impossibile ricavare il metro.")

    sub = choose_subdivision(onset.mean(axis=0))
    pulse_times = _pulse_times(beats, sub)
    pulse_strength = onset[:, :: PHASES // sub].reshape(-1)
    # the onset halfway to the next pulse, where the hand is in the air: the
    # lower of the two phases around the midpoint when it falls between them
    midpoints = [PHASES / sub * (j + 0.5) for j in range(sub)]
    gap_strength = np.stack(
        [np.minimum(onset[:, int(np.floor(m))], onset[:, int(np.ceil(m)) % PHASES]) for m in midpoints], axis=1
    ).reshape(-1)
    pulses_per_bar = tracker_per_bar * sub
    tracker_bars = [s * sub for s in starts]
    profile = np.mean([pulse_strength[p : p + pulses_per_bar] for p in tracker_bars], axis=0)
    ranked = rank_meters(pulses_per_bar, profile)
    if not ranked:
        raise EngineError(
            f"La registrazione ha battute di {pulses_per_bar} suddivisioni: nessun metro previsto ci corrisponde."
        )

    names = [c.name for c in song.chords]
    vocab = list(dict.fromkeys(names))
    transpose = best_transposition(np.median(sixths.reshape(n, SIXTHS, 12), axis=1), names)
    section_starts = [i for i, c in enumerate(song.chords) if i == 0 or c.block != song.chords[i - 1].block]
    heard_guitar = features.guitar_share >= GUITAR_SHARE_MIN

    readings = []
    for candidate, score in ranked:
        bpb, spb = candidate.beats_per_bar, candidate.slots_per_beat
        bar_pulses = meter_bars(tracker_bars, pulses_per_bar, bpb * spb)
        if not bar_pulses:
            continue
        bars = np.array([pulse_strength[p : p + bpb * spb] for p in bar_pulses])
        gaps = np.array([gap_strength[p : p + bpb * spb] for p in bar_pulses])
        # the meter's beats, as pulse indices: every `spb` pulses from each bar start
        beat_pulses = [p + j * spb for p in bar_pulses for j in range(bpb)]
        beat_times = pulse_times[beat_pulses]
        # a beat's chroma: the median of the sixths starting inside it (positions in sixths are 6 / sub per pulse)
        beat_chroma = np.array(
            [np.median(sixths[-(-SIXTHS * p // sub) : -(-SIXTHS * (p + spb) // sub)], axis=0) for p in beat_pulses]
        )
        sims = similarities(beat_chroma, names, transpose)
        bar_start = np.arange(len(beat_pulses)) % bpb == 0
        beat_chord = align(sims, section_starts, bar_start)

        durations, estimated = teaching_durations(beat_chord, song.chords, song.line_texts, bpb)
        times = [float(t) for t in beat_times]
        heard = recognize(similarities(beat_chroma, vocab, transpose))

        if heard_guitar:
            # a bar belongs to the verse or the chorus by the chord aligned to its first beat
            first = [beat_chord[b * bpb] for b in range(len(bar_pulses))]
            in_chorus = np.array([c >= 0 and song.chords[c].chorus for c in first], dtype=bool)
            in_verse = np.array([c >= 0 and not song.chords[c].chorus for c in first], dtype=bool)
            verse = in_verse if in_verse.any() else np.ones(len(bars), dtype=bool)
            pattern = strokes(core_slots(bars[verse], gaps[verse]), bpb, spb)
            chorus_pattern = (
                strokes(core_slots(bars[in_chorus], gaps[in_chorus]), bpb, spb) if in_chorus.any() else None
            )
            if chorus_pattern == pattern:
                chorus_pattern = None
        else:
            pattern = _default_pattern(candidate)
            chorus_pattern = None

        readings.append(
            {
                "meter": candidate.meter,
                "beatsPerBar": bpb,
                "slotsPerBeat": spb,
                "score": round(float(score), 2),
                "bpm": round(60.0 / float(np.median(np.diff(beat_times))), 2),
                "beats": _rounded(times),
                "beatChord": beat_chord,
                "pattern": pattern,
                "chorusPattern": chorus_pattern,
                "durations": durations,
                "estimated": estimated,
                "chordStarts": [None if s is None else round(s, 3) for s in chord_starts(beat_chord, times, len(names))],
                "disagreements": disagreements(beat_chord, heard, times, song.chords, vocab, bpb),
            }
        )

    return {
        "version": 1,
        "song": meta["song"],
        "source": meta["source"],
        "analyzed": meta["analyzed"],
        "audio": meta["audio"],
        "fingerprint": chord_layout_fingerprint(song),
        "guitarShare": round(float(features.guitar_share), 2),
        "status": "heard" if heard_guitar else "proposed",
        "transpose": transpose,
        "chords": names,
        "readings": readings,
    }
