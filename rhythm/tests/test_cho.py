import json
from pathlib import Path

import pytest

from engine.cho import chord_layout_fingerprint, parse_cho

FIXTURE = Path(__file__).parents[2] / "shared/fixtures/chord-layout.json"
CASES = json.loads(FIXTURE.read_text(encoding="utf-8"))


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["fingerprint"])
def test_fixture_chords_and_fingerprint(case):
    song = parse_cho(case["source"])
    assert [c.name for c in song.chords] == case["chords"]
    assert chord_layout_fingerprint(song) == case["fingerprint"]


def test_la_gioia_fixture_has_122_chords():
    song = parse_cho(CASES[0]["source"])
    assert len(song.chords) == 122
    assert chord_layout_fingerprint(song) == "8586720f"


def test_title_and_youtube():
    song = parse_cho("{title:Canzone}\n{x_youtube:jv_i536nIvc}\n\n[Do]uno\n")
    assert song.title == "Canzone"
    assert song.youtube == "jv_i536nIvc"


def test_short_title_directive():
    assert parse_cho("{t:Breve}\n[Do]uno\n").title == "Breve"


def test_invalid_youtube_is_ignored():
    assert parse_cho("{title:T}\n{x_youtube:nope}\n[Do]uno\n").youtube is None
    assert parse_cho("{title:T}\n{x_youtube:}\n[Do]uno\n").youtube is None
    assert parse_cho("{title:T}\n[Do]uno\n").youtube is None


def test_chorus_and_block_flags():
    song = parse_cho(
        "{title:T}\n\n[Do]uno [Fa]due\n{c:Rit.}\n\n{start_of_chorus}\n[Sol]tre\n{end_of_chorus}"
    )
    assert [c.name for c in song.chords] == ["Do", "Fa", "Sol"]
    assert [c.line for c in song.chords] == [0, 0, 2]
    assert [c.chorus for c in song.chords] == [False, False, True]
    assert song.chords[2].block > song.chords[1].block
    assert song.chords[0].block == song.chords[1].block


def test_every_empty_line_increments_block():
    song = parse_cho("[Do]a\n\n\n[Fa]b\n")
    assert song.chords[1].block == song.chords[0].block + 2


def test_chords_are_sorted_by_position_within_a_line():
    song = parse_cho("[Do]ab[Fa]cd[Sol]\n")
    assert [c.name for c in song.chords] == ["Do", "Fa", "Sol"]


def test_unclosed_bracket_is_text():
    song = parse_cho("[Do]uno [due\n")
    assert [c.name for c in song.chords] == ["Do"]
    assert song.line_texts == ["uno [due"]


def test_chord_counts_and_line_texts_cover_timed_lines():
    song = parse_cho(
        "{title:T}\n\n{comment:Intro}\n{start_of_tab}\ne|-0-|\nB|---|\n{end_of_tab}\n\n"
        "[Do]Prima [Sol]riga\n{x_pause:3}\n{c:Rit.}\nseconda\n"
    )
    assert song.chord_counts == [0, 0, 2, 0, 0]
    assert song.line_texts == ["Intro", "e|-0-|\nB|---|", "Prima riga", "Rit.", "seconda"]


def test_unclosed_tab_block_is_one_timed_line():
    song = parse_cho("{sot}\ne|-0-|\n[Do]x\n")
    assert song.chord_counts == [0]
    assert song.chords == []


def test_crlf_line_endings():
    song = parse_cho("{title:T}\r\n\r\n[Do]uno\r\n[Fa]due\r\n")
    assert [c.name for c in song.chords] == ["Do", "Fa"]
    assert song.line_texts == ["uno", "due"]


def test_unknown_directives_are_not_timed_lines():
    song = parse_cho("{title:T}\n{transpose:2}\n{chorus}\n[Do]uno\n")
    assert song.chord_counts == [1]


def test_fingerprint_ignores_lyrics_and_chord_names():
    a = parse_cho("[Do]uno [Fa]due\n")
    b = parse_cho("[Sol]xx [Re]yyyy\n")
    assert chord_layout_fingerprint(a) == chord_layout_fingerprint(b)
