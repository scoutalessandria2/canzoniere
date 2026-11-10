"""Meter candidates, subdivision and bar starts.

The beat tracker gives one tick per beat; the engine works on a grid of
"slots": the equal parts a beat is split into (2 for eighth notes in simple
time, 3 for the eighth notes of a compound meter, 4 for sixteenths). A bar has
`beats_per_bar * slots_per_beat` slots, its "pulses per bar".
"""

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class MeterCandidate:
    meter: str  # e.g. "6/8"
    beats_per_bar: int
    slots_per_beat: int


# Meters that fit a tracker bar of that many pulses, in order of preference
# when the onsets do not tell them apart. The beat tracker can be off by a
# metrical level, so a bar of 8 pulses is also offered as two bars of 2/4 and
# a bar of 4 pulses as half a bar of 4/4 (see `meter_bars`).
CANDIDATES: dict[int, list[MeterCandidate]] = {
    4: [MeterCandidate("2/4", 2, 2), MeterCandidate("4/4", 4, 2)],
    6: [MeterCandidate("6/8", 2, 3), MeterCandidate("3/4", 3, 2)],
    8: [MeterCandidate("4/4", 4, 2), MeterCandidate("2/4", 2, 2)],
    9: [MeterCandidate("9/8", 3, 3)],
    12: [MeterCandidate("12/8", 4, 3), MeterCandidate("3/4", 3, 4)],
    16: [MeterCandidate("4/4", 4, 4)],
}


def choose_subdivision(phase_profile: np.ndarray) -> int:
    """Slots per beat, from the mean onset strength at the 12 phases `k/12` of a tracker beat.

    Onsets at the quarter phases (3 and 9) mean 4 slots, at the third phases
    (4 and 8) mean 3, and a beat whose only strong point besides its start is
    the half (phase 6) means 2.
    """
    p = np.asarray(phase_profile, dtype=float)
    half = p[6]
    if (p[3] + p[9]) / 2 > 0.75 * half:
        return 4
    if (p[4] + p[8]) / 2 > half:
        return 3
    return 2


def bar_starts(downbeats: list[int], n_beats: int, beats_per_bar: int) -> list[int]:
    """Tracker-beat indices where bars start.

    Between two consecutive downbeats a gap that is a multiple of
    `beats_per_bar` holds that many bars; any other gap holds none, and the
    count re-anchors at the next downbeat. After the last downbeat bars go on
    while they are complete within `n_beats`.
    """
    starts: list[int] = []
    for a, b in zip(downbeats, downbeats[1:]):
        if (b - a) % beats_per_bar == 0:
            starts.extend(range(a, b, beats_per_bar))
    if downbeats:
        start = downbeats[-1]
        while start + beats_per_bar <= n_beats:
            starts.append(start)
            start += beats_per_bar
    return starts


def meter_bars(tracker_bars: list[int], tracker_pulses: int, pulses: int) -> list[int]:
    """Pulse indices where a meter's bars of `pulses` pulses start, from the tracker's bars.

    `tracker_bars` are the pulse indices of the tracker's bars, each
    `tracker_pulses` long. A bar of the same length keeps them; half of it
    splits each tracker bar in two; twice it pairs consecutive tracker bars,
    from the first bar after each gap, and a bar left without a partner before a
    gap or at the end is dropped.
    """
    if pulses == tracker_pulses:
        return list(tracker_bars)
    if 2 * pulses == tracker_pulses:
        return [start + half for start in tracker_bars for half in (0, pulses)]
    if pulses == 2 * tracker_pulses:
        starts = []
        i = 0
        while i + 1 < len(tracker_bars):
            if tracker_bars[i + 1] == tracker_bars[i] + tracker_pulses:
                starts.append(tracker_bars[i])
                i += 2
            else:
                i += 1
        return starts
    raise ValueError(f"bars of {pulses} pulses do not regroup tracker bars of {tracker_pulses}")


def rank_meters(pulses_per_bar: int, profile: np.ndarray) -> list[tuple[MeterCandidate, float]]:
    """The candidates for a tracker bar of `pulses_per_bar` pulses, best first.

    `profile` is the mean onset strength at each slot of the tracker's bar. A
    candidate scores the mean on its beat slots (`slot % slots_per_beat == 0`)
    minus the mean on the other slots. Candidates with the same slots per beat
    (4/4 and 2/4) put their beats on the same slots whatever their bar length,
    so they score the same and keep the table's order: the tracker's own bar
    first.
    """
    p = np.asarray(profile, dtype=float)
    slots = np.arange(len(p))
    ranked = []
    for candidate in CANDIDATES.get(pulses_per_bar, []):
        on_beat = slots % candidate.slots_per_beat == 0
        ranked.append((candidate, float(p[on_beat].mean() - p[~on_beat].mean())))
    return sorted(ranked, key=lambda item: item[1], reverse=True)
