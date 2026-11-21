import numpy as np

import pytest

from engine.meter import CANDIDATES, bar_starts, choose_subdivision, meter_bars, rank_meters


def _profile(**phases):
    p = np.full(12, 0.05)
    for key, value in phases.items():
        p[int(key[1:])] = value
    return p


def test_spike_profile_is_two_slots_per_beat():
    p = _profile(p0=0.48, p3=0.14, p9=0.10, p4=0.08, p8=0.19, p6=0.20)
    assert choose_subdivision(p) == 2


def test_triplet_profile_is_three_slots_per_beat():
    p = _profile(p0=0.5, p4=0.4, p8=0.4, p6=0.1)
    assert choose_subdivision(p) == 3


def test_sixteenth_profile_is_four_slots_per_beat():
    p = _profile(p0=0.5, p3=0.4, p6=0.4, p9=0.4)
    assert choose_subdivision(p) == 4


def test_bar_starts_skips_gaps_that_are_not_bar_multiples():
    assert bar_starts([0, 3, 6, 12, 13, 16], 20, 3) == [0, 3, 6, 9, 13, 16]


def test_bar_starts_continue_after_the_last_downbeat_while_complete():
    assert bar_starts([0], 7, 3) == [0, 3]
    assert bar_starts([2], 8, 3) == [2, 5]


def test_bar_starts_without_downbeats():
    assert bar_starts([], 10, 3) == []


def test_candidates_table():
    assert sorted(CANDIDATES) == [4, 6, 8, 9, 12, 16]
    assert [(c.meter, c.beats_per_bar, c.slots_per_beat) for c in CANDIDATES[6]] == [
        ("6/8", 2, 3),
        ("3/4", 3, 2),
    ]
    assert [(c.meter, c.beats_per_bar, c.slots_per_beat) for c in CANDIDATES[12]] == [
        ("12/8", 4, 3),
        ("3/4", 3, 4),
    ]
    assert [(c.meter, c.beats_per_bar, c.slots_per_beat) for c in CANDIDATES[4]] == [("2/4", 2, 2), ("4/4", 4, 2)]
    assert [(c.meter, c.beats_per_bar, c.slots_per_beat) for c in CANDIDATES[8]] == [("4/4", 4, 2), ("2/4", 2, 2)]
    assert [(c.meter, c.beats_per_bar, c.slots_per_beat) for c in CANDIDATES[9]] == [("9/8", 3, 3)]
    assert [(c.meter, c.beats_per_bar, c.slots_per_beat) for c in CANDIDATES[16]] == [("4/4", 4, 4)]


def test_rank_meters_prefers_six_eight_on_a_two_beat_profile():
    ranked = rank_meters(6, np.array([1.04, 0.07, 0.17, 0.35, 0.23, 0.19]))
    assert ranked[0][0].meter == "6/8"
    assert ranked[1][0].meter == "3/4"
    assert ranked[0][1] > ranked[1][1]


def test_rank_meters_scores_are_beat_minus_off_beat_means():
    ranked = dict((c.meter, s) for c, s in rank_meters(6, np.array([1.0, 0.0, 0.0, 0.5, 0.0, 0.0])))
    assert ranked["6/8"] == (1.0 + 0.5) / 2 - 0.0
    assert ranked["3/4"] == (1.0 + 0.0 + 0.0) / 3 - (0.5 + 0.0 + 0.0) / 3


def test_rank_meters_with_a_single_candidate():
    ranked = rank_meters(9, np.array([1.0, 0.1, 0.1, 0.6, 0.1, 0.1, 0.6, 0.1, 0.1]))
    assert [c.meter for c, _ in ranked] == ["9/8"]


def test_four_four_and_two_four_tie_and_the_trackers_own_bar_comes_first():
    profile = np.array([1.0, 0.1, 0.5, 0.1, 0.8, 0.1, 0.5, 0.1])
    ranked = rank_meters(8, profile)
    assert [c.meter for c, _ in ranked] == ["4/4", "2/4"]
    assert ranked[0][1] == ranked[1][1]
    ranked = rank_meters(4, profile[:4])
    assert [c.meter for c, _ in ranked] == ["2/4", "4/4"]
    assert ranked[0][1] == ranked[1][1]


def test_meter_bars_keep_the_trackers_bars_for_a_bar_of_the_same_length():
    assert meter_bars([0, 8, 24], 8, 8) == [0, 8, 24]


def test_meter_bars_split_each_tracker_bar_in_two_for_half_a_bar():
    assert meter_bars([0, 8, 24], 8, 4) == [0, 4, 8, 12, 24, 28]


def test_meter_bars_pair_consecutive_tracker_bars_for_twice_a_bar():
    # 0 and 4 pair, 8 and 12 pair; 20 follows a gap and pairs with 24; 28 is left alone
    assert meter_bars([0, 4, 8, 12, 20, 24, 28], 4, 8) == [0, 8, 20]
    # a bar followed by a gap starts no pair
    assert meter_bars([0, 8, 12], 4, 8) == [8]


def test_meter_bars_refuse_other_lengths():
    with pytest.raises(ValueError):
        meter_bars([0, 6], 6, 4)


def test_rank_meters_unknown_pulse_count_is_empty():
    assert rank_meters(5, np.zeros(5)) == []
