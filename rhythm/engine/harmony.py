"""Chord names as 12-dimensional pitch-class templates.

A template has one weight per pitch class, C = 0 ... B = 11, scaled to unit
norm: the root weighs 1.0, every other chord tone 0.8, and a slash bass adds
0.5 on its pitch class (on top of the 0.8 when the bass is also a chord tone).

The name is a root, a suffix and an optional `/bass`. Roots are the Latin ones
the .cho uses (`Do Re Mi Fa Sol La Si`), and, when no Latin root fits, the
English letters (`C D E F G A B`), each optionally followed by `#` or `b`; Latin
roots are tried first, so `Do` is C and `Dm` is D minor.

The suffix is read left to right: `m` or `-` makes the third minor (`maj` does
not), `maj7`, `Maj7`, `M7` and `7+` add the major seventh, a plain `7` the
minor seventh, `sus2` and `sus4` replace the third, `dim` and `aug` alter the
fifth (`dim` also flattens the third). Any other text in the suffix (`add9`,
`6`, `4`...) is ignored, so such a chord reads as its triad with the extensions
above.
"""

import re

import numpy as np

_ROOTS = {
    "Do": 0,
    "Re": 2,
    "Mi": 4,
    "Fa": 5,
    "Sol": 7,
    "La": 9,
    "Si": 11,
    "C": 0,
    "D": 2,
    "E": 4,
    "F": 5,
    "G": 7,
    "A": 9,
    "B": 11,
}
# Alternation is ordered: the Latin names come before the English letters they start with.
_NOTE = re.compile(r"(Do|Re|Mi|Fa|Sol|La|Si|C|D|E|F|G|A|B)([#b]?)")
_SUFFIX_TOKEN = re.compile(r"[Mm]aj7|[Mm]aj|M7|7\+|sus2|sus4|dim|aug|m|-|7|.", re.DOTALL)

ROOT_WEIGHT = 1.0
TONE_WEIGHT = 0.8
BASS_WEIGHT = 0.5


def _pitch_class(note: str) -> tuple[int, str] | None:
    """The pitch class of a note name at the start of `note` and what follows it."""
    m = _NOTE.match(note)
    if not m:
        return None
    pc = _ROOTS[m.group(1)] + {"#": 1, "b": -1, "": 0}[m.group(2)]
    return pc % 12, note[m.end() :]


def _intervals(suffix: str) -> list[int]:
    third, fifth = 4, 7
    extra: list[int] = []
    for token in _SUFFIX_TOKEN.findall(suffix):
        if token in ("m", "-"):
            third = 3
        elif token in ("maj7", "Maj7", "M7", "7+"):
            extra.append(11)
        elif token in ("maj", "Maj"):
            pass
        elif token == "7":
            extra.append(10)
        elif token == "sus2":
            third = 2
        elif token == "sus4":
            third = 5
        elif token == "dim":
            third, fifth = 3, 6
        elif token == "aug":
            fifth = 8
    return [third, fifth, *extra]


def chord_template(name: str) -> np.ndarray | None:
    """The unit-norm template of a chord name, or None when its root cannot be read."""
    main, _, bass = name.partition("/")
    root = _pitch_class(main)
    if root is None:
        return None
    pc, suffix = root

    template = np.zeros(12)
    for interval in _intervals(suffix):
        template[(pc + interval) % 12] = TONE_WEIGHT
    template[pc] = ROOT_WEIGHT

    bass_note = _pitch_class(bass) if bass else None
    if bass_note is not None and bass_note[1] == "":
        template[bass_note[0]] += BASS_WEIGHT

    return template / np.linalg.norm(template)


def same_chord(a: str, b: str) -> bool:
    """Whether two names are the same chord: equal names, or equal templates (`Fa#` and `Solb`, `Em` and `Mim`).

    A name with no template is the same chord only as itself.
    """
    if a == b:
        return True
    ta, tb = chord_template(a), chord_template(b)
    return ta is not None and tb is not None and bool(np.allclose(ta, tb))
