"""Regression on «La gioia» (https://www.youtube.com/watch?v=jv_i536nIvc), from its recorded features.

The recording is voice and guitar. Its guitarist anticipates every change
from Fa to Do by half a bar (Do is strummed from the 4th eighth of the bar
before), which the teaching durations move back to the bar line, and, on the
.cho's lines with two bars of Do and two of Sol, plays Do, Do, Fa, Sol: the
Fa bar falls inside the .cho's Do span, so it is flagged against Do. The
guitar strikes every eighth of the bar but the second, in the verses and in the
chorus alike: the strokes the maintainer plays on the song (down, rest,
down-up, down-up in 3/4), with the accent on the fourth eighth instead of the
fifth.
"""

import json
from pathlib import Path

import pytest

from engine.analysis import Features, analyze
from engine.cho import parse_cho

FIXTURES = Path(__file__).parent / "fixtures"
SONG = parse_cho((FIXTURES / "canti_scout/la_gioia.cho").read_text(encoding="utf-8"))
META = {"song": "canti_scout/la_gioia.cho", "source": {"kind": "youtube", "id": "jv_i536nIvc"}, "analyzed": "2026-11-10", "audio": "audio.m4a"}

FA_AT_41 = (
    "over the Fa bar at 40.9-42.1 s the 6/8 beat chroma still fits Do (per sixth Fa 0.79-0.84, Do 0.58-0.67), "
    "so the free recognition (switching cost 2.5) hears Do on both beats and no disagreement falls within "
    "3 s of 41 s; the nearest is at 36.2 s (expected Fa, heard Do)"
)


@pytest.fixture(scope="module")
def analysis():
    features = Features.from_json(json.loads((FIXTURES / "la_gioia_features.json").read_text(encoding="utf-8")))
    return analyze(features, SONG, META)


def _near(reading, seconds):
    return [d for d in reading["disagreements"] if abs(d["time"] - seconds) <= 3]


def test_the_guitar_is_heard_in_the_songs_key(analysis):
    assert analysis["status"] == "heard"
    assert analysis["transpose"] == 0
    assert len(analysis["chords"]) == 122


def test_the_best_reading_is_six_eight_at_about_105(analysis):
    best = analysis["readings"][0]
    assert best["meter"] == "6/8"
    assert 100 <= best["bpm"] <= 110


def test_every_eighth_but_the_second_is_strummed_in_verse_and_chorus(analysis):
    best = analysis["readings"][0]
    assert best["pattern"] == "D.UDDU"
    assert best["chorusPattern"] is None
    assert analysis["readings"][1]["pattern"] == "D.DUDU"


def test_the_alternative_reading_is_three_four(analysis):
    assert analysis["readings"][1]["meter"] == "3/4"


def test_the_fa_bar_at_22_seconds_is_flagged(analysis):
    assert any(d["heard"] == "Fa" for d in _near(analysis["readings"][0], 22))


@pytest.mark.xfail(strict=True, reason=FA_AT_41)
def test_the_fa_bar_at_41_seconds_is_flagged(analysis):
    assert any(d["heard"] == "Fa" for d in _near(analysis["readings"][0], 41))


def test_the_first_verse_line_lasts_two_bars_per_chord(analysis):
    assert analysis["readings"][0]["durations"][4:8] == [4, 4, 4, 4]


def test_every_chord_of_the_first_verse_lasts_whole_bars(analysis):
    best = analysis["readings"][0]
    assert all(d % best["beatsPerBar"] == 0 for d in best["durations"][4:20])
