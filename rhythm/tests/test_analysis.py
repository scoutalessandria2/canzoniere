import json
from pathlib import Path

from engine.analysis import GUITAR_SHARE_MIN, Features, analyze
from engine.cho import chord_layout_fingerprint, parse_cho
from engine.harmony import chord_template

# The analysis the editor's review page is tested against: it defines the keys
# of analysis.json that the engine has to write.
ANALYSIS_FIXTURE = Path(__file__).parents[2] / "editor/e2e/fixtures/rhythm-analysis.json"

SONG = parse_cho("{title:Prova}\n{x_youtube:jv_i536nIvc}\n\n" + "[Do]uno\n[Sol]due\n" * 6)
META = {"song": "varie/prova.cho", "source": {"kind": "youtube", "id": "jv_i536nIvc"}, "analyzed": "2026-11-10", "audio": "audio.m4a"}


def _features(guitar_share: float = 0.9, beats_per_bar: int = 4, onset: list[list[float]] | None = None) -> Features:
    """12 bars of 4/4 at 120 BPM, strummed on every eighth, Do and Sol a bar each.

    The tracker's bars have `beats_per_bar` beats: 2 hears the same song as
    24 bars of 2/4. `onset` replaces the strumming, one row per beat.
    """
    n = 48
    eighths = [1.0 if j == 0 else 0.8 if j == 6 else 0.05 for j in range(12)]
    chroma = []
    for k in range(n):
        template = chord_template("Do" if (k // 4) % 2 == 0 else "Sol")
        chroma.append([template.tolist()] * 6)
    return Features(
        beats=[0.25 + 0.5 * k for k in range(n)],
        downbeats=list(range(0, n, beats_per_bar)),
        onset=onset if onset is not None else [eighths] * n,
        chroma=chroma,
        guitar_share=guitar_share,
    )


def _drums() -> list[list[float]]:
    """A 4/4 drum groove on 48 beats: kick and snare on the beats, the first one louder, hi-hat on the eighths."""
    onset = []
    for k in range(48):
        phases = [0.05] * 12
        phases[0] = 1.0 if k % 4 == 0 else 0.7
        phases[6] = 0.5
        onset.append(phases)
    return onset


def _six_eight_features() -> Features:
    """8 verse bars strummed D..D.. and 4 chorus bars strummed D..D.U, a chord per bar.

    Tracker beats are dotted quarters, two per bar, at 100 BPM; slots fall on
    phases 0, 4 and 8 of a beat.
    """
    chords = ["Do", "Sol"] * 4 + ["Fa", "Do"] * 2
    onset, chroma = [], []
    for bar, name in enumerate(chords):
        for beat in range(2):
            phases = [0.0 if j in (3, 9) else 0.05 for j in range(12)]
            phases[0] = 1.0
            if bar >= 8 and beat == 1:
                phases[8] = 1.0
            onset.append(phases)
            chroma.append([chord_template(name).tolist()] * 6)
    return Features(
        beats=[0.25 + 0.6 * k for k in range(24)],
        downbeats=list(range(0, 24, 2)),
        onset=onset,
        chroma=chroma,
        guitar_share=0.9,
    )


SIX_EIGHT_SONG = parse_cho(
    "{title:Prova}\n\n"
    + "[Do]uno\n[Sol]due\n" * 4
    + "\n{start_of_chorus}\n"
    + "[Fa]tre\n[Do]quattro\n" * 2
    + "{end_of_chorus}\n"
)


def test_the_chorus_pattern_is_summarized_apart_from_the_verse():
    reading = analyze(_six_eight_features(), SIX_EIGHT_SONG, META)["readings"][0]
    assert reading["meter"] == "6/8"
    assert reading["durations"] == [2] * 12
    assert reading["pattern"] == "D..D.."
    assert reading["chorusPattern"] == "D..D.U"


def test_guitar_share_threshold():
    assert GUITAR_SHARE_MIN == 0.3


def test_a_four_four_strum_heard_on_the_guitar():
    result = analyze(_features(), SONG, META)
    assert result["status"] == "heard"
    assert result["version"] == 1
    assert result["song"] == "varie/prova.cho"
    assert result["fingerprint"] == chord_layout_fingerprint(SONG)
    assert result["chords"] == ["Do", "Sol"] * 6
    assert result["transpose"] == 0
    reading = result["readings"][0]
    assert reading["meter"] == "4/4"
    assert (reading["beatsPerBar"], reading["slotsPerBeat"]) == (4, 2)
    assert reading["pattern"] == "DUDUDUDU"
    assert reading["chorusPattern"] is None
    assert reading["bpm"] == 120.0
    assert reading["durations"] == [4] * 12
    assert reading["estimated"] == [False] * 12
    assert reading["beats"][:3] == [0.25, 0.75, 1.25]
    assert reading["beatChord"] == [i // 4 for i in range(48)]
    assert reading["chordStarts"] == [0.25 + 2.0 * i for i in range(12)]
    assert reading["disagreements"] == []


def test_without_an_audible_guitar_the_pattern_is_the_meters_default():
    result = analyze(_features(guitar_share=0.1), SONG, META)
    assert result["status"] == "proposed"
    assert result["guitarShare"] == 0.1
    reading = result["readings"][0]
    assert reading["pattern"] == "D.DU.UDU"
    assert reading["chorusPattern"] is None
    assert reading["durations"] == [4] * 12


def test_without_an_audible_guitar_a_drummed_four_four_still_gets_meter_and_tempo():
    result = analyze(_features(guitar_share=0.1, onset=_drums()), SONG, META)
    assert result["status"] == "proposed"
    assert [r["meter"] for r in result["readings"]] == ["4/4", "2/4"]
    best = result["readings"][0]
    assert (best["beatsPerBar"], best["slotsPerBeat"]) == (4, 2)
    assert best["bpm"] == 120.0
    assert best["pattern"] == "D.DU.UDU"
    assert best["chorusPattern"] is None
    assert best["durations"] == [4] * 12
    assert result["readings"][1]["pattern"] == "D.DU"


def _consistent(reading: dict, n_chords: int) -> None:
    """The invariants of a reading: whole bars from a downbeat, one chord index per beat, one entry per chord."""
    assert len(reading["beats"]) % reading["beatsPerBar"] == 0
    assert reading["beats"] == sorted(reading["beats"])
    assert len(reading["beatChord"]) == len(reading["beats"])
    assert len(reading["pattern"]) == reading["beatsPerBar"] * reading["slotsPerBeat"]
    assert len(reading["durations"]) == len(reading["estimated"]) == len(reading["chordStarts"]) == n_chords


def test_a_four_four_song_also_gets_a_two_four_reading_on_half_bars():
    result = analyze(_features(), SONG, META)
    assert [r["meter"] for r in result["readings"]] == ["4/4", "2/4"]
    four, two = result["readings"]
    assert two["score"] == four["score"]
    assert (two["beatsPerBar"], two["slotsPerBeat"]) == (2, 2)
    assert two["beats"] == four["beats"]
    assert two["beatChord"] == [i // 4 for i in range(48)]
    assert two["bpm"] == 120.0
    assert two["pattern"] == "DUDU"
    assert two["chorusPattern"] is None
    assert two["durations"] == [4] * 12
    assert two["estimated"] == [False] * 12
    assert two["chordStarts"] == four["chordStarts"]
    _consistent(two, 12)


def test_a_two_four_song_also_gets_a_four_four_reading_on_paired_bars():
    result = analyze(_features(beats_per_bar=2), SONG, META)
    assert [r["meter"] for r in result["readings"]] == ["2/4", "4/4"]
    two, four = result["readings"]
    assert (four["beatsPerBar"], four["slotsPerBeat"]) == (4, 2)
    assert four["beats"] == two["beats"]
    assert four["beatChord"] == [i // 4 for i in range(48)]
    assert four["pattern"] == "DUDUDUDU"
    assert four["durations"] == [4] * 12
    _consistent(four, 12)
    _consistent(two, 12)


def test_a_pairing_without_two_consecutive_bars_is_not_a_reading():
    # bars of 2 beats at 0 and 5, with an irregular stretch between them: no 4/4 bar fits
    full = _features(beats_per_bar=2)
    features = Features(full.beats[:7], [0, 2, 5], full.onset[:7], full.chroma[:7], 0.9)
    assert [r["meter"] for r in analyze(features, SONG, META)["readings"]] == ["2/4"]


def test_the_analysis_has_the_keys_of_the_data_format_and_is_plain_json():
    expected = json.loads(ANALYSIS_FIXTURE.read_text(encoding="utf-8"))
    result = analyze(_features(), SONG, META)
    assert expected["readings"]
    assert set(result) == set(expected)
    for reading in result["readings"]:
        for fixture_reading in expected["readings"]:
            assert set(reading) == set(fixture_reading)
    assert json.loads(json.dumps(result)) == result


def test_features_round_trip_through_json():
    features = _features()
    again = Features.from_json(json.loads(json.dumps(features.to_json())))
    assert again.beats == features.beats
    assert again.downbeats == features.downbeats
    assert again.guitar_share == features.guitar_share
    assert len(again.onset) == len(again.chroma) == 48
