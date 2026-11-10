import warnings

import numpy as np
import pytest

from engine.meter import CANDIDATES
from engine.pattern import DEFAULT_PATTERNS, STROKE_RATIO, core_slots, strokes


def test_stroke_ratio():
    assert STROKE_RATIO == 1.0


def test_light_strokes_count_beside_an_accented_first_stroke():
    # The maintainer's own «La gioia», strummed down, rest, down-up, down-up in 3/4:
    # the bar's first stroke (accent and chord change) is about 10x the onset
    # between the slots, the light ones 1.8-4.4x, the second eighth 0.7x.
    gaps = np.full((10, 6), 0.09)
    means = np.array([0.97, 0.06, 0.20, 0.16, 0.39, 0.23])
    strengths = np.vstack([means + 0.02, means - 0.02] * 5)
    core = core_slots(strengths, gaps)
    assert core == [True, False, True, True, True, True]
    assert strokes(core, 3, 2) == "D.DUDU"


def test_a_slot_is_core_only_when_stronger_than_the_gaps_on_average():
    gaps = np.array([[0.1, 0.1, 0.1], [0.1, 0.1, 0.1]])
    assert core_slots(np.array([[0.5, 0.1, 0.12], [0.5, 0.09, 0.11]]), gaps) == [True, False, True]


def test_core_slots_of_a_silent_recording_are_all_false():
    assert core_slots(np.zeros((4, 6)), np.zeros((4, 6))) == [False] * 6
    assert core_slots(np.full((2, 3), -0.1), np.full((2, 3), -0.2)) == [False] * 3


def test_core_slots_without_bars_are_all_false_and_do_not_warn():
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        assert core_slots(np.empty((0, 6)), np.empty((0, 6))) == [False] * 6
        assert core_slots(np.empty((3, 0)), np.empty((3, 0))) == []


def test_strokes_compound_meter():
    core = [True, False, False, True, False, False]
    assert strokes(core, 2, 3) == "D..D.."


def test_strokes_all_core_eighths_swing_down_up():
    assert strokes([True] * 8, 4, 2) == "DUDUDUDU"


def test_strokes_all_core_compound_is_down_down_up():
    assert strokes([True] * 6, 2, 3) == "DDUDDU"


def test_strokes_sixteenths_swing_on_the_grid():
    assert strokes([True] * 16, 4, 4) == "DUDU" * 4


def test_strokes_non_core_slots_are_dots():
    assert strokes([True, False, True, True, False, True, False, True], 4, 2) == "D.DU.U.U"


def test_default_patterns_fit_their_meter():
    meters = {(c.meter, c.slots_per_beat): c for group in CANDIDATES.values() for c in group}
    assert set(DEFAULT_PATTERNS) == {
        ("4/4", 2),
        ("4/4", 4),
        ("3/4", 2),
        ("3/4", 4),
        ("2/4", 2),
        ("6/8", 3),
        ("9/8", 3),
        ("12/8", 3),
    }
    for key, pattern in DEFAULT_PATTERNS.items():
        candidate = meters[key]
        assert len(pattern) == candidate.beats_per_bar * candidate.slots_per_beat, key
        assert set(pattern) <= set("DU.")


def test_default_pattern_values():
    assert DEFAULT_PATTERNS[("4/4", 2)] == "D.DU.UDU"
    assert DEFAULT_PATTERNS[("6/8", 3)] == "D..D.."
    assert DEFAULT_PATTERNS[("12/8", 3)] == "D..D..D..D.."


def test_strokes_rejects_a_core_list_of_the_wrong_length():
    with pytest.raises(ValueError):
        strokes([True] * 5, 2, 3)
