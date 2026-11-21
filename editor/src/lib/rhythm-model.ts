// The analysis the Python engine in rhythm/ caches for a song, read by the
// review page: `rhythm/.cache/<category>/<slug>/analysis.json`. Seconds are
// positions on the recording's audio.

import type {
	RhythmDisagreement,
	RhythmFile,
	RhythmSource,
	RhythmStatus
} from '@canzoniere/shared/rhythm';

// One way of hearing the recording: a meter with its beats, strumming pattern
// and chord durations. The analysis holds one per candidate meter.
export interface AnalysisReading {
	meter: string; // e.g. "6/8"
	beatsPerBar: number;
	slotsPerBeat: number;
	score: number; // how well this meter fits the recording; readings are sorted by it, best first
	bpm: number;
	beats: number[]; // seconds of each beat of the meter, from a downbeat
	beatChord: number[]; // per beat: index in `chords`, or -1 when no chord is aligned (intro, outro, noise)
	pattern: string;
	chorusPattern: string | null;
	durations: number[]; // beats of each chord, one per `chords` item
	estimated: boolean[]; // per chord: the duration was not measured on the recording
	chordStarts: (number | null)[]; // seconds each chord starts at, one per `chords` item
	disagreements: RhythmDisagreement[];
}

export interface RhythmAnalysis {
	version: 1;
	song: string; // "<category>/<file>.cho"
	source: RhythmSource; // the recording the audio comes from
	analyzed: string; // date of the analysis
	audio: string; // file name of the cached audio, in the analysis' folder
	fingerprint: string; // chordLayoutFingerprint of the song when it was analysed
	guitarShare: number; // share of the recording where the guitar was heard
	status: RhythmStatus;
	transpose: number; // semitones between the recording and the song's key
	chords: string[]; // the song's chords in reading order (songChords)
	readings: AnalysisReading[];
}

// What the review page edits: the teaching rhythm, started from one of the
// analysis' readings.
export interface ReviewState {
	reading: number; // index in the analysis' readings
	bpm: number;
	pattern: string;
	chorusPattern: string | null;
	durations: number[]; // beats of each chord, one per song chord
	estimated: boolean[];
	status: RhythmStatus;
}

// The state a reading proposes, with its own copies of the arrays.
export function selectReading(
	analysis: RhythmAnalysis,
	index: number,
	status: ReviewState['status']
): ReviewState {
	const reading = analysis.readings[index];
	return {
		reading: index,
		bpm: Math.round(reading.bpm),
		pattern: reading.pattern,
		chorusPattern: reading.chorusPattern,
		durations: [...reading.durations],
		estimated: [...reading.estimated],
		status
	};
}

// The saved teaching when it was made for this chord layout and for a meter and
// grid the analysis has (that reading is then selected); otherwise the best
// reading with the analysis' status.
export function initialState(
	analysis: RhythmAnalysis,
	saved: RhythmFile | null,
	fingerprint: string
): ReviewState {
	const t = saved?.teaching;
	if (t && t.fingerprint === fingerprint) {
		const reading = analysis.readings.findIndex(
			(r) =>
				r.meter === t.meter && r.beatsPerBar === t.beatsPerBar && r.slotsPerBeat === t.slotsPerBeat
		);
		if (reading >= 0) {
			return {
				reading,
				bpm: t.bpm,
				pattern: t.pattern,
				chorusPattern: t.chorusPattern,
				durations: [...t.durations],
				estimated: [...t.estimated],
				status: t.status
			};
		}
	}
	return selectReading(analysis, 0, analysis.status);
}

// A chord's duration in whole beats, at least one; setting it settles the
// estimate. A value that is not a number, or a chord that does not exist, leaves
// the state as it is.
export function setDuration(state: ReviewState, chord: number, beats: number): ReviewState {
	if (!Number.isFinite(beats) || chord < 0 || chord >= state.durations.length) return state;
	const durations = [...state.durations];
	durations[chord] = Math.max(1, Math.round(beats));
	return confirmDuration({ ...state, durations }, chord);
}

// Accepts an estimated duration as it is.
export function confirmDuration(state: ReviewState, chord: number): ReviewState {
	if (chord < 0 || chord >= state.estimated.length) return state;
	const estimated = [...state.estimated];
	estimated[chord] = false;
	return { ...state, estimated };
}

const NEXT_STROKE: Record<string, string> = { D: 'U', U: '.', '.': 'D' };

// The pattern with one slot changed to its next stroke: down, up, rest, down.
export function cycleSlot(pattern: string, slot: number): string {
	if (slot < 0 || slot >= pattern.length) return pattern;
	return pattern.slice(0, slot) + (NEXT_STROKE[pattern[slot]] ?? 'D') + pattern.slice(slot + 1);
}

// The part of a chord that falls in one bar.
export interface BarSegment {
	chord: number; // index in the song's chords
	beats: number;
}

