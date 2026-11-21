import hashlib
import json
import sys
import types
from pathlib import Path

import pytest

from engine.analysis import Features
from engine.cli import main

FIXTURES = Path(__file__).parent / "fixtures"
VIDEO = "jv_i536nIvc"

NO_RECORDING = "La canzone non ha una registrazione: metti la tua in"
NO_CHORDS = "La canzone non ha accordi: non c'è niente da allineare."


@pytest.fixture(autouse=True)
def no_audio_module():
    sys.modules.pop("engine.audio", None)
    yield
    sys.modules.pop("engine.audio", None)


def _write(path: Path, text: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")
    return path


def test_a_song_without_a_link_or_own_recording_stops_before_loading_the_audio_stage(tmp_path, capsys):
    song = _write(tmp_path / "varie/senza_link.cho", "{title:Senza link}\n\n[Do]uno [Sol]due\n")
    assert main([str(song), "--recordings-dir", str(tmp_path / "registrazioni")]) == 1
    err = capsys.readouterr().err
    assert NO_RECORDING in err
    assert f"{tmp_path / 'registrazioni/varie/senza_link'}.m4a" in err
    assert "engine.audio" not in sys.modules


def test_two_own_recordings_of_a_song_are_an_error(tmp_path, capsys):
    _write(tmp_path / "registrazioni/canti_scout/la_gioia.m4a", "uno")
    _write(tmp_path / "registrazioni/canti_scout/la_gioia.wav", "due")
    args = ["canti_scout/la_gioia.cho", "--songs-dir", str(FIXTURES), "--recordings-dir", str(tmp_path / "registrazioni")]
    assert main(args + ["--cache-dir", str(tmp_path / "cache")]) == 1
    assert "ci sono più registrazioni della canzone (la_gioia.m4a, la_gioia.wav): tienine una." in capsys.readouterr().err
    assert "engine.audio" not in sys.modules


def test_a_song_without_chords_stops_before_loading_the_audio_stage(tmp_path, capsys):
    _write(tmp_path / "varie/senza_accordi.cho", f"{{title:Senza accordi}}\n{{x_youtube:{VIDEO}}}\n\nsolo testo\n")
    assert main(["varie/senza_accordi.cho", "--songs-dir", str(tmp_path)]) == 1
    assert NO_CHORDS in capsys.readouterr().err
    assert "engine.audio" not in sys.modules


def test_a_missing_song_is_an_error_without_traceback(tmp_path, capsys):
    assert main(["varie/non_esiste.cho", "--songs-dir", str(tmp_path)]) == 1
    assert "non_esiste.cho" in capsys.readouterr().err


class FakeAudio(types.ModuleType):
    """Stands in for engine.audio: records the stages run and returns the La gioia features."""

    STEMS = ("drums", "bass", "other", "vocals", "guitar", "piano")

    def __init__(self):
        super().__init__("engine.audio")
        self.calls: list[str] = []
        self.youtube_tools: bool | None = None
        self.prepared: Path | None = None

    def check_tools(self, youtube):
        self.calls.append("check_tools")
        self.youtube_tools = youtube

    def download(self, video, dest):
        self.calls.append("download")
        return _write(dest / "source.webm", "audio")

    def prepare(self, source, dest):
        self.calls.append("prepare")
        self.prepared = source
        return _write(dest / "stereo.wav", "wav"), _write(dest / "audio.m4a", "m4a")

    def separate(self, stereo, stems):
        self.calls.append("separate")
        for name in self.STEMS:
            _write(stems / f"{name}.wav", "stem")

    def extract_features(self, stereo, stems):
        self.calls.append("extract_features")
        return Features.from_json(json.loads((FIXTURES / "la_gioia_features.json").read_text()))


def _run(fake, monkeypatch, cache, *flags, songs=FIXTURES):
    monkeypatch.setitem(sys.modules, "engine.audio", fake)
    recordings = cache / "registrazioni"
    args = ["canti_scout/la_gioia.cho", "--songs-dir", str(songs), "--recordings-dir", str(recordings)]
    return main(args + ["--cache-dir", str(cache), *flags])


def test_a_new_video_empties_the_cache_and_runs_every_stage(tmp_path, monkeypatch, capsys):
    song_cache = tmp_path / "canti_scout/la_gioia"
    _write(song_cache / "recording.txt", "youtube:AAAAAAAAAAA")
    _write(song_cache / "stems/guitar.wav", "old stem")
    fake = FakeAudio()

    assert _run(fake, monkeypatch, tmp_path) == 0

    assert fake.calls == ["check_tools", "download", "prepare", "separate", "extract_features"]
    assert fake.youtube_tools is True
    assert (song_cache / "recording.txt").read_text() == f"youtube:{VIDEO}"
    assert (song_cache / "stems/guitar.wav").read_text() == "stem"
    analysis = json.loads((song_cache / "analysis.json").read_text())
    assert analysis["song"] == "canti_scout/la_gioia.cho"
    assert analysis["source"] == {"kind": "youtube", "id": VIDEO}
    assert analysis["audio"] == "audio.m4a"
    out = capsys.readouterr().out
    assert "6/8" in out
    assert "Controlla e salva: http://localhost:5173/ritmo/canti_scout/la_gioia.cho" in out


def test_the_same_video_reuses_audio_and_stems(tmp_path, monkeypatch):
    fake = FakeAudio()
    assert _run(fake, monkeypatch, tmp_path) == 0
    fake.calls.clear()

    assert _run(fake, monkeypatch, tmp_path) == 0
    assert fake.calls == ["check_tools", "extract_features"]


def test_reanalyze_reuses_the_features(tmp_path, monkeypatch):
    fake = FakeAudio()
    assert _run(fake, monkeypatch, tmp_path) == 0
    (tmp_path / "canti_scout/la_gioia/analysis.json").unlink()
    fake.calls.clear()

    assert _run(fake, monkeypatch, tmp_path, "--reanalyze") == 0
    assert fake.calls == []
    assert (tmp_path / "canti_scout/la_gioia/analysis.json").exists()


def test_the_own_recording_wins_over_the_video_and_needs_no_download(tmp_path, monkeypatch, capsys):
    own = _write(tmp_path / "registrazioni/canti_scout/la_gioia.m4a", "la mia chitarra")
    digest = hashlib.sha256(b"la mia chitarra").hexdigest()
    fake = FakeAudio()

    assert _run(fake, monkeypatch, tmp_path) == 0

    assert fake.calls == ["check_tools", "prepare", "separate", "extract_features"]
    assert fake.youtube_tools is False
    assert fake.prepared == own
    song_cache = tmp_path / "canti_scout/la_gioia"
    assert (song_cache / "recording.txt").read_text() == f"file:{digest}"
    analysis = json.loads((song_cache / "analysis.json").read_text())
    assert analysis["source"] == {"kind": "file", "id": digest}
    assert f"Uso la tua registrazione: {own}" in capsys.readouterr().out


def test_a_song_without_a_link_is_analysed_on_the_own_recording(tmp_path, monkeypatch):
    text = (FIXTURES / "canti_scout/la_gioia.cho").read_text(encoding="utf-8")
    songs = tmp_path / "canzoni"
    _write(songs / "canti_scout/la_gioia.cho", "\n".join(l for l in text.split("\n") if "x_youtube" not in l))
    _write(tmp_path / "registrazioni/canti_scout/la_gioia.wav", "mia")
    fake = FakeAudio()

    assert _run(fake, monkeypatch, tmp_path, songs=songs) == 0
    assert "download" not in fake.calls
    analysis = json.loads((tmp_path / "canti_scout/la_gioia/analysis.json").read_text())
    assert analysis["source"]["kind"] == "file"


def test_adding_or_replacing_the_own_recording_empties_the_cache(tmp_path, monkeypatch):
    fake = FakeAudio()
    assert _run(fake, monkeypatch, tmp_path) == 0
    own = _write(tmp_path / "registrazioni/canti_scout/la_gioia.m4a", "prima")
    fake.calls.clear()

    assert _run(fake, monkeypatch, tmp_path) == 0
    assert fake.calls == ["check_tools", "prepare", "separate", "extract_features"]

    own.write_text("seconda", encoding="utf-8")
    fake.calls.clear()
    assert _run(fake, monkeypatch, tmp_path, "--reanalyze") == 0
    assert fake.calls == ["check_tools", "prepare", "separate", "extract_features"]


def test_the_same_own_recording_reuses_audio_and_stems(tmp_path, monkeypatch):
    _write(tmp_path / "registrazioni/canti_scout/la_gioia.m4a", "mia")
    fake = FakeAudio()
    assert _run(fake, monkeypatch, tmp_path) == 0
    fake.calls.clear()

    assert _run(fake, monkeypatch, tmp_path) == 0
    assert fake.calls == ["check_tools", "extract_features"]
