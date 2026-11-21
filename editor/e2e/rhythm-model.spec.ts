import { test, expect } from '@playwright/test';
import { isRhythmFile, type RhythmFile } from '../../shared/rhythm';
import {
	initialState,
	selectReading,
	setDuration,
	confirmDuration,
	cycleSlot,
	teachingBars,
	recordingEvents,
	teachingEvents,
	toRhythmFile,
	type AnalysisReading,
	type RhythmAnalysis
} from '../src/lib/rhythm-model';

// Pure unit tests of the review page's model: the state the page edits, the
// events the player schedules, the file it saves.

const ID = 'jv_i536nIvc';

function analysis(): RhythmAnalysis {
	const fourFour: AnalysisReading = {
		meter: '4/4',
		beatsPerBar: 4,
		slotsPerBeat: 2,
		score: 0.61,
		bpm: 120.4,
		beats: [0.5, 1.0, 1.5, 2.0],
		beatChord: [0, 0, 1, 1],
		pattern: 'D.DU.UDU',
		chorusPattern: null,
		durations: [2, 2],
		estimated: [false, true],
		chordStarts: [0.5, 1.5],
		disagreements: [{ chord: 1, time: 1.5, expected: 'Fa', heard: 'Sol' }]
	};
	const twoFour: AnalysisReading = {
		meter: '2/4',
		beatsPerBar: 2,
		slotsPerBeat: 2,
		score: 0.4,
		bpm: 119.6,
		beats: [0.5, 1.0, 1.5, 2.0],
		beatChord: [0, 0, 1, 1],
		pattern: 'D.DU',
		chorusPattern: 'DUDU',
		durations: [2, 2],
		estimated: [true, false],
		chordStarts: [0.5, null],
		disagreements: []
	};
	return {
		version: 1,
		song: 'varie/prova.cho',
		source: { kind: 'youtube', id: ID },
		analyzed: '2026-11-10',
		audio: 'audio.m4a',
		fingerprint: 'abc123',
		guitarShare: 0.9,
		status: 'heard',
		transpose: 0,
		chords: ['Do', 'Fa'],
		readings: [fourFour, twoFour]
	};
}

function saved(): RhythmFile {
	return {
		version: 1,
		teaching: {
			fingerprint: 'abc123',
			status: 'proposed',
			meter: '2/4',
			beatsPerBar: 2,
			slotsPerBeat: 2,
			bpm: 95,
			pattern: 'DUDU',
			chorusPattern: null,
			durations: [3, 1],
			estimated: [false, false]
		},
		recording: {
			source: { kind: 'youtube', id: ID },
			analyzed: '2026-11-10',
			transpose: 0,
			beats: [0.5, 1.0],
			chordStarts: [0.5, null],
			disagreements: []
		}
	};
}

test('initialState without saved data takes the best reading and the analysis status', () => {
	const state = initialState(analysis(), null, 'abc123');
	expect(state).toEqual({
		reading: 0,
		bpm: 120,
		pattern: 'D.DU.UDU',
		chorusPattern: null,
		durations: [2, 2],
		estimated: [false, true],
		status: 'heard'
	});
});

test('initialState restores a saved teaching that fits the song and one of the readings', () => {
	const state = initialState(analysis(), saved(), 'abc123');
	expect(state).toEqual({
		reading: 1,
		bpm: 95,
		pattern: 'DUDU',
		chorusPattern: null,
		durations: [3, 1],
		estimated: [false, false],
		status: 'proposed'
	});
});

test('initialState ignores a saved teaching made for another chord layout or another grid', () => {
	const fresh = initialState(analysis(), null, 'abc123');
	// another chord layout
	expect(initialState(analysis(), saved(), 'ffffffff')).toEqual(fresh);
	// a meter none of the readings has
	const otherMeter = saved();
	otherMeter.teaching.meter = '3/4';
	otherMeter.teaching.beatsPerBar = 3;
	expect(initialState(analysis(), otherMeter, 'abc123')).toEqual(fresh);
	// the same meter name on another grid
	const otherGrid = saved();
	otherGrid.teaching.slotsPerBeat = 3;
	otherGrid.teaching.pattern = 'DUDUDU';
	expect(initialState(analysis(), otherGrid, 'abc123')).toEqual(fresh);
});

