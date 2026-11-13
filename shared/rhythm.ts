// The strumming-rhythm model shared by the editor, the reader and the Python
// engine in rhythm/: the song's chord sequence and its layout fingerprint, and
// the format of the `<song>.rhythm.json` file saved next to each .cho.
//
// A rhythm file has a teaching part (meter, tempo, patterns, chord durations),
// valid while the song's chord layout is the one it was made for, and a
// recording part (beats and chord times heard on one recording), valid only
// for that recording.

import type { Song } from './chordpro';
import { isTimedLine } from './pauses';
import { YOUTUBE_ID_RE } from './youtube';

// Down, up, or a slot where the hand swings without touching the strings.
export type Stroke = 'D' | 'U' | '.';

export interface SongChord {
	chord: string;
	line: number; // index of the lyric line among the song's timed lines
	text: string; // the lyric line's text
	chorus: boolean; // inside {start_of_chorus}…{end_of_chorus}
	block: number; // increments at every empty line and chorus start/end
}

// The chords of the lyric lines in reading order: lines top to bottom, each
// line left to right.
export function songChords(song: Song): SongChord[] {
	const out: SongChord[] = [];
	let line = -1;
	let block = 0;
	let chorus = false;
	for (const l of song.lines) {
		if (isTimedLine(l)) line++;
		switch (l.type) {
			case 'empty':
				block++;
				break;
			case 'chorus_start':
				chorus = true;
				block++;
				break;
			case 'chorus_end':
				chorus = false;
				block++;
				break;
			case 'lyric':
				for (const c of [...l.chords].sort((a, b) => a.pos - b.pos)) {
					out.push({ chord: c.chord, line, text: l.text, chorus, block });
				}
				break;
		}
	}
	return out;
}

// FNV-1a over the number of chords on each timed line, joined by commas:
// identifies where the chords sit in the song, so a rhythm made for one
// version is never applied to another. Chord names, lyrics, pauses and blank
// lines do not change it. The Python engine computes the same string.
export function chordLayoutFingerprint(song: Song): string {
	const text = song.lines
		.filter(isTimedLine)
		.map((l) => (l.type === 'lyric' ? l.chords.length : 0))
		.join(',');
	let hash = 0x811c9dc5;
	for (let i = 0; i < text.length; i++) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16);
}

export type RhythmStatus = 'heard' | 'proposed';

export interface RhythmTeaching {
	fingerprint: string; // chordLayoutFingerprint of the song it was made for
	status: RhythmStatus; // heard on the recording's guitar, or a typical pattern for the meter
	meter: string; // e.g. "6/8"
	beatsPerBar: number;
	slotsPerBeat: number;
	bpm: number;
	pattern: string; // Stroke characters, one per slot: beatsPerBar * slotsPerBeat
	chorusPattern: string | null; // same length, when the chorus is strummed differently
	durations: number[]; // beats of each chord of songChords
	estimated: boolean[]; // per chord: the duration was not measured on the recording
}

export interface RhythmDisagreement {
	chord: number; // index in songChords
	time: number; // seconds
	expected: string;
	heard: string;
}

// The recording a song is analysed on: its YouTube video ({x_youtube}), or
// the maintainer's own recording kept on their computer, outside the
// repository, known only by the SHA-256 of its bytes (lowercase hex).
export type RhythmSource = { kind: 'youtube'; id: string } | { kind: 'file'; id: string };

export function isRhythmSource(x: unknown): x is RhythmSource {
	if (!isObject(x) || typeof x.id !== 'string') return false;
	if (x.kind === 'youtube') return YOUTUBE_ID_RE.test(x.id);
	return x.kind === 'file' && /^[0-9a-f]{64}$/.test(x.id);
}

export function sameSource(a: RhythmSource | null, b: RhythmSource | null): boolean {
	return a !== null && b !== null && a.kind === b.kind && a.id === b.id;
}

