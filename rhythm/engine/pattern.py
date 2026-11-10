"""Strumming pattern of a bar, from the onset strength of each slot.

A slot carries a stroke when its mean onset strength over the bars is above
the mean strength between the slots, where the hand is in the air. The
reference is that silence, not the strongest slot: the bar's first stroke is
accented and lands on the chord change, so it can be ten times as strong as
the light strokes (upstrokes above all) that still belong to the pattern.

A pattern has one character per slot: `D` (down), `U` (up) or `.` (the hand
swings without touching the strings).

Direction rule: with 2 or 4 slots per beat the hand swings on the slot grid, so
even slots are `D` and odd slots `U`; with 3 slots per beat (compound meters)
each beat is strummed down-down-up, so slot `k % 3` maps to `D`, `D`, `U`.
Non-core slots are `.`.
"""

import numpy as np

# A slot is core when its mean onset strength is above this many times the
# mean strength between the slots. On «La gioia» the slots never struck stay
# at 0.6-0.7 times it and the lightest strokes are at 1.3-1.8 times, on the
# maintainer's own solo guitar and on the YouTube recording alike.
STROKE_RATIO = 1.0


def core_slots(strengths: np.ndarray, gaps: np.ndarray) -> list[bool]:
    """Which slots carry a stroke.

    `strengths` has one row per bar and one column per slot; `gaps` holds, for
    the same bars, the onset strength halfway between each slot and the next.
    A silent recording and a matrix without bars have no core slots.
    """
    s = np.asarray(strengths, dtype=float)
    if s.size == 0:
        return [False] * (s.shape[1] if s.ndim == 2 else 0)
    means = s.mean(axis=0)
    floor = max(float(np.asarray(gaps, dtype=float).mean()), 0.0)
    return [bool(m) for m in (means > 0) & (means > STROKE_RATIO * floor)]


def strokes(core: list[bool], beats_per_bar: int, slots_per_beat: int) -> str:
    """The pattern string of a bar whose core slots are `core`."""
    if len(core) != beats_per_bar * slots_per_beat:
        raise ValueError(f"{len(core)} slots for {beats_per_bar} beats of {slots_per_beat} slots")
    out = []
    for k, is_core in enumerate(core):
        if not is_core:
            out.append(".")
        elif slots_per_beat == 3:
            out.append("U" if k % 3 == 2 else "D")
        else:
            out.append("U" if k % 2 else "D")
    return "".join(out)


# A typical pattern for each (meter, slots per beat), used when the recording
# does not give one.
DEFAULT_PATTERNS: dict[tuple[str, int], str] = {
    ("4/4", 2): "D.DU.UDU",
    ("4/4", 4): "D...D...D...D...",
    ("3/4", 2): "D.U.U.",
    ("3/4", 4): "D...D...D...",
    ("2/4", 2): "D.DU",
    ("6/8", 3): "D..D..",
    ("9/8", 3): "D..D..D..",
    ("12/8", 3): "D..D..D..D..",
}