test('selectReading takes pattern, durations and tempo from that reading and copies them', () => {
	const a = analysis();
	const state = selectReading(a, 1, 'proposed');
	expect(state).toEqual({
		reading: 1,
		bpm: 120,
		pattern: 'D.DU',
		chorusPattern: 'DUDU',
		durations: [2, 2],
		estimated: [true, false],
		status: 'proposed'
	});
	state.durations[0] = 9;
	state.estimated[0] = false;
	expect(a.readings[1].durations).toEqual([2, 2]);
	expect(a.readings[1].estimated).toEqual([true, false]);
});

test('setDuration clamps to one beat and clears the estimated mark, confirmDuration only the mark', () => {
	const state = selectReading(analysis(), 1, 'heard');
	const zero = setDuration(state, 0, 0);
	expect(zero.durations).toEqual([1, 2]);
	expect(zero.estimated).toEqual([false, false]);
	expect(setDuration(state, 1, 6).durations).toEqual([2, 6]);
	expect(setDuration(state, 1, -3).durations).toEqual([2, 1]);
	expect(setDuration(state, 1, 2.6).durations).toEqual([2, 3]);
	expect(setDuration(state, 1, NaN)).toBe(state);
	expect(setDuration(state, 7, 3)).toBe(state);

	const confirmed = confirmDuration(state, 0);
	expect(confirmed.durations).toEqual([2, 2]);
	expect(confirmed.estimated).toEqual([false, false]);
	// the input state is left alone
	expect(state.durations).toEqual([2, 2]);
	expect(state.estimated).toEqual([true, false]);
});

test('cycleSlot goes down, up, rest and back to down', () => {
	expect(cycleSlot('D.', 1)).toBe('DD');
	expect(cycleSlot('DD', 1)).toBe('DU');
	expect(cycleSlot('DU', 1)).toBe('D.');
	expect(cycleSlot('D.', 0)).toBe('U.');
	expect(cycleSlot('U.', 0)).toBe('..');
	expect(cycleSlot('..', 0)).toBe('D.');
	expect(cycleSlot('D.', 5)).toBe('D.');
});

test('teachingBars splits chords across bar lines and keeps a trailing incomplete bar', () => {
	expect(teachingBars([6, 2], 4)).toEqual([
		[{ chord: 0, beats: 4 }],
		[
			{ chord: 0, beats: 2 },
			{ chord: 1, beats: 2 }
		]
	]);
	expect(teachingBars([2, 2, 2], 4)).toEqual([
		[
			{ chord: 0, beats: 2 },
			{ chord: 1, beats: 2 }
		],
		[{ chord: 2, beats: 2 }]
	]);
	expect(teachingBars([9], 2)).toEqual([
		[{ chord: 0, beats: 2 }],
		[{ chord: 0, beats: 2 }],
		[{ chord: 0, beats: 2 }],
		[{ chord: 0, beats: 2 }],
		[{ chord: 0, beats: 1 }]
	]);
	expect(teachingBars([], 4)).toEqual([]);
});

const RECORDED: AnalysisReading = {
	...analysis().readings[0],
	beats: [0, 0.5, 1, 1.5],
	beatChord: [0, 0, 1, 1]
};

