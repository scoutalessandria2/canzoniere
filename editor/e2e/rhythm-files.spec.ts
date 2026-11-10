import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../../shared/chordpro';
import { chordLayoutFingerprint, isRhythmFile, type RhythmFile } from '../../shared/rhythm';
import type { RhythmAnalysis } from '../src/lib/rhythm-model';

// The server side of the rhythm files: the `.rhythm.json` next to its song, its
// follow-the-song behaviour on move and delete, and the cached audio.

test.describe.configure({ mode: 'serial' });

const SONGS = path.resolve('e2e/.tmp-songs');
const CACHE = path.resolve('e2e/.tmp-rhythm-cache');
const SONG = '/api/rhythm/varie/ritmo_file.cho';
const RHYTHM = path.join(SONGS, 'varie', 'ritmo_file.rhythm.json');

// The seeded song's chord layout, read once: the song moves between categories
// while the tests run.
let fingerprint: string | undefined;

function rhythmFile(): RhythmFile {
	fingerprint ??= chordLayoutFingerprint(
		parse(fs.readFileSync(path.join(SONGS, 'varie', 'ritmo_file.cho'), 'utf-8'))
	);
	return {
		version: 1,
		teaching: {
			fingerprint,
			status: 'heard',
			meter: '6/8',
			beatsPerBar: 2,
			slotsPerBeat: 3,
			bpm: 105,
			pattern: 'D..D..',
			chorusPattern: null,
			durations: [2, 2, 2, 2],
			estimated: [false, false, false, true]
		},
		recording: {
			source: { kind: 'youtube', id: 'jv_i536nIvc' },
			analyzed: '2026-11-10',
			transpose: 0,
			beats: [0.312, 0.915, 1.5],
			chordStarts: [0.312, 1.5, 2.1, null],
			disagreements: []
		}
	};
}

function analysis(audio: string): RhythmAnalysis {
	return {
		version: 1,
		song: 'varie/ritmo_file.cho',
		source: { kind: 'youtube', id: 'jv_i536nIvc' },
		analyzed: '2026-11-10',
		audio,
		fingerprint: rhythmFile().teaching.fingerprint,
		guitarShare: 0.9,
		status: 'heard',
		transpose: 0,
		chords: ['Do', 'Sol', 'Do', 'Sol'],
		readings: []
	};
}

test('PUT writes the rhythm file next to the song and answers ok', async ({ request }) => {
	const res = await request.put(SONG, { data: rhythmFile() });
	expect(res.status()).toBe(200);
	expect(await res.json()).toEqual({ ok: true });
	expect(JSON.parse(fs.readFileSync(RHYTHM, 'utf-8'))).toEqual(rhythmFile());
	expect(isRhythmFile(JSON.parse(fs.readFileSync(RHYTHM, 'utf-8')))).toBe(true);
	expect(fs.existsSync(path.join(SONGS, 'varie', 'ritmo_file.cho'))).toBe(true);
});

test('PUT refuses a malformed rhythm file and an unknown song, writing nothing', async ({
	request
}) => {
	const before = fs.readFileSync(RHYTHM, 'utf-8');

	const bad = rhythmFile();
	bad.teaching.pattern = 'DX';
	const res = await request.put(SONG, { data: bad });
	expect(res.status()).toBe(400);
	// the review page shows the message as it is
	expect((await res.json()).message).toBe('File del ritmo non valido');
	expect(fs.readFileSync(RHYTHM, 'utf-8')).toBe(before);

	expect((await request.put(SONG, { data: { version: 1 } })).status()).toBe(400);
	expect(
		(await request.put(SONG, { data: 'not json', headers: { 'content-type': 'text/plain' } })).status()
	).toBe(400);

	const missing = await request.put('/api/rhythm/varie/non_esiste.cho', { data: rhythmFile() });
	expect(missing.status()).toBe(404);
	expect((await missing.json()).message).toBe('Canzone non trovata');
	expect(fs.existsSync(path.join(SONGS, 'varie', 'non_esiste.rhythm.json'))).toBe(false);
});

test('moving the song moves its rhythm file, and a taken target refuses the move', async ({
	request
}) => {
	const cho = (category: string) => path.join(SONGS, category, 'ritmo_file.cho');
	const rhythm = (category: string) => path.join(SONGS, category, 'ritmo_file.rhythm.json');

	// a rhythm file already in the target blocks the move before anything changes
	fs.writeFileSync(rhythm('clan'), '{}\n', 'utf-8');
	const refused = await request.patch('/api/songs/varie/ritmo_file.cho', {
		data: { category: 'clan' }
	});
	expect(refused.status()).toBe(409);
	expect(fs.existsSync(cho('varie'))).toBe(true);
	expect(fs.existsSync(rhythm('varie'))).toBe(true);
	expect(fs.existsSync(cho('clan'))).toBe(false);
	fs.rmSync(rhythm('clan'));

	const moved = await request.patch('/api/songs/varie/ritmo_file.cho', {
		data: { category: 'clan' }
	});
	expect(moved.status()).toBe(200);
	expect(fs.existsSync(cho('clan'))).toBe(true);
	expect(fs.existsSync(rhythm('clan'))).toBe(true);
	expect(fs.existsSync(cho('varie'))).toBe(false);
	expect(fs.existsSync(rhythm('varie'))).toBe(false);
	expect(JSON.parse(fs.readFileSync(rhythm('clan'), 'utf-8'))).toEqual(rhythmFile());

	const back = await request.patch('/api/songs/clan/ritmo_file.cho', {
		data: { category: 'varie' }
	});
	expect(back.status()).toBe(200);
	expect(fs.existsSync(cho('varie'))).toBe(true);
	expect(fs.existsSync(rhythm('varie'))).toBe(true);
	expect(fs.existsSync(cho('clan'))).toBe(false);
	expect(fs.existsSync(rhythm('clan'))).toBe(false);
});

