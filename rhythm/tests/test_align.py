import numpy as np

from engine.align import align, best_transposition, recognize, similarities
from engine.harmony import chord_template

HIGH = 1.0
LOW = 0.2


def _sims(names: list[str], played: list[str | None]) -> np.ndarray:
    """One row per chord name: HIGH on the beats that play that chord, LOW elsewhere."""
    return np.array([[HIGH if name == p else LOW for p in played] for name in names])


def test_align_skips_an_intro_and_follows_a_repeated_section():
    names = ["Do", "Fa", "Sol", "Do"]  # blocks [Do Fa] [Sol Do]
    played = [None] * 4 + ["Do"] * 4 + ["Fa"] * 4 + ["Sol"] * 4 + ["Do"] * 4 + ["Sol"] * 4 + ["Do"] * 4
    bar_start = np.arange(len(played)) % 4 == 0
    path = align(_sims(names, played), [0, 2], bar_start)
    assert path == [-1] * 4 + [0] * 4 + [1] * 4 + [2] * 4 + [3] * 4 + [2] * 4 + [3] * 4


def test_align_without_beats_or_chords():
    assert align(np.zeros((3, 0)), [0], np.zeros(0, dtype=bool)) == []
    assert align(np.zeros((0, 5)), [], np.zeros(5, dtype=bool)) == [-1] * 5


def test_best_transposition_finds_the_shift_of_the_recording():
    names = ["Do", "Fa", "Sol", "Do"]
    played = ["Do", "Fa", "Sol", "Do", "Fa", "Do"]
    chroma = np.array([np.roll(chord_template(p), 2) for p in played])
    assert best_transposition(chroma, names) == 2


def test_best_transposition_skips_unparseable_names():
    chroma = np.array([chord_template("Sol")] * 3)
    assert best_transposition(chroma, ["???", "Sol"]) == 0


def test_similarities_are_cosines_and_unparseable_rows_are_zero():
    chroma = np.array([chord_template("Do") * 3.0, np.zeros(12)])
    sims = similarities(chroma, ["Do", "???", "Re"], 10)
    assert sims.shape == (3, 2)
    assert sims[1].tolist() == [0.0, 0.0]
    # templates are raised by the shift: Re raised by 10 semitones is Do
    assert np.isclose(sims[2, 0], 1.0)
    assert sims[0, 0] < 1.0
    assert sims[:, 1].tolist() == [0.0, 0.0, 0.0]


def test_recognize_follows_a_clean_sequence():
    names = ["Do", "Sol"]
    played = ["Do"] * 5 + ["Sol"] * 5 + ["Do"] * 3
    assert recognize(_sims(names, played)) == [0] * 5 + [1] * 5 + [0] * 3


def test_recognize_ignores_a_one_beat_blip():
    sims = np.array([[1.0, 1.0, 0.75, 1.0, 1.0], [0.0, 0.0, 1.0, 0.0, 0.0]])
    assert recognize(sims) == [0] * 5