test('recordingEvents puts a click on every beat and a strum on every sounding slot of an aligned beat', () => {
	const events = recordingEvents(RECORDED, 'DUDUDUDU', null, [false, false]);
	const clicks = events.filter((e) => e.kind === 'click');
	const strums = events.filter((e) => e.kind === 'strum');
	expect(clicks.map((e) => e.at)).toEqual([0, 0.5, 1, 1.5]);
	expect(clicks.map((e) => e.accent)).toEqual([true, false, false, false]);
	expect(strums).toHaveLength(8);
	expect(strums.map((e) => e.chord)).toEqual([0, 0, 0, 0, 1, 1, 1, 1]);
	// two slots per beat, the second halfway to the next beat; the last beat
	// takes the length of the one before it
	expect(strums.map((e) => e.at)).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75]);
	expect(strums.map((e) => e.down)).toEqual([true, false, true, false, true, false, true, false]);
	expect(strums.every((e) => !e.accent)).toBe(true);
	// time order, a click before the strum that falls on the same instant
	expect(events.map((e) => e.at)).toEqual([...events.map((e) => e.at)].sort((a, b) => a - b));
	expect(events[0].kind).toBe('click');
	expect(events[1].kind).toBe('strum');
});

test('recordingEvents skips strums on beats with no chord and rests in the pattern', () => {
	const unaligned = { ...RECORDED, beatChord: [-1, 0, 1, -1] };
	const events = recordingEvents(unaligned, 'D.DUDUD.', null, [false, false]);
	expect(events.filter((e) => e.kind === 'click')).toHaveLength(4);
	// beat 1 plays slots 2-3 (D U), beat 2 slots 4-5 (D U)
	const strums = events.filter((e) => e.kind === 'strum');
	expect(strums.map((e) => [e.at, e.chord, e.down])).toEqual([
		[0.5, 0, true],
		[0.75, 0, false],
		[1, 1, true],
		[1.25, 1, false]
	]);
	expect(events.filter((e) => e.kind === 'click').map((e) => e.chord)).toEqual([-1, 0, 1, -1]);
});

test('recordingEvents accents the first beat of every bar and strums the chorus pattern on chorus chords', () => {
	const twoFour = analysis().readings[1];
	const events = recordingEvents({ ...twoFour, beatChord: [0, 0, 1, 1] }, 'D.DU', 'DUDU', [
		false,
		true
	]);
	expect(events.filter((e) => e.kind === 'click').map((e) => e.accent)).toEqual([
		true,
		false,
		true,
		false
	]);
	const strums = events.filter((e) => e.kind === 'strum');
	// chord 0 plays the pattern (D . D U), chord 1 the chorus pattern (D U D U)
	expect(strums.filter((e) => e.chord === 0).map((e) => e.down)).toEqual([true, true, false]);
	expect(strums.filter((e) => e.chord === 1).map((e) => e.down)).toEqual([true, false, true, false]);
});

test('recordingEvents follows the recording when its tempo changes', () => {
	const events = recordingEvents(
		{ ...RECORDED, beats: [0, 0.625, 1.125, 1.625], beatChord: [0, 0, 0, 0] },
		'DUDUDUDU',
		null,
		[false]
	);
	const strums = events.filter((e) => e.kind === 'strum').map((e) => e.at);
	expect(strums).toEqual([0, 0.3125, 0.625, 0.875, 1.125, 1.375, 1.625, 1.875]);
});

test('recordingEvents keeps the beat before a gap in the beats as long as a usual beat', () => {
	// the engine skipped an irregular stretch between 1.5 s and 4 s
	const events = recordingEvents(
		{ ...RECORDED, beats: [0, 0.5, 1, 1.5, 4, 4.5, 5, 5.5], beatChord: [0, 0, 0, 0, 1, 1, 1, 1] },
		'DUDUDUDU',
		null,
		[false, false]
	);
	const strums = events.filter((e) => e.kind === 'strum').map((e) => e.at);
	expect(strums).toEqual([0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 4, 4.25, 4.5, 4.75, 5, 5.25, 5.5, 5.75]);
	expect(events.filter((e) => e.kind === 'click').map((e) => e.at)).toEqual([
		0, 0.5, 1, 1.5, 4, 4.5, 5, 5.5
	]);
});

