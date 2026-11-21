"""The audio stage: download, stereo mix, stems and the features the analysis reads.

The only module that imports librosa, soundfile, torch, demucs and beat_this;
the CLI loads it only when a song needs it. `yt-dlp` (YouTube recordings only)
and `ffmpeg` are run as system commands (Homebrew).

Models: Demucs `htdemucs_6s` (it has a guitar stem) driven through
`demucs.apply.apply_model` with soundfile for I/O, on Apple's GPU (`mps`) when
available; Beat This! (`final0` checkpoint, no DBN) for beats and downbeats on
the full mix. Their weights download into the user caches on first use.

The hits (onsets) and the chroma come from the guitar stem when the guitar is
audible (`GUITAR_SHARE_MIN`). Otherwise the hits come from all the non-vocal
stems, drums included, so subdivision and meter are still read on whatever
keeps the time, and the chroma from the non-vocal stems without the drums.
"""

import shutil
import subprocess
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf
import torch
from beat_this.inference import File2Beats
from demucs.apply import apply_model
from demucs.pretrained import get_model

from engine.analysis import GUITAR_SHARE_MIN, PHASES, SIXTHS, Features
from engine.cli import AUDIO_FILE, EngineError

DEMUCS_MODEL = "htdemucs_6s"
STEMS = ("drums", "bass", "other", "vocals", "guitar", "piano")
FEATURE_RATE = 22050
ONSET_HOP = 128
ONSET_WINDOW = 0.035  # seconds either side of a phase where its onset peak is looked for
CHROMA_HOP = 512


def check_tools(youtube: bool) -> None:
    tools = ("yt-dlp", "ffmpeg") if youtube else ("ffmpeg",)
    missing = [tool for tool in tools if shutil.which(tool) is None]
    if missing:
        names = " e ".join(missing)
        verb = "Manca" if len(missing) == 1 else "Mancano"
        raise EngineError(f"{verb} {names}: installa con «brew install {' '.join(missing)}».")


def download(video: str, dest: Path) -> Path:
    """The best audio track of the video, as `dest/source.<ext>`."""
    dest.mkdir(parents=True, exist_ok=True)
    url = f"https://www.youtube.com/watch?v={video}"
    result = subprocess.run(
        ["yt-dlp", "--quiet", "--no-warnings", "--no-playlist", "-f", "bestaudio/best"]
        + ["-o", str(dest / "source.%(ext)s"), "--", url],
        capture_output=True,
        text=True,
    )
    files = [p for p in dest.glob("source.*") if p.suffix not in (".part", ".ytdl")]
    if result.returncode != 0 or not files:
        raise EngineError(
            f"yt-dlp non è riuscito a scaricare {url}:\n{result.stderr.strip()}\n"
            "Se il video esiste, YouTube è cambiato: aggiorna yt-dlp con «brew upgrade yt-dlp»."
        )
    return files[0]


def _ffmpeg(*args) -> None:
    result = subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", *(str(a) for a in args)], capture_output=True, text=True
    )
    if result.returncode != 0:
        raise EngineError(f"ffmpeg non è riuscito a convertire l'audio:\n{result.stderr.strip()}")


def prepare(source: Path, dest: Path) -> tuple[Path, Path]:
    """`stereo.wav` (44.1 kHz, 2 channels, the source downmixed if it is 5.1) and the browser's AAC copy."""
    stereo, recording = dest / "stereo.wav", dest / AUDIO_FILE
    _ffmpeg("-i", source, "-vn", "-ac", 2, "-ar", 44100, stereo)
    _ffmpeg("-i", stereo, "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", recording)
    return stereo, recording


def separate(stereo: Path, stems: Path) -> None:
    """One WAV per Demucs source in `stems`."""
    model = get_model(DEMUCS_MODEL)
    model.eval()
    audio, sr = sf.read(stereo, always_2d=True, dtype="float32")
    if sr != model.samplerate:
        audio = librosa.resample(audio.T, orig_sr=sr, target_sr=model.samplerate).T
    wav = torch.from_numpy(np.ascontiguousarray(audio.T))
    ref = wav.mean(0)
    wav = (wav - ref.mean()) / ref.std()
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    with torch.no_grad():
        sources = apply_model(model, wav[None], device=device, shifts=1, split=True, overlap=0.25, progress=True)[0]
    sources = sources * ref.std() + ref.mean()
    stems.mkdir(parents=True, exist_ok=True)
    for name, source in zip(model.sources, sources):
        sf.write(stems / f"{name}.wav", source.cpu().numpy().T, model.samplerate)


def _rms(y: np.ndarray) -> float:
    return float(np.sqrt(np.mean(y**2)))


def extract_features(stereo: Path, stems: Path) -> Features:
    tracker = File2Beats(checkpoint_path="final0", device="cpu", dbn=False)
    beats, downbeat_times = (np.asarray(x, dtype=float) for x in tracker(str(stereo)))
    if len(beats) < 2:
        raise EngineError("Nella registrazione non si sente un battito.")
    downbeats = sorted({int(np.argmin(np.abs(beats - d))) for d in downbeat_times})
    gaps = np.append(np.diff(beats), beats[-1] - beats[-2])

    instruments = {
        name: librosa.load(stems / f"{name}.wav", sr=FEATURE_RATE, mono=True)[0] for name in STEMS if name != "vocals"
    }
    guitar = instruments["guitar"]
    mix = sum(instruments.values())
    guitar_share = _rms(guitar) / max(_rms(mix), 1e-12)
    heard_guitar = guitar_share >= GUITAR_SHARE_MIN

    hits_source = guitar if heard_guitar else mix
    envelope = librosa.onset.onset_strength(y=hits_source, sr=FEATURE_RATE, hop_length=ONSET_HOP, lag=1, max_size=3)
    envelope = envelope / max(float(np.percentile(envelope, 99)), 1e-9)
    times = librosa.times_like(envelope, sr=FEATURE_RATE, hop_length=ONSET_HOP)
    at = beats[:, None] + gaps[:, None] * np.arange(PHASES)[None, :] / PHASES
    lo = np.searchsorted(times, at - ONSET_WINDOW)
    hi = np.searchsorted(times, at + ONSET_WINDOW)
    onset = [[float(envelope[a:b].max()) if b > a else 0.0 for a, b in zip(lo_k, hi_k)] for lo_k, hi_k in zip(lo, hi)]

    if heard_guitar:
        harmonic_source = guitar
    else:
        harmonic_source = sum(y for name, y in instruments.items() if name != "drums")
    chroma = librosa.feature.chroma_cqt(
        y=librosa.effects.harmonic(harmonic_source), sr=FEATURE_RATE, hop_length=CHROMA_HOP
    )
    edges = beats[:, None] + gaps[:, None] * np.arange(SIXTHS + 1)[None, :] / SIXTHS
    frames = np.clip(librosa.time_to_frames(edges, sr=FEATURE_RATE, hop_length=CHROMA_HOP), 0, chroma.shape[1] - 1)
    beat_chroma = [
        [np.median(chroma[:, f[j] : max(f[j + 1], f[j] + 1)], axis=1).tolist() for j in range(SIXTHS)]
        for f in frames
    ]

    return Features(beats.tolist(), downbeats, onset, beat_chroma, guitar_share)