// The chords laid out in bars of `beatsPerBar` beats: a chord that lasts past
// a bar line continues in the next bar, and the last bar may be incomplete.
export function teachingBars(durations: number[], beatsPerBar: number): BarSegment[][] {
	const size = Math.max(1, Math.floor(beatsPerBar));
	const bars: BarSegment[][] = [];
	let bar: BarSegment[] = [];
	let room = size;
	durations.forEach((duration, chord) => {
		let left = duration;
		while (left > 0) {
			const beats = Math.min(left, room);
			bar.push({ chord, beats });
			left -= beats;
			room -= beats;
			if (room === 0) {
				bars.push(bar);
				bar = [];
				room = size;
			}
		}
	});
	if (bar.length > 0) bars.push(bar);
	return bars;
}

// One sound the player schedules, `at` seconds into the song.
export interface PlayEvent {
	at: number;
	kind: 'click' | 'strum';
	accent: boolean; // a click on the first beat of a bar
	chord: number; // index in the song's chords, -1 for none
	down: boolean; // the direction of a strum
}

// The clicks and strums of a run of beats, in time order. Beat k starts at
// `starts[k]` and lasts `spans[k]` seconds; its slots divide that span evenly.
// A strum plays on every slot of the pattern that is not a rest, on the beats
// that have a chord; the chorus pattern replaces the pattern on the beats of
// a chorus chord.
function beatEvents(
	starts: number[],
	spans: number[],
	beatChord: number[],
	reading: Pick<AnalysisReading, 'beatsPerBar' | 'slotsPerBeat'>,
	pattern: string,
	chorusPattern: string | null,
	chorus: boolean[]
): PlayEvent[] {
	const { beatsPerBar, slotsPerBeat } = reading;
	const events: PlayEvent[] = [];
	starts.forEach((start, k) => {
		const chord = beatChord[k] ?? -1;
		const inBar = k % beatsPerBar;
		events.push({ at: start, kind: 'click', accent: inBar === 0, chord, down: false });
		if (chord < 0) return;
		const strokes = chorusPattern !== null && chorus[chord] ? chorusPattern : pattern;
		for (let j = 0; j < slotsPerBeat; j++) {
			const stroke = strokes[inBar * slotsPerBeat + j];
			if (stroke !== 'D' && stroke !== 'U') continue;
			events.push({
				at: start + (spans[k] * j) / slotsPerBeat,
				kind: 'strum',
				accent: false,
				chord,
				down: stroke === 'D'
			});
		}
	});
	return events;
}

// A beat lasting more than this many median beats is a gap in the beats: the
// engine skips an irregular stretch of the recording (where the tracker's bars
// do not fit the meter), and such a gap lasts at least one and a half beats.
// Slower beats, as the tempo drifts, are followed as they are.
const GAP = 1.4;

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	const mid = sorted.length >> 1;
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// The sounds laid over the recording, at the beat times the engine found, so
// they follow its tempo changes. A beat lasts until the next one, the last one
// as long as the one before it; the beat before a gap lasts a median beat, so
// its strums are not spread across the gap. `chorus` tells, per chord, whether
// it sits in the chorus.
export function recordingEvents(
	reading: AnalysisReading,
	pattern: string,
	chorusPattern: string | null,
	chorus: boolean[]
): PlayEvent[] {
	const beats = reading.beats;
	const intervals = beats.slice(1).map((t, k) => t - beats[k]);
	const usual = intervals.length > 0 ? median(intervals) : 60 / reading.bpm;
	const spans = beats.map((_, k) => {
		const span = intervals[Math.min(k, intervals.length - 1)] ?? usual;
		return span > GAP * usual ? usual : span;
	});
	return beatEvents(beats, spans, reading.beatChord, reading, pattern, chorusPattern, chorus);
}

// The sounds of the version to learn: no recording, steady beats at the state's
// tempo, each chord lasting its duration.
export function teachingEvents(
	state: ReviewState,
	reading: AnalysisReading,
	chorus: boolean[]
): PlayEvent[] {
	const beatChord = state.durations.flatMap((beats, chord) =>
		Array<number>(Math.max(0, Math.floor(beats) || 0)).fill(chord)
	);
	const beat = 60 / state.bpm;
	return beatEvents(
		beatChord.map((_, k) => k * beat),
		beatChord.map(() => beat),
		beatChord,
		reading,
		state.pattern,
		state.chorusPattern,
		chorus
	);
}

function ms(seconds: number): number {
	return Math.round(seconds * 1000) / 1000;
}

// The rhythm file to save: the teaching as edited, and the recording data of
// the selected reading, with seconds rounded to milliseconds.
export function toRhythmFile(state: ReviewState, analysis: RhythmAnalysis): RhythmFile {
	const reading = analysis.readings[state.reading];
	return {
		version: 1,
		teaching: {
			fingerprint: analysis.fingerprint,
			status: state.status,
			meter: reading.meter,
			beatsPerBar: reading.beatsPerBar,
			slotsPerBeat: reading.slotsPerBeat,
			bpm: Math.round(state.bpm),
			pattern: state.pattern,
			chorusPattern: state.chorusPattern,
			durations: [...state.durations],
			estimated: [...state.estimated]
		},
		recording: {
			source: analysis.source,
			analyzed: analysis.analyzed,
			transpose: analysis.transpose,
			beats: reading.beats.map(ms),
			chordStarts: reading.chordStarts.map((t) => (t === null ? null : ms(t))),
			disagreements: reading.disagreements.map((d) => ({ ...d, time: ms(d.time) }))
		}
	};
}
