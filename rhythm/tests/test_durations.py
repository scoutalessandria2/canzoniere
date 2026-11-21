from engine.cho import parse_cho
from engine.durations import chord_starts, disagreements, teaching_durations


def _song(text: str):
    song = parse_cho("{title:Prova}\n\n" + text)
    return song.chords, song.line_texts


def test_an_unmeasured_line_takes_the_vector_of_its_measured_twin():
    chords, lines = _song("[Do]uno [Sol]due\n\n[Do]tre [Sol]quattro\n")
    beat_chord = [0] * 4 + [1] * 4 + [-1] * 8
    durations, estimated = teaching_durations(beat_chord, chords, lines, 4)
    assert durations == [4, 4, 4, 4]
    assert estimated == [False, False, True, True]


def test_the_end_of_a_chord_is_rounded_to_the_bar_when_the_next_one_starts_on_a_downbeat():
    chords, lines = _song("[Do]uno [Fa]due\n[Sol]tre\n")
    beat_chord = [0] * 4 + [1] * 5 + [-1] + [2] * 4
    durations, estimated = teaching_durations(beat_chord, chords, lines, 2)
    assert durations[:2] == [4, 4]
    assert estimated == [False, False, False]


def test_an_off_beat_change_into_a_chord_shorter_than_a_bar_keeps_the_measured_length():
    chords, lines = _song("[Do]uno [Fa]due [Sol]tre\n")
    beat_chord = [0] * 3 + [1] * 1 + [2] * 4
    durations, _ = teaching_durations(beat_chord, chords, lines, 2)
    assert durations == [3, 1, 4]


def test_a_change_anticipated_by_half_a_bar_moves_to_the_later_bar_line():
    # Do comes in on the second beat of Fa's last bar: a tie between the two bar lines
    chords, lines = _song("[Do]a [Fa]b [Do]c [Fa]d\n")
    beat_chord = [0] * 4 + [1] * 3 + [2] * 5 + [3] * 4
    durations, estimated = teaching_durations(beat_chord, chords, lines, 2)
    assert durations == [4, 4, 4, 4]
    assert estimated == [False] * 4


def test_a_late_change_moves_to_the_nearest_bar_line():
    chords, lines = _song("[Do]a [Fa]b [Sol]c\n")
    beat_chord = [0] * 3 + [1] * 4 + [2] * 5
    durations, _ = teaching_durations(beat_chord, chords, lines, 3)
    assert durations == [3, 3, 5]


def test_the_measured_duration_is_the_median_of_the_runs():
    chords, lines = _song("[Do]uno [Fa]due\n")
    beat_chord = [0] * 4 + [1] * 4 + [-1] * 2 + [0] * 8 + [1] * 4 + [-1] * 2 + [0] * 8 + [1] * 4
    durations, _ = teaching_durations(beat_chord, chords, lines, 4)
    assert durations == [8, 4]


def test_a_chord_never_measured_and_without_a_group_lasts_one_bar():
    chords, lines = _song("[Do]uno\n\n[Mim]due\n")
    durations, estimated = teaching_durations([0] * 3, chords, lines, 3)
    assert durations == [3, 3]
    assert estimated == [False, True]


def test_lines_with_the_same_chords_take_the_most_common_vector():
    chords, lines = _song("[Do]a [Fa]b\n[Do]c [Fa]d\n[Do]e [Fa]f\n")
    beat_chord = [0] * 4 + [1] * 4 + [2] * 4 + [3] * 4 + [4] * 2 + [5] * 6
    durations, estimated = teaching_durations(beat_chord, chords, lines, 2)
    assert durations == [4, 4, 4, 4, 4, 4]
    assert estimated == [False] * 6


def test_chorus_lines_are_grouped_apart_from_verse_lines():
    chords, lines = _song("[Do]a [Fa]b\n\n{start_of_chorus}\n[Do]c [Fa]d\n{end_of_chorus}\n")
    beat_chord = [0] * 2 + [1] * 2 + [2] * 4 + [3] * 4
    durations, _ = teaching_durations(beat_chord, chords, lines, 2)
    assert durations == [2, 2, 4, 4]


def test_chord_starts_are_the_first_aligned_beat_of_each_chord():
    beat_times = [0.5 * t for t in range(6)]
    assert chord_starts([-1, 0, 0, 1, 1, 0], beat_times, 3) == [0.5, 1.5, None]


def test_disagreements_flag_runs_of_at_least_a_bar():
    chords, _ = _song("[Do]uno [Sol]due\n")
    vocab = ["Do", "Sol", "Fa"]
    beat_chord = [0] * 4 + [1] * 10
    heard = [0] * 4 + [2] * 2 + [1] * 2 + [2] + [1] * 5
    beat_times = [0.4321 * t + 0.1 for t in range(len(beat_chord))]
    assert disagreements(beat_chord, heard, beat_times, chords, vocab, 2) == [
        {"chord": 1, "time": 1.828, "expected": "Sol", "heard": "Fa"}
    ]


def test_disagreements_ignore_unaligned_beats_and_equivalent_names():
    chords, _ = _song("[Mim]uno\n")
    vocab = ["Em", "Fa"]
    assert disagreements([0, 0, 0, -1, -1], [0, 0, 0, 1, 1], [0, 1, 2, 3, 4], chords, vocab, 2) == []
