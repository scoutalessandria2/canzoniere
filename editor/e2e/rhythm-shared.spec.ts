import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { parse, serialize } from '../../shared/chordpro';
import { youtubeId, youtubeUrl } from '../../shared/youtube';
import {
	songChords,
	chordLayoutFingerprint,
	isRhythmFile,
	recordingSource,
	rhythmStaleness,
	sameSource,
	type RhythmFile
} from '../../shared/rhythm';
import { analyze } from '../src/lib/directives';

// Pure unit tests of the rhythm model shared by the editor, the reader and the
// Python engine: YouTube link, chord layout, saved-file validation.

const ID = 'jv_i536nIvc';
const HASH = 'a'.repeat(64); // SHA-256 of an own recording

test('youtubeId extracts the id from every link shape and rejects the rest', () => {
	for (const input of [
		ID,
		`  ${ID}  `,
		`https://www.youtube.com/watch?v=${ID}&t=42s`,
		`https://youtu.be/${ID}?si=x`,
		`https://m.youtube.com/watch?feature=share&v=${ID}`,
		`https://music.youtube.com/watch?v=${ID}&list=abc`,
		`https://www.youtube.com/shorts/${ID}`,
		`https://www.youtube.com/embed/${ID}`,
		`https://www.youtube.com/live/${ID}?feature=share`
	]) {
		expect(youtubeId(input), input).toBe(ID);
	}
	for (const input of [
		'',
		'https://vimeo.com/123',
		'jv_i536nIv',
		'jv_i536nIvcc',
		'https://www.youtube.com/watch?v=',
		'https://www.youtube.com/watch?v=jv_i536nIv'
	]) {
		expect(youtubeId(input), input).toBeNull();
	}
	expect(youtubeUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
});

test('x_youtube round-trips through parse/serialize, an invalid id stays a directive', () => {
	const song = parse(`{title:T}\n{x_scroll:3}\n{x_youtube:${ID}}\n\nuno\n`);
	expect(song.meta.youtube).toBe(ID);
	expect(song.lines).toHaveLength(1);
	expect(serialize(song)).toContain(`{x_scroll:3}\n{x_youtube:${ID}}\n\nuno`);
	expect(parse(serialize(song)).meta.youtube).toBe(ID);
	expect(parse('{title:T}\n\nuno').meta.youtube).toBeNull();
	expect(serialize(parse('{title:T}\n\nuno'))).not.toContain('x_youtube');

	const bad = parse('{title:T}\n{x_youtube:nope}\n\nuno');
	expect(bad.meta.youtube).toBeNull();
	expect(bad.lines[0]).toEqual({ type: 'directive', raw: '{x_youtube:nope}' });
});

const EXAMPLE = `{title:T}

[Do]uno [Fa]due
{c:Rit.}

{start_of_chorus}
[Sol]tre
{end_of_chorus}`;

test('songChords lists the chords of the lyric lines in reading order', () => {
	const chords = songChords(parse(EXAMPLE));
	expect(chords.map((c) => c.chord)).toEqual(['Do', 'Fa', 'Sol']);
	expect(chords.map((c) => c.line)).toEqual([0, 0, 2]);
	expect(chords.map((c) => c.chorus)).toEqual([false, false, true]);
	expect(chords.map((c) => c.text)).toEqual(['uno due', 'uno due', 'tre']);
	expect(chords[2].block).toBeGreaterThan(chords[1].block);
	expect(chords[1].block).toBe(chords[0].block);
});

test('songChords reads each line left to right and skips tabs and comments', () => {
	const chords = songChords(
		parse('{title:T}\n\n{start_of_tab}\ne|-0-|\n{end_of_tab}\n{c:[Re]no}\nA[Mi]b[Do]c\n')
	);
	expect(chords.map((c) => [c.chord, c.line])).toEqual([
		['Mi', 2],
		['Do', 2]
	]);
	const unsorted = parse('{title:T}\n\nab');
	unsorted.lines[0] = {
		type: 'lyric',
		text: 'ab',
		chords: [
			{ pos: 2, chord: 'Sol' },
			{ pos: 0, chord: 'Do' }
		]
	};
	expect(songChords(unsorted).map((c) => c.chord)).toEqual(['Do', 'Sol']);
});

test('the chord layout fingerprint ignores chord names, pauses and empty lines only', () => {
	const fp = chordLayoutFingerprint(parse(EXAMPLE));
	expect(fp).toMatch(/^[0-9a-f]{1,8}$/);
	expect(chordLayoutFingerprint(parse(EXAMPLE.replace('[Do]', '[Lam]').replace('[Fa]', '[Re]')))).toBe(
		fp
	);
	expect(chordLayoutFingerprint(parse(EXAMPLE.replace('due\n', 'due\n{x_pause:4}\n\n\n')))).toBe(fp);
	expect(chordLayoutFingerprint(parse(EXAMPLE.replace('uno', 'quattro')))).toBe(fp);
	// a chord added, moved to another line, removed
	expect(chordLayoutFingerprint(parse(EXAMPLE.replace('tre', 'tre [Do]sei')))).not.toBe(fp);
	expect(chordLayoutFingerprint(parse(EXAMPLE.replace('[Fa]due', 'due\n[Fa]')))).not.toBe(fp);
	expect(chordLayoutFingerprint(parse(EXAMPLE.replace('[Fa]', '')))).not.toBe(fp);
});

test('the chord layout fixtures match the TypeScript implementation', () => {
	const cases = JSON.parse(
		fs.readFileSync(path.resolve('../shared/fixtures/chord-layout.json'), 'utf-8')
	) as { source: string; chords: string[]; fingerprint: string }[];
	expect(cases).toHaveLength(4);
	for (const c of cases) {
		const song = parse(c.source);
		expect(songChords(song).map((x) => x.chord)).toEqual(c.chords);
		expect(chordLayoutFingerprint(song)).toBe(c.fingerprint);
	}
});

function file(): RhythmFile {
	return {
		version: 1,
		teaching: {
			fingerprint: chordLayoutFingerprint(parse(EXAMPLE)),
			status: 'heard',
			meter: '6/8',
			beatsPerBar: 2,
			slotsPerBeat: 3,
			bpm: 105,
			pattern: 'D..D..',
			chorusPattern: null,
			durations: [4, 4, 2],
			estimated: [false, false, true]
		},
		recording: {
			source: { kind: 'youtube', id: ID },
			analyzed: '2026-11-10',
			transpose: 0,
			beats: [0.312, 0.915],
			chordStarts: [0.312, null, 7.5],
			disagreements: [{ chord: 1, time: 22.1, expected: 'Sol', heard: 'Fa' }]
		}
	};
}

test('rhythmStaleness tells which part no longer matches the song', () => {
	const f = file();
	const linked = (src: string) => parse(src.replace('{title:T}', `{title:T}\n{x_youtube:${ID}}`));
	expect(rhythmStaleness(f, linked(EXAMPLE), null)).toEqual({ teaching: false, recording: false });
	// a chord added
	expect(rhythmStaleness(f, linked(EXAMPLE.replace('tre', 'tre [Do]sei')), null)).toEqual({
		teaching: true,
		recording: true
	});
	// only the link changed
	expect(
		rhythmStaleness(f, parse(EXAMPLE.replace('{title:T}', '{title:T}\n{x_youtube:AAAAAAAAAAA}')), null)
	).toEqual({ teaching: false, recording: true });
	// the link was removed
	expect(rhythmStaleness(f, parse(EXAMPLE), null)).toEqual({ teaching: false, recording: true });
	// an own recording appeared: the engine would now hear that one
	expect(rhythmStaleness(f, linked(EXAMPLE), HASH)).toEqual({ teaching: false, recording: true });
});

test('an own recording is the source while it is the same file, link or not', () => {
	const f = file();
	f.recording.source = { kind: 'file', id: HASH };
	expect(rhythmStaleness(f, parse(EXAMPLE), HASH)).toEqual({ teaching: false, recording: false });
	const linked = parse(EXAMPLE.replace('{title:T}', `{title:T}\n{x_youtube:${ID}}`));
	expect(rhythmStaleness(f, linked, HASH)).toEqual({ teaching: false, recording: false });
	// replaced, or removed
	expect(rhythmStaleness(f, linked, 'f'.repeat(64))).toEqual({ teaching: false, recording: true });
	expect(rhythmStaleness(f, linked, null)).toEqual({ teaching: false, recording: true });

	expect(recordingSource(linked, HASH)).toEqual({ kind: 'file', id: HASH });
	expect(recordingSource(linked, null)).toEqual({ kind: 'youtube', id: ID });
	expect(recordingSource(parse(EXAMPLE), null)).toBeNull();
	expect(sameSource({ kind: 'youtube', id: ID }, { kind: 'youtube', id: ID })).toBe(true);
	expect(sameSource({ kind: 'file', id: ID }, { kind: 'youtube', id: ID })).toBe(false);
	expect(sameSource(null, null)).toBe(false);
});

test('isRhythmFile accepts the saved format and checks every field', () => {
	expect(isRhythmFile(file())).toBe(true);
	const withChorus = file();
	withChorus.teaching.chorusPattern = 'D.DU.UDU'.slice(0, 6);
	withChorus.teaching.status = 'proposed';
	expect(isRhythmFile(withChorus)).toBe(true);
	expect(isRhythmFile(JSON.parse(JSON.stringify(file())))).toBe(true);
	const own = file();
	own.recording.source = { kind: 'file', id: HASH };
	expect(isRhythmFile(own)).toBe(true);

	const rejects: [string, (f: RhythmFile) => void][] = [
		['pattern too short', (f) => (f.teaching.pattern = 'D..D.')],
		['pattern too long', (f) => (f.teaching.pattern = 'D..D...')],
		['pattern with a wrong stroke', (f) => (f.teaching.pattern = 'D..X..')],
		['chorus pattern of the wrong length', (f) => (f.teaching.chorusPattern = 'D.D')],
		['a zero duration', (f) => (f.teaching.durations = [4, 0, 2])],
		['a fractional duration', (f) => (f.teaching.durations = [4, 1.5, 2])],
		['estimated of another length', (f) => (f.teaching.estimated = [false, false])],
		['estimated not booleans', (f) => ((f.teaching.estimated as unknown[])[0] = 0)],
		['status maybe', (f) => ((f.teaching as { status: string }).status = 'maybe')],
		['video abc', (f) => (f.recording.source = { kind: 'youtube', id: 'abc' })],
		['file hash too short', (f) => (f.recording.source = { kind: 'file', id: 'abc' })],
		['file hash in capitals', (f) => (f.recording.source = { kind: 'file', id: HASH.toUpperCase() })],
		['source of another kind', (f) => ((f.recording.source as { kind: string }).kind = 'vimeo')],
		['source missing', (f) => ((f.recording as { source?: unknown }).source = undefined)],
		['version 2', (f) => ((f as { version: number }).version = 2)],
		['meter not a fraction', (f) => (f.teaching.meter = 'sei ottavi')],
		['beatsPerBar 0', (f) => (f.teaching.beatsPerBar = 0)],
		['beatsPerBar 13', (f) => (f.teaching.beatsPerBar = 13)],
		['slotsPerBeat 5', (f) => (f.teaching.slotsPerBeat = 5)],
		['bpm 19', (f) => (f.teaching.bpm = 19)],
		['bpm 301', (f) => (f.teaching.bpm = 301)],
		['bpm NaN', (f) => (f.teaching.bpm = NaN)],
		['fingerprint missing', (f) => ((f.teaching as { fingerprint?: string }).fingerprint = undefined)],
		['beat Infinity', (f) => (f.recording.beats = [0.3, Infinity])],
		['chord start a string', (f) => ((f.recording.chordStarts as unknown[])[1] = '7.5')],
		['disagreement without a chord', (f) => ((f.recording.disagreements[0] as { chord?: number }).chord = undefined)],
		['disagreement time NaN', (f) => (f.recording.disagreements[0].time = NaN)],
		['transpose NaN', (f) => (f.recording.transpose = NaN)],
		['analyzed missing', (f) => ((f.recording as { analyzed?: string }).analyzed = undefined)]
	];
	for (const [name, mutate] of rejects) {
		const f = file();
		mutate(f);
		expect(isRhythmFile(f), name).toBe(false);
	}
	for (const junk of [null, undefined, 3, 'x', [], {}, { version: 1 }, { ...file(), recording: null }]) {
		expect(isRhythmFile(junk)).toBe(false);
	}
});

test('the directive checks flag an x_youtube value that is not a video id', () => {
	const problems = (line: string) => analyze(`uno\n${line}`).problems.map((p) => p.message);
	expect(problems('{x_youtube:abc}')).toEqual([
		"«x_youtube» vuole l'id di un video YouTube (11 caratteri)"
	]);
	expect(problems(`{x_youtube:https://youtu.be/${ID}}`)).toHaveLength(1);
	expect(problems('{x_youtube}')).toHaveLength(1);
	expect(problems(`{x_youtube:${ID}}`)).toEqual([]);
});

// shared/diagrams.ts imports a JSON file, which Node's loader refuses without an
// import attribute, so it is exercised through the dev server that bundles it.
// The page is one that loads the module (the song editor draws chord diagrams),
// which is what lets the dev server hand it out to the import below.
test('chordMidi gives the MIDI of each string of the diagram shape, null for muted strings and unknown chords', async ({
	page
}) => {
	await page.goto('/new');
	const sharedDiagrams = `/@fs${path.resolve('../shared/diagrams.ts')}`;
	const result = await page.evaluate(async (url) => {
		const { chordMidi } = await import(/* @vite-ignore */ url);
		return {
			Do: chordMidi('Do'),
			Lam: chordMidi('Lam'),
			Fa: chordMidi('Fa'),
			Solm: chordMidi('Solm'),
			Xyz: chordMidi('Xyz')
		};
	}, sharedDiagrams);
	// Do is x32010: the 6ª string is muted
	expect(result.Do).toEqual([null, 48, 52, 55, 60, 64]);
	// Lam is x02210
	expect(result.Lam).toEqual([null, 45, 52, 57, 60, 64]);
	// Fa is a barre at the first fret (1 3 3 2 1 1)
	expect(result.Fa).toEqual([41, 48, 53, 57, 60, 65]);
	// Solm is a barre drawn from the 3rd fret (base 3): 3 5 5 3 3 3
	expect(result.Solm).toEqual([43, 50, 55, 58, 62, 67]);
	expect(result.Xyz).toBeNull();
});
