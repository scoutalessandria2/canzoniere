"""The song's chords against the recording's chroma, beat by beat.

`beat_chroma` has one row of 12 pitch-class energies (C = 0 ... B = 11) per
beat. Similarities are cosines between a beat's chroma and a chord template
raised by the transposition, so `shift` semitones is how much higher the
recording sounds than the .cho.

`align` follows the .cho's own chord sequence through the recording with a
Viterbi pass. Its states are the .cho chords in reading order plus FREE, the
recording playing something the sequence does not account for (an intro, an
instrumental break, an outro). Scores are log-likelihood-like and summed:

- emission of chord `i` at beat `t`: `EMISSION_SCALE * sims[i, t]`; of FREE:
  `EMISSION_SCALE * median(sims[:, t]) + FREE_OFFSET`, so a chord has to sound
  clearly better than the song's typical chord to hold the beat against FREE;
- staying on a state is free; moving on to the next chord costs
  `ADVANCE_COST`, less `BAR_BONUS` when the beat starts a bar;
- jumping to the first chord of a block (a repeated or skipped section) costs
  `JUMP_COST`, leaving the sequence for FREE `LEAVE_COST`, and coming back from
  FREE, only at the first chord of a block, `ENTER_COST`;
- the path starts in FREE or on the first chord of a block and ends anywhere.

FREE_OFFSET is positive so that beats where no chord fits better than the
median (speech, silence, a chord outside the song) go to FREE once they last
longer than ENTER_COST / FREE_OFFSET beats: with a negative offset a chord at
the median always outscores FREE and an intro is glued to the first chord. On
«La gioia» (`tests/test_la_gioia.py`) the alignment is the same for
FREE_OFFSET from 0.8 to 1, JUMP_COST and LEAVE_COST from 3 to 9 and ENTER_COST
from 1 to 3; at FREE_OFFSET 2 FREE starts eating verses.

`recognize` is the unconstrained reading: each beat gets the best chord of a
vocabulary, with a cost for every change, regardless of the .cho's order.
"""

import numpy as np

from engine.harmony import chord_template

EMISSION_SCALE = 8.0  # score of a beat per unit of cosine similarity
FREE_OFFSET = 1.0  # FREE scores the median similarity plus this
ADVANCE_COST = 0.5  # moving on to the next chord mid-bar
BAR_BONUS = 0.5  # taken off ADVANCE_COST on a bar start: changing on the downbeat is free
JUMP_COST = 6.0  # to the first chord of any block
LEAVE_COST = 6.0  # from a chord to FREE
ENTER_COST = 3.0  # from FREE to the first chord of a block


def _unit_rows(beat_chroma: np.ndarray) -> np.ndarray:
    c = np.asarray(beat_chroma, dtype=float).reshape(-1, 12)
    return c / (np.linalg.norm(c, axis=1, keepdims=True) + 1e-9)


def best_transposition(beat_chroma: np.ndarray, names: list[str]) -> int:
    """The shift (0-11) that makes the templates of `names` fit the beats best.

    A shift scores the mean, over the beats, of the best cosine among the
    shifted templates of the song's distinct chords.
    """
    templates = [t for t in (chord_template(n) for n in dict.fromkeys(names)) if t is not None]
    chroma = _unit_rows(beat_chroma)
    if not templates or len(chroma) == 0:
        return 0
    stacked = np.stack(templates)
    scores = [(chroma @ np.roll(stacked, shift, axis=1).T).max(axis=1).mean() for shift in range(12)]
    return int(np.argmax(scores))


def similarities(beat_chroma: np.ndarray, names: list[str], shift: int) -> np.ndarray:
    """Cosine of each name's template, raised by `shift`, with each beat: one row per name."""
    chroma = _unit_rows(beat_chroma)
    out = np.zeros((len(names), len(chroma)))
    rows: dict[str, np.ndarray] = {}
    for i, name in enumerate(names):
        if name not in rows:
            template = chord_template(name)
            rows[name] = np.zeros(len(chroma)) if template is None else chroma @ np.roll(template, shift)
        out[i] = rows[name]
    return out


def align(sims: np.ndarray, section_starts: list[int], bar_start: np.ndarray) -> list[int]:
    """The .cho chord each beat belongs to, or -1 for FREE; `sims` has one row per .cho chord."""
    sims = np.asarray(sims, dtype=float)
    n, beats = sims.shape
    if beats == 0:
        return []
    if n == 0:
        return [-1] * beats

    free = n
    emit = np.empty((n + 1, beats))
    emit[:n] = EMISSION_SCALE * sims
    emit[free] = EMISSION_SCALE * np.median(sims, axis=0) + FREE_OFFSET
    starts = sorted({s for s in section_starts if 0 <= s < n})
    states = np.arange(n + 1)

    score = np.full(n + 1, -np.inf)
    score[free] = emit[free, 0]
    score[starts] = emit[starts, 0]
    back = np.zeros((beats, n + 1), dtype=np.int32)
    back[0] = states

    for t in range(1, beats):
        best = score.copy()
        arg = states.copy()

        advance = score[: n - 1] - (ADVANCE_COST - (BAR_BONUS if bar_start[t] else 0.0))
        better = advance > best[1:n]
        best[1:n] = np.where(better, advance, best[1:n])
        arg[1:n] = np.where(better, states[: n - 1], arg[1:n])

        top = int(np.argmax(score[:n]))
        for s in starts:
            for value, origin in ((score[top] - JUMP_COST, top), (score[free] - ENTER_COST, free)):
                if value > best[s]:
                    best[s], arg[s] = value, origin
        if score[top] - LEAVE_COST > best[free]:
            best[free], arg[free] = score[top] - LEAVE_COST, top

        score = best + emit[:, t]
        back[t] = arg

    state = int(np.argmax(score))
    path = [state]
    for t in range(beats - 1, 0, -1):
        state = int(back[t, state])
        path.append(state)
    path.reverse()
    return [-1 if s == free else s for s in path]


def recognize(sims: np.ndarray, penalty: float = 2.5) -> list[int]:
    """The best row for each beat, changing row at a cost of `penalty`; `sims` has one row per chord, at least one."""
    sims = np.asarray(sims, dtype=float)
    n, beats = sims.shape
    if beats == 0:
        return []

    emit = EMISSION_SCALE * sims
    rows = np.arange(n)
    score = emit[:, 0].copy()
    back = np.zeros((beats, n), dtype=np.int32)
    for t in range(1, beats):
        top = int(np.argmax(score))
        switch = score[top] - penalty
        stay = score >= switch
        back[t] = np.where(stay, rows, top)
        score = np.where(stay, score, switch) + emit[:, t]

    row = int(np.argmax(score))
    path = [row]
    for t in range(beats - 1, 0, -1):
        row = int(back[t, row])
        path.append(row)
    path.reverse()
    return path