test('deleting the song deletes its rhythm file', async ({ request }) => {
	const file = 'ritmo_da_cancellare.cho';
	const content = fs
		.readFileSync(path.join(SONGS, 'varie', 'ritmo_file.cho'), 'utf-8')
		.replace('tag:Varie', 'tag:Clan');
	const created = await request.post('/api/songs', { data: { category: 'clan', file, content } });
	expect(created.status()).toBe(201);
	const saved = await request.put(`/api/rhythm/clan/${file}`, { data: rhythmFile() });
	expect(saved.status()).toBe(200);
	const cho = path.join(SONGS, 'clan', file);
	const rhythm = path.join(SONGS, 'clan', 'ritmo_da_cancellare.rhythm.json');
	expect(fs.existsSync(cho)).toBe(true);
	expect(fs.existsSync(rhythm)).toBe(true);

	expect((await request.delete(`/api/songs/clan/${file}`)).status()).toBe(200);
	expect(fs.existsSync(cho)).toBe(false);
	expect(fs.existsSync(rhythm)).toBe(false);
});

test('the audio route answers 404 for a song without a cached analysis', async ({ request }) => {
	expect((await request.get('/api/rhythm/varie/stella_del_mattino.cho/audio')).status()).toBe(404);
	const missing = await request.get('/api/rhythm/varie/non_esiste.cho/audio');
	expect(missing.status()).toBe(404);
	expect((await missing.json()).message).toBe('Registrazione non trovata');
	expect((await request.get('/api/rhythm/..%2F..%2Fvarie/ritmo_file.cho/audio')).status()).toBe(404);
	expect((await request.put('/api/rhythm/..%2Fclan/ritmo_file.cho', { data: rhythmFile() })).status()).toBe(404);
});

test('the audio route streams the cached audio the analysis names, with byte ranges', async ({
	request
}) => {
	const dir = path.join(CACHE, 'varie', 'ritmo_file');
	const url = `${SONG}/audio`;
	const bytes = Buffer.from('0123456789abcdef');
	fs.mkdirSync(dir, { recursive: true });
	try {
		// the analysis names a file that is not there
		fs.writeFileSync(path.join(dir, 'analysis.json'), JSON.stringify(analysis('audio.wav')));
		expect((await request.get(url)).status()).toBe(404);

		fs.writeFileSync(path.join(dir, 'audio.wav'), bytes);
		const full = await request.get(url);
		expect(full.status()).toBe(200);
		expect(full.headers()['content-type']).toBe('audio/wav');
		expect(full.headers()['accept-ranges']).toBe('bytes');
		expect(Buffer.from(await full.body()).equals(bytes)).toBe(true);

		const part = await request.get(url, { headers: { range: 'bytes=2-5' } });
		expect(part.status()).toBe(206);
		expect(part.headers()['content-range']).toBe('bytes 2-5/16');
		expect(Buffer.from(await part.body()).toString()).toBe('2345');

		const tail = await request.get(url, { headers: { range: 'bytes=-4' } });
		expect(tail.status()).toBe(206);
		expect(Buffer.from(await tail.body()).toString()).toBe('cdef');

		const open = await request.get(url, { headers: { range: 'bytes=10-' } });
		expect(open.status()).toBe(206);
		expect(Buffer.from(await open.body()).toString()).toBe('abcdef');

		const beyond = await request.get(url, { headers: { range: 'bytes=20-30' } });
		expect(beyond.status()).toBe(416);

		// an .m4a is served as audio/mp4
		fs.writeFileSync(path.join(dir, 'analysis.json'), JSON.stringify(analysis('audio.m4a')));
		fs.writeFileSync(path.join(dir, 'audio.m4a'), bytes);
		const m4a = await request.get(url);
		expect(m4a.status()).toBe(200);
		expect(m4a.headers()['content-type']).toBe('audio/mp4');

		// the audio named in the analysis stays inside its own folder
		fs.writeFileSync(path.join(CACHE, 'fuori.wav'), bytes);
		fs.writeFileSync(
			path.join(dir, 'analysis.json'),
			JSON.stringify(analysis('../../fuori.wav'))
		);
		expect((await request.get(url)).status()).toBe(404);

		// an analysis that is not the known format is ignored
		fs.writeFileSync(path.join(dir, 'analysis.json'), '{"version": 2, "audio": "audio.wav"}');
		expect((await request.get(url)).status()).toBe(404);
		fs.writeFileSync(path.join(dir, 'analysis.json'), 'not json');
		expect((await request.get(url)).status()).toBe(404);
	} finally {
		// only this test's files: the review page's spec reads its own analysis from the cache
		fs.rmSync(dir, { recursive: true, force: true });
		fs.rmSync(path.join(CACHE, 'fuori.wav'), { force: true });
	}
});
