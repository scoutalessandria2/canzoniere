"""Reads the parts of a ChordPro song the engine needs.

Mirrors `shared/chordpro.ts` (`parse`), `shared/pauses.ts` (`isTimedLine`) and
`shared/rhythm.ts` (`songChords`, `chordLayoutFingerprint`), so the chord
sequence, the timed-line indices and the layout fingerprint computed here are
the ones the editor and the reader compute. The cases of
`shared/fixtures/chord-layout.json` are checked against both implementations.

A timed line is one the reader renders as text: a lyric line, a comment, or a
whole `{start_of_tab}` block. `line` and the per-line lists count only those.
"""

import re
from dataclasses import dataclass

# The whitespace JavaScript's `\s` and `String.trim` know; Python's `\s` and
# `str.strip` cover a different set, and the two parsers must split lines alike.
_WS_CHARS = (
    "\t\n\v\f\r           "
    "       　﻿"
)
_WS = "[" + _WS_CHARS + "]"
_NOT_EOL = "[^\n\r  ]"

# {name} or {name: value}, like DIRECTIVE_RE in shared/chordpro.ts.
_DIRECTIVE = re.compile(
    r"\{" + _WS + r"*([A-Za-z0-9_-]+)" + _WS + r"*(?::" + _WS + r"*(" + _NOT_EOL + r"*?)" + _WS + r"*)?\}" + _WS + r"*"
)
_YOUTUBE_ID = re.compile(r"[A-Za-z0-9_-]{11}")

_END_OF_TAB = ("end_of_tab", "eot")
_START_OF_TAB = ("start_of_tab", "sot")
_START_OF_CHORUS = ("start_of_chorus", "soc")
_END_OF_CHORUS = ("end_of_chorus", "eoc")
_COMMENT = ("comment", "c")
# Directives that set metadata and leave no line behind.
_META = ("artist", "tag", "x_tag", "columns", "x_scroll")

_TIMED = ("lyric", "comment", "tab")


@dataclass
class ChoChord:
    name: str
    line: int  # index of the lyric line among the timed lines
    chorus: bool  # inside {start_of_chorus}...{end_of_chorus}
    block: int  # increments at every empty line and chorus start/end


@dataclass
class ChoSong:
    title: str
    youtube: str | None  # id from a valid {x_youtube:<id>}
    chords: list[ChoChord]  # reading order: lines top to bottom, each left to right
    chord_counts: list[int]  # chords on each timed line, 0 for comments and tabs
    line_texts: list[str]  # text of each timed line


@dataclass
class _Line:
    kind: str  # lyric, empty, chorus_start, chorus_end, comment, tab, other
    text: str = ""
    chords: tuple[tuple[int, str], ...] = ()  # (position in text, chord name)


def _js_strip(text: str) -> str:
    return text.strip(_WS_CHARS)


def _parse_lyric(raw: str) -> _Line:
    text = ""
    chords: list[tuple[int, str]] = []
    i = 0
    while i < len(raw):
        if raw[i] == "[":
            close = raw.find("]", i)
            if close != -1:
                chords.append((len(text), raw[i + 1 : close]))
                i = close + 1
                continue
        text += raw[i]
        i += 1
    return _Line("lyric", text, tuple(chords))


def _read_lines(text: str) -> tuple[str, str | None, list[_Line]]:
    title = ""
    youtube: str | None = None
    lines: list[_Line] = []
    tab: list[str] | None = None  # inside a tab block every line is kept verbatim

    for raw in re.split(r"\r?\n", text):
        m = _DIRECTIVE.fullmatch(raw)
        if tab is not None:
            if m and m.group(1).lower() in _END_OF_TAB:
                lines.append(_Line("tab", "\n".join(tab)))
                tab = None
            else:
                tab.append(raw)
            continue
        if m:
            name = m.group(1).lower()
            value = m.group(2) or ""
            if name in ("title", "t"):
                title = value
            elif name in _META:
                pass
            elif name == "x_youtube" and _YOUTUBE_ID.fullmatch(value):
                youtube = value
            elif name in _START_OF_CHORUS:
                lines.append(_Line("chorus_start"))
            elif name in _END_OF_CHORUS:
                lines.append(_Line("chorus_end"))
            elif name in _COMMENT:
                lines.append(_Line("comment", value))
            elif name in _START_OF_TAB:
                tab = []
            else:
                lines.append(_Line("other"))
        elif _js_strip(raw) == "":
            lines.append(_Line("empty"))
        else:
            lines.append(_parse_lyric(raw))

    # a tab block never closed still becomes a tab line
    if tab is not None:
        lines.append(_Line("tab", "\n".join(tab)))

    # leading and trailing empty lines left over from the metadata block do not count
    while lines and lines[0].kind == "empty":
        lines.pop(0)
    while lines and lines[-1].kind == "empty":
        lines.pop()

    return title, youtube, lines


def parse_cho(text: str) -> ChoSong:
    title, youtube, lines = _read_lines(text)

    chords: list[ChoChord] = []
    chord_counts: list[int] = []
    line_texts: list[str] = []
    line = -1
    block = 0
    chorus = False
    for l in lines:
        if l.kind in _TIMED:
            line += 1
            chord_counts.append(len(l.chords))
            line_texts.append(l.text)
        if l.kind == "empty":
            block += 1
        elif l.kind == "chorus_start":
            chorus = True
            block += 1
        elif l.kind == "chorus_end":
            chorus = False
            block += 1
        elif l.kind == "lyric":
            for _, name in sorted(l.chords, key=lambda c: c[0]):
                chords.append(ChoChord(name, line, chorus, block))

    return ChoSong(title, youtube, chords, chord_counts, line_texts)


def chord_layout_fingerprint(song: ChoSong) -> str:
    """FNV-1a 32-bit over the chord counts per timed line joined by commas.

    The counts string is plain ASCII, so hashing code points is hashing the
    UTF-16 units `chordLayoutFingerprint` hashes; the output is lowercase hex
    without padding, like `(hash >>> 0).toString(16)`.
    """
    text = ",".join(str(n) for n in song.chord_counts)
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return format(h, "x")