// The recording the engine analyses a song on: the maintainer's own, when
// there is one (`fileHash`), otherwise the song's YouTube video, if any.
export function recordingSource(song: Song, fileHash: string | null): RhythmSource | null {
	if (fileHash !== null) return { kind: 'file', id: fileHash };
	return song.meta.youtube === null ? null : { kind: 'youtube', id: song.meta.youtube };
}

export interface RhythmRecording {
	source: RhythmSource; // the recording the times refer to
	analyzed: string; // date of the analysis
	transpose: number; // semitones between the recording and the song's key
	beats: number[]; // seconds of each beat of the meter, from a downbeat
	chordStarts: (number | null)[]; // seconds each chord starts at, per chord
	disagreements: RhythmDisagreement[];
}

export interface RhythmFile {
	version: 1;
	teaching: RhythmTeaching;
	recording: RhythmRecording;
}

function isObject(x: unknown): x is Record<string, unknown> {
	return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function isNumber(x: unknown): x is number {
	return typeof x === 'number' && Number.isFinite(x);
}

function isIntIn(x: unknown, min: number, max: number): x is number {
	return typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;
}

function isPattern(x: unknown, length: number): boolean {
	return typeof x === 'string' && x.length === length && /^[DU.]+$/.test(x);
}

function isTeaching(t: unknown): t is RhythmTeaching {
	if (!isObject(t)) return false;
	if (typeof t.fingerprint !== 'string' || !/^[0-9a-f]{1,8}$/.test(t.fingerprint)) return false;
	if (t.status !== 'heard' && t.status !== 'proposed') return false;
	if (typeof t.meter !== 'string' || !/^\d+\/\d+$/.test(t.meter)) return false;
	if (!isIntIn(t.beatsPerBar, 1, 12) || !isIntIn(t.slotsPerBeat, 1, 4)) return false;
	if (!isNumber(t.bpm) || t.bpm < 20 || t.bpm > 300) return false;
	const slots = t.beatsPerBar * t.slotsPerBeat;
	if (!isPattern(t.pattern, slots)) return false;
	if (t.chorusPattern !== null && !isPattern(t.chorusPattern, slots)) return false;
	if (!Array.isArray(t.durations) || !t.durations.every((d) => isIntIn(d, 1, Infinity))) {
		return false;
	}
	return (
		Array.isArray(t.estimated) &&
		t.estimated.length === t.durations.length &&
		t.estimated.every((e) => typeof e === 'boolean')
	);
}

function isDisagreement(d: unknown): d is RhythmDisagreement {
	return (
		isObject(d) &&
		isIntIn(d.chord, 0, Infinity) &&
		isNumber(d.time) &&
		typeof d.expected === 'string' &&
		typeof d.heard === 'string'
	);
}

function isRecording(r: unknown): r is RhythmRecording {
	if (!isObject(r)) return false;
	return (
		isRhythmSource(r.source) &&
		typeof r.analyzed === 'string' &&
		r.analyzed !== '' &&
		isNumber(r.transpose) &&
		Array.isArray(r.beats) &&
		r.beats.every(isNumber) &&
		Array.isArray(r.chordStarts) &&
		r.chordStarts.every((s) => s === null || isNumber(s)) &&
		Array.isArray(r.disagreements) &&
		r.disagreements.every(isDisagreement)
	);
}

// Whether a parsed JSON value is a well-formed rhythm file: every field, so a
// hand-edited or truncated file is refused instead of misread.
export function isRhythmFile(x: unknown): x is RhythmFile {
	return isObject(x) && x.version === 1 && isTeaching(x.teaching) && isRecording(x.recording);
}

// Which parts of a saved rhythm no longer fit the song: the teaching when the
// chord layout changed; the recording as well then, and also when the song's
// recording (see recordingSource) is missing or is not the one it was heard on.
export function rhythmStaleness(
	file: RhythmFile,
	song: Song,
	fileHash: string | null
): { teaching: boolean; recording: boolean } {
	const teaching = file.teaching.fingerprint !== chordLayoutFingerprint(song);
	const recording = teaching || !sameSource(recordingSource(song, fileHash), file.recording.source);
	return { teaching, recording };
}