test('teachingEvents runs from time zero at the state tempo through the durations', () => {
	const state = { ...selectReading(analysis(), 0, 'heard'), bpm: 120, pattern: 'DUDUDUDU' };
	state.durations = [4];
	const events = teachingEvents(state, analysis().readings[0], [false]);
	const strums = events.filter((e) => e.kind === 'strum');
	expect(events.filter((e) => e.kind === 'click').map((e) => e.at)).toEqual([0, 0.5, 1, 1.5]);
	expect(strums).toHaveLength(8);
	expect(strums[0].at).toBe(0);
	expect(strums[strums.length - 1].at).toBeLessThan(2);
	expect(strums.every((e) => e.chord === 0)).toBe(true);
});

test('teachingEvents assigns beats to chords by their duration and accents each bar', () => {
	const state = { ...selectReading(analysis(), 0, 'heard'), bpm: 60, pattern: 'D.D.D.D.' };
	state.durations = [3, 5];
	const events = teachingEvents(state, analysis().readings[0], [false, true]);
	const clicks = events.filter((e) => e.kind === 'click');
	expect(clicks.map((e) => e.at)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
	expect(clicks.map((e) => e.accent)).toEqual([true, false, false, false, true, false, false, false]);
	expect(clicks.map((e) => e.chord)).toEqual([0, 0, 0, 1, 1, 1, 1, 1]);
	expect(events.filter((e) => e.kind === 'strum').map((e) => [e.at, e.chord])).toEqual([
		[0, 0],
		[1, 0],
		[2, 0],
		[3, 1],
		[4, 1],
		[5, 1],
		[6, 1],
		[7, 1]
	]);

	// the chorus chord takes the chorus pattern
	const withChorus = { ...state, chorusPattern: 'U.U.U.U.' };
	const down = teachingEvents(withChorus, analysis().readings[0], [false, true])
		.filter((e) => e.kind === 'strum')
		.map((e) => [e.chord, e.down]);
	expect(down).toEqual([
		[0, true],
		[0, true],
		[0, true],
		[1, false],
		[1, false],
		[1, false],
		[1, false],
		[1, false]
	]);
});

test('toRhythmFile writes the selected reading as a valid rhythm file with rounded times', () => {
	const a = analysis();
	a.readings[1] = {
		...a.readings[1],
		beats: [0.31249, 0.9151, 1.5],
		chordStarts: [0.31249, null],
		disagreements: [{ chord: 1, time: 22.10049, expected: 'Sol', heard: 'Fa' }]
	};
	const state = { ...selectReading(a, 1, 'proposed'), bpm: 104.6 };
	const file = toRhythmFile(state, a);
	expect(isRhythmFile(file)).toBe(true);
	expect(file.teaching).toEqual({
		fingerprint: 'abc123',
		status: 'proposed',
		meter: '2/4',
		beatsPerBar: 2,
		slotsPerBeat: 2,
		bpm: 105,
		pattern: 'D.DU',
		chorusPattern: 'DUDU',
		durations: [2, 2],
		estimated: [true, false]
	});
	expect(file.recording).toEqual({
		source: { kind: 'youtube', id: ID },
		analyzed: '2026-11-10',
		transpose: 0,
		beats: [0.312, 0.915, 1.5],
		chordStarts: [0.312, null],
		disagreements: [{ chord: 1, time: 22.1, expected: 'Sol', heard: 'Fa' }]
	});
	// the file is detached from the state it was made from
	file.teaching.durations[0] = 9;
	expect(state.durations).toEqual([2, 2]);
});

test('a state that went through initialState, setDuration and confirmDuration saves a valid file', () => {
	const a = analysis();
	let state = initialState(a, null, 'abc123');
	state = setDuration(state, 0, 5);
	state = confirmDuration(state, 1);
	state = { ...state, pattern: cycleSlot(state.pattern, 1) };
	const file = toRhythmFile(state, a);
	expect(isRhythmFile(file)).toBe(true);
	expect(file.teaching.durations).toEqual([5, 2]);
	expect(file.teaching.estimated).toEqual([false, false]);
	expect(file.teaching.pattern).toBe('DDDU.UDU');
});
