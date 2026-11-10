import numpy as np
import pytest

from engine.harmony import chord_template, same_chord


def nonzero(name):
    return np.flatnonzero(chord_template(name)).tolist()


def test_major_triad():
    t = chord_template("Do")
    assert t.shape == (12,)
    assert nonzero("Do") == [0, 4, 7]
    assert t[4] == t[7]
    assert t[4] / t[0] == pytest.approx(0.8)
    assert np.linalg.norm(t) == pytest.approx(1.0)


def test_minor_triad_has_root_weight():
    t = chord_template("Lam")
    assert nonzero("Lam") == [0, 4, 9]
    assert t[0] == t[4]
    assert t[0] / t[9] == pytest.approx(0.8)
    assert np.linalg.norm(t) == pytest.approx(1.0)


def test_dominant_seventh_includes_minor_seventh():
    assert nonzero("Re7") == [0, 2, 6, 9]


def test_major_seventh():
    assert nonzero("Domaj7") == [0, 4, 7, 11]


def test_minor_seventh_combines_tokens():
    assert nonzero("Rem7") == [0, 2, 5, 9]


def test_maj_is_not_minor():
    assert nonzero("Dom") == [0, 3, 7]
    assert nonzero("Domaj") == [0, 4, 7]
    assert nonzero("Domaj7") != nonzero("Dom7")


def test_suspended_diminished_and_augmented():
    assert nonzero("Dosus2") == [0, 2, 7]
    assert nonzero("Dosus4") == [0, 5, 7]
    assert nonzero("Dodim") == [0, 3, 6]
    assert nonzero("Doaug") == [0, 4, 8]
    assert nonzero("Sol7sus4") == [0, 2, 5, 7]


def test_slash_bass_on_a_chord_tone_reinforces_it():
    plain = chord_template("Sol")
    t = chord_template("Sol/Si")
    assert nonzero("Sol/Si") == [2, 7, 11]
    assert plain[11] / plain[7] == pytest.approx(0.8)
    assert t[11] / t[7] == pytest.approx(1.3)


def test_slash_bass_outside_the_chord_is_added_at_half_weight():
    t = chord_template("Do/Re")
    assert nonzero("Do/Re") == [0, 2, 4, 7]
    assert t[2] / t[0] == pytest.approx(0.5)


def test_slash_bass_that_is_not_a_note_is_ignored():
    assert np.allclose(chord_template("Sol6/9"), chord_template("Sol6"))
    assert np.allclose(chord_template("Fa#-7/4"), chord_template("Fa#-7"))


def test_accidentals():
    assert nonzero("Fa#") == [1, 6, 10]
    assert nonzero("Sib") == [2, 5, 10]
    assert nonzero("Reb") == [1, 5, 8]


def test_every_latin_root():
    roots = {"Do": 0, "Re": 2, "Mi": 4, "Fa": 5, "Sol": 7, "La": 9, "Si": 11}
    for name, pc in roots.items():
        assert chord_template(name).argmax() == pc


def test_leading_dash_means_minor():
    assert nonzero("La-7") == [0, 4, 7, 9]
    assert np.allclose(chord_template("La-7"), chord_template("Lam7"))
    assert np.allclose(chord_template("Fa#-7/4"), chord_template("Fa#m7"))
    assert np.allclose(chord_template("Do#-m7"), chord_template("Do#m7"))


def test_capital_m_and_plus_mean_major_seventh():
    assert nonzero("FaM7") == [0, 4, 5, 9]
    assert nonzero("FaMaj7") == [0, 4, 5, 9]
    assert np.allclose(chord_template("FaM7"), chord_template("Famaj7"))
    assert np.allclose(chord_template("LabM7"), chord_template("Labmaj7"))
    assert nonzero("Re7+") == [1, 2, 6, 9]
    assert np.allclose(chord_template("Si7+"), chord_template("Simaj7"))


def test_plain_seventh_is_still_minor_seventh():
    assert nonzero("Re7") == [0, 2, 6, 9]
    assert nonzero("Rem7") == [0, 2, 5, 9]


def test_unknown_suffix_text_is_ignored():
    assert np.allclose(chord_template("Doadd9"), chord_template("Do"))


def test_english_roots_read_like_latin_ones():
    assert np.allclose(chord_template("Em"), chord_template("Mim"))
    assert np.allclose(chord_template("G7"), chord_template("Sol7"))
    assert np.allclose(chord_template("Bm"), chord_template("Sim"))
    assert np.allclose(chord_template("F#m"), chord_template("Fa#m"))
    assert np.allclose(chord_template("Bb"), chord_template("Sib"))
    assert np.allclose(chord_template("Dm7"), chord_template("Rem7"))
    assert np.allclose(chord_template("G/B"), chord_template("Sol/Si"))
    assert nonzero("A") == [1, 4, 9]
    assert nonzero("C") == [0, 4, 7]


def test_latin_roots_win_over_english_ones():
    assert nonzero("Do") == [0, 4, 7]
    assert chord_template("Do").argmax() == 0
    assert nonzero("Dom") == [0, 3, 7]
    assert nonzero("D") == [2, 6, 9]
    assert nonzero("Dm") == [2, 5, 9]
    assert nonzero("Re") == [2, 6, 9]
    assert nonzero("Mi") == [4, 8, 11]
    assert nonzero("Fa") == [0, 5, 9]
    assert nonzero("Sol") == [2, 7, 11]


def test_unparseable_root_is_none():
    assert chord_template("X7") is None
    assert chord_template("H7") is None
    assert chord_template("") is None
    assert chord_template("/Sol") is None


def test_same_chord():
    assert same_chord("Do", "Do")
    assert not same_chord("Do", "Dom")
    assert not same_chord("Do", "Re")
    assert same_chord("Fa#", "Solb")


def test_same_chord_with_unparseable_names():
    assert not same_chord("X7", "Do")
    assert not same_chord("Do", "X7")
    assert not same_chord("X7", "H7")


def test_a_name_is_the_same_chord_as_itself_even_without_a_template():
    assert same_chord("X7", "X7")
    assert same_chord("", "")


def test_same_chord_across_notations():
    assert same_chord("Em", "Mim")
    assert same_chord("G7", "Sol7")
    assert not same_chord("Do", "D")
