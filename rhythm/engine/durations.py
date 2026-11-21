"""Chord durations to teach, chord start times and disagreements, from an alignment.

`beat_chord[t]` is the .cho chord aligned to beat `t` of the meter, or -1. A
"run" is a maximal stretch of consecutive beats aligned to the same chord; a
chord the recording plays several times (a repeated chorus) has several runs.
Beats are grouped into bars of `beats_per_bar` from beat 0, so a run starting
at a multiple of `beats_per_bar` starts on a downbeat.
"""

import math
from collections import Counter

import numpy as np

from engine.cho import ChoChord
from engine.harmony import same_chord


def _runs(values: list[int]) -> list[tuple[int, int, int]]:
    """(value, first index, length) of each maximal run of equal values."""
    runs = []
    start = 0
    for t in range(1, len(values) + 1):
        if t == len(values) or values[t] != values[start]:
            runs.append((values[start], start, t - start))
            start = t
    return runs


def teaching_durations(
    beat_chord: list[int], chords: list[ChoChord], line_texts: list[str], beats_per_bar: int
) -> tuple[list[int], list[bool]]:
    """Whole-beat durations of every chord and whether each was estimated rather than measured.

    1. A chord's measured duration is the median length of its runs, its
       start the first beat of its first run.
    2. Walking the chords in order, the current chord ends on the bar line
       nearest to its measured end (never before the bar line after its start)
       when the next chord starts on a downbeat, the earlier bar line on a tie
       (a beat held at the end of a line is dropped), or when the next chord
       starts mid-bar and lasts at least a bar, the later bar line on a tie (a
       change anticipated by half a bar belongs to the next bar). Bars stay
       complete and changes between long chords fall on downbeats. After an
       unmeasured chord the walk resumes from the next measured chord's own
       position in the bar.
    3. Lines are grouped by chorus and chord names; every line of a group takes
       the duration vector most common among its fully measured lines.
    4. A chord left without a duration lasts one bar. Chords not measured are
       marked estimated.
    """
    n = len(chords)
    lengths: dict[int, list[int]] = {}
    first: dict[int, int] = {}
    for chord, start, length in _runs(beat_chord):
        if 0 <= chord < n:
            lengths.setdefault(chord, []).append(length)
            first.setdefault(chord, start)
    measured = [i in lengths for i in range(n)]
    durations: list[int | None] = [
        max(1, math.floor(float(np.median(lengths[i])) + 0.5)) if measured[i] else None for i in range(n)
    ]

    pos: int | None = 0
    for i in range(n):
        if durations[i] is None:
            pos = None
            continue
        if pos is None:
            pos = first[i]
        end = pos + durations[i]
        nearest = None
        if i + 1 < n and measured[i + 1]:
            if first[i + 1] % beats_per_bar == 0:
                nearest = math.ceil(end / beats_per_bar - 0.5) * beats_per_bar
            elif durations[i + 1] >= beats_per_bar:
                nearest = math.floor(end / beats_per_bar + 0.5) * beats_per_bar
        if nearest is not None:
            end = max(nearest, (pos // beats_per_bar + 1) * beats_per_bar)
            durations[i] = end - pos
        pos = end

    lines: list[list[int]] = [[] for _ in line_texts]
    for i, chord in enumerate(chords):
        lines[chord.line].append(i)
    groups: dict[tuple[bool, tuple[str, ...]], list[list[int]]] = {}
    for indices in lines:
        if indices:
            key = (chords[indices[0]].chorus, tuple(chords[i].name for i in indices))
            groups.setdefault(key, []).append(indices)
    for group in groups.values():
        vectors = [tuple(durations[i] for i in idx) for idx in group if all(measured[i] for i in idx)]
        if not vectors:
            continue
        common = Counter(vectors).most_common(1)[0][0]
        for idx in group:
            for i, d in zip(idx, common):
                durations[i] = d

    estimated = [not m for m in measured]
    return [beats_per_bar if d is None else d for d in durations], estimated


def chord_starts(beat_chord: list[int], beat_times: list[float], n_chords: int) -> list[float | None]:
    """Time of the first beat aligned to each chord, None for chords never aligned."""
    starts: list[float | None] = [None] * n_chords
    for t, chord in enumerate(beat_chord):
        if 0 <= chord < n_chords and starts[chord] is None:
            starts[chord] = beat_times[t]
    return starts


def disagreements(
    beat_chord: list[int],
    heard: list[int],
    beat_times: list[float],
    chords: list[ChoChord],
    vocab: list[str],
    beats_per_bar: int,
) -> list[dict]:
    """Where the recording plays another chord than the .cho for at least a bar.

    `heard[t]` indexes `vocab`. Each run of at least `beats_per_bar`
    consecutive aligned beats whose heard chord is not the aligned one gives
    one entry, described at the run's first beat.
    """
    same: dict[tuple[str, str], bool] = {}

    def differs(t: int) -> bool:
        if beat_chord[t] < 0:
            return False
        key = (vocab[heard[t]], chords[beat_chord[t]].name)
        if key not in same:
            same[key] = same_chord(*key)
        return not same[key]

    out = []
    for wrong, start, length in _runs([differs(t) for t in range(len(beat_chord))]):
        if wrong and length >= beats_per_bar:
            out.append(
                {
                    "chord": beat_chord[start],
                    "time": round(float(beat_times[start]), 3),
                    "expected": chords[beat_chord[start]].name,
                    "heard": vocab[heard[start]],
                }
            )
    return out
