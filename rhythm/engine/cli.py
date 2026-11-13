"""`python -m engine <song.cho> [--songs-dir DIR] [--recordings-dir DIR] [--cache-dir DIR] [--reanalyze]`.

Reads the song, runs the audio stage (audio, stems, features) into
`<cache>/<category>/<slug>/`, then the analysis, and writes `analysis.json`
there for the editor's review page.

The recording is the maintainer's own when there is one,
`<recordings>/<category>/<slug>.<any audio extension>` (`registrazioni/`, kept
out of the repository), otherwise the song's YouTube video (`{x_youtube}`).
The cache belongs to one recording, named in its `recording.txt`
(`youtube:<id>` or `file:<sha256>`): when the song's recording is another one,
or `recording.txt` is missing (a run that did not finish), the directory is
emptied first. Audio and stems already in the cache are reused; `--reanalyze`
also reuses the features and only runs the analysis.

The audio stage needs the model libraries, so `engine.audio` (and the
analysis, which imports this module) are loaded only once the song is known
to be analyzable.
"""

import argparse
import datetime
import hashlib
import importlib
import json
import shutil
import sys
from pathlib import Path

from engine.cho import parse_cho

RHYTHM_DIR = Path(__file__).resolve().parent.parent
AUDIO_FILE = "audio.m4a"
REVIEW_URL = "http://localhost:5173/ritmo"


class EngineError(Exception):
    """A failure explained to the user, printed without a traceback."""


def _arguments(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m engine",
        description="Ricava metro, tempo, pennata e durate degli accordi di una canzone dalla sua registrazione.",
    )
    parser.add_argument("song", help="il .cho, relativo a --songs-dir (es. canti_scout/la_gioia.cho) o assoluto")
    parser.add_argument(
        "--songs-dir", type=Path, default=RHYTHM_DIR.parent / "canzoni", help="cartella delle canzoni (canzoni/)"
    )
    parser.add_argument(
        "--recordings-dir",
        type=Path,
        default=RHYTHM_DIR.parent / "registrazioni",
        help="cartella delle tue registrazioni (registrazioni/)",
    )
    parser.add_argument(
        "--cache-dir", type=Path, default=RHYTHM_DIR / ".cache", help="cartella di audio e analisi (rhythm/.cache/)"
    )
    parser.add_argument(
        "--reanalyze", action="store_true", help="rifà solo l'analisi, con le caratteristiche audio già estratte"
    )
    return parser.parse_args(argv)


def _read(path: Path) -> str | None:
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return None


def _own_recording(recordings_dir: Path, category: str, slug: str) -> Path | None:
    """The maintainer's recording of the song, if any; more than one is an error."""
    folder = recordings_dir / category
    if not folder.is_dir():
        return None
    found = sorted(p for p in folder.iterdir() if p.stem == slug and not p.name.startswith(".") and p.is_file())
    if len(found) > 1:
        names = ", ".join(p.name for p in found)
        raise EngineError(f"In {folder} ci sono più registrazioni della canzone ({names}): tienine una.")
    return found[0] if found else None


def _sha256(path: Path) -> str:
    with path.open("rb") as f:
        return hashlib.file_digest(f, "sha256").hexdigest()


def _extract(source: dict, own: Path | None, cache: Path):
    audio = importlib.import_module("engine.audio")
    audio.check_tools(youtube=own is None)
    stereo, recording = cache / "stereo.wav", cache / AUDIO_FILE
    if not (stereo.exists() and recording.exists()):
        if own is not None:
            print(f"Uso la tua registrazione: {own}", flush=True)
            stereo, recording = audio.prepare(own, cache)
        else:
            print("Scarico l'audio da YouTube…", flush=True)
            stereo, recording = audio.prepare(audio.download(source["id"], cache), cache)
    stems = cache / "stems"
    if not all((stems / f"{name}.wav").exists() for name in audio.STEMS):
        print("Separo gli strumenti con Demucs (qualche minuto)…", flush=True)
        audio.separate(stereo, stems)
    print("Cerco battiti, colpi di chitarra e accordi…", flush=True)
    return audio.extract_features(stereo, stems)


def _summary(analysis: dict, review: str) -> None:
    best = analysis["readings"][0]
    others = [r["meter"] for r in analysis["readings"][1:]]
    pattern = best["pattern"]
    if best["chorusPattern"]:
        pattern += f" (ritornello {best['chorusPattern']})"
    status = "ascoltato dalla registrazione" if analysis["status"] == "heard" else "proposto, la chitarra si sente poco"
    print(f"Metro: {best['meter']}" + (f" (alternative: {', '.join(others)})" if others else ""))
    print(f"Tempo: {round(best['bpm'])} BPM")
    print(f"Pennata: {pattern}")
    print(f"Differenze con il .cho: {len(best['disagreements'])}")
    print(f"Stato: {status}")
    print(f"Controlla e salva: {review}")


def run(song_arg: str, songs_dir: Path, recordings_dir: Path, cache_dir: Path, reanalyze: bool) -> None:
    path = Path(song_arg) if Path(song_arg).is_absolute() else songs_dir / song_arg
    text = _read(path)
    if text is None:
        raise EngineError(f"Canzone non trovata: {path}")
    song = parse_cho(text)
    category, file = path.parent.name, path.name
    own = _own_recording(recordings_dir, category, path.stem)
    if own is None and song.youtube is None:
        raise EngineError(
            f"La canzone non ha una registrazione: metti la tua in {recordings_dir / category / path.stem}.m4a "
            "(va bene anche mp3 o wav) oppure aggiungi il link YouTube nei metadati dall'editor."
        )
    if not song.chords:
        raise EngineError("La canzone non ha accordi: non c'è niente da allineare.")
    source = {"kind": "file", "id": _sha256(own)} if own is not None else {"kind": "youtube", "id": song.youtube}

    from engine.analysis import Features, analyze

    cache = cache_dir / category / path.stem
    identity = f"{source['kind']}:{source['id']}"
    if cache.exists() and _read(cache / "recording.txt") != identity:
        shutil.rmtree(cache)
    cache.mkdir(parents=True, exist_ok=True)

    features_path = cache / "features.json"
    if reanalyze and features_path.exists():
        features = Features.from_json(json.loads(features_path.read_text(encoding="utf-8")))
    else:
        features = _extract(source, own, cache)
        features_path.write_text(json.dumps(features.to_json(), separators=(",", ":")), encoding="utf-8")
        (cache / "recording.txt").write_text(identity, encoding="utf-8")

    meta = {
        "song": f"{category}/{file}",
        "source": source,
        "analyzed": datetime.date.today().isoformat(),
        "audio": AUDIO_FILE,
    }
    analysis = analyze(features, song, meta)
    (cache / "analysis.json").write_text(json.dumps(analysis, ensure_ascii=False), encoding="utf-8")
    _summary(analysis, f"{REVIEW_URL}/{category}/{file}")


def main(argv: list[str]) -> int:
    args = _arguments(argv)
    try:
        run(args.song, args.songs_dir, args.recordings_dir, args.cache_dir, args.reanalyze)
    except EngineError as error:
        print(error, file=sys.stderr)
        return 1
    return 0
