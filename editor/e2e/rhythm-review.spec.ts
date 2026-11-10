import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../../shared/chordpro';
import { chordLayoutFingerprint, isRhythmFile, type RhythmFile } from '../../shared/rhythm';
import { SEED_REVIEW as seed } from './global-setup';

// The review page of the rhythm engine's analysis. It edits its own seeded
// song, varie/ritmo_di_prova.cho, whose analysis (e2e/fixtures/rhythm-analysis.json)
// and three seconds of silent recording global-setup puts in the test cache.
// clan/senza_ritmo.cho has neither a recording link nor an analysis.
// No sound is checked: only what the page shows.

const SONGS = path.resolve('e2e/.tmp-songs');
const SONG = path.join(SONGS, 'varie', 'ritmo_di_prova.cho');
const RHYTHM = path.join(SONGS, 'varie', 'ritmo_di_prova.rhythm.json');
const PAGE_URL = '/ritmo/varie/ritmo_di_prova.cho';
const API = '/api/songs/varie/ritmo_di_prova.cho';
const RHYTHM_API = '/api/rhythm/varie/ritmo_di_prova.cho';
const EDIT_URL = '/edit/varie/ritmo_di_prova.cho';
const ANALYSIS = path.resolve('e2e/.tmp-rhythm-cache/varie/ritmo_di_prova/analysis.json');
const AUDIO_ROUTE = '**/api/rhythm/varie/ritmo_di_prova.cho/audio';

test.beforeEach(async ({ page }) => {
	page.on('pageerror', (e) => {
		throw new Error(`page error: ${e.message}`);
	});
	fs.writeFileSync(SONG, seed, 'utf-8');
	fs.rmSync(RHYTHM, { force: true });
});

test.afterAll(() => {
	fs.writeFileSync(SONG, seed, 'utf-8');
	fs.rmSync(RHYTHM, { force: true });
});

async function goto(page: Page, url: string) {
	await page.goto(url);
	await page.locator('body[data-hydrated]').waitFor();
}

function slots(page: Page) {
	return page.getByTestId('pattern').locator('[data-testid^="pattern-slot-"]');
}

test('shows the analysis: meter, tempo, pattern, chord durations and disagreements', async ({
	page
}) => {
	await goto(page, PAGE_URL);
	await expect(page.getByRole('heading', { level: 2 })).toHaveText('Ritmo — Ritmo di prova');
	await expect(page.locator('nav.crumbs a', { hasText: 'Ritmo di prova' })).toHaveAttribute(
		'href',
		'/edit/varie/ritmo_di_prova.cho'
	);

	const meter = page.getByTestId('rhythm-meter');
	await expect(meter.locator('option')).toHaveText(['4/4', '2/4']);
	await expect(meter.locator('option:checked')).toHaveText('4/4');
	await expect(page.getByTestId('rhythm-bpm')).toHaveValue('180');
	await expect(page.getByTestId('rhythm-status')).toHaveValue('heard');
	await expect(page.getByTestId('rhythm-status').locator('option')).toHaveText([
		'Ascoltato dalla registrazione',
		'Proposto'
	]);

	await expect(slots(page)).toHaveText(['↓', '·', '↓', '↑', '·', '↑', '↓', '↑']);
	await expect(page.getByTestId('pattern').getByTestId('pattern-count')).toHaveText([
		'1', 'e', '2', 'e', '3', 'e', '4', 'e'
	]);
	await expect(page.getByTestId('chorus-pattern')).toHaveCount(0);

	// two chords of four beats, one bar each; the second one's duration is an estimate
	await expect(page.getByTestId('bar')).toHaveCount(2);
	await expect(page.getByTestId('chord-0')).toContainText('Do');
	await expect(page.getByTestId('chord-0')).toContainText('Prima riga');
	await expect(page.getByTestId('chord-1')).toContainText('Sol');
	await expect(page.getByTestId('chord-1')).toContainText('se-conda');
	await expect(page.getByTestId('duration-0')).toHaveValue('4');
	await expect(page.getByTestId('duration-1')).toHaveValue('4');
	await expect(page.getByTestId('estimated-0')).toHaveCount(0);
	await expect(page.getByTestId('estimated-1')).toHaveText('stimata');

	const disagreements = page.getByTestId('disagreements').getByRole('button');
	await expect(disagreements).toHaveText([
		'0:02 · «se-conda» · nel .cho Sol, nella registrazione Fa'
	]);

	await expect(page.getByTestId('rhythm-other-recording')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-old-song')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-save')).toBeEnabled();
});

test('the pattern and the durations are edited and saved next to the song', async ({ page }) => {
	await goto(page, PAGE_URL);

	// a rest becomes a down stroke
	await page.getByTestId('pattern-slot-1').click();
	await expect(page.getByTestId('pattern-slot-1')).toHaveText('↓');

	// one more beat of Do: Sol starts in the second bar and ends in a third one
	await page.getByTestId('duration-plus-0').click();
	await expect(page.getByTestId('duration-0')).toHaveValue('5');
	const bars = page.getByTestId('bar');
	await expect(bars).toHaveCount(3);
	await expect(bars.nth(1)).toContainText('Do');
	await expect(bars.nth(1)).toContainText('Sol');
	await expect(bars.nth(2)).toContainText('Sol');

	// confirming the estimate keeps the duration
	await page.getByTestId('estimated-1').click();
	await expect(page.getByTestId('estimated-1')).toHaveCount(0);
	await expect(page.getByTestId('duration-1')).toHaveValue('4');

	await page.getByTestId('rhythm-status').selectOption('proposed');
	await page.getByTestId('rhythm-save').click();
	await expect(page.getByTestId('rhythm-save-status')).toHaveText('Salvato.');

	const saved = JSON.parse(fs.readFileSync(RHYTHM, 'utf-8'));
	expect(isRhythmFile(saved)).toBe(true);
	expect(saved.teaching).toMatchObject({
		status: 'proposed',
		meter: '4/4',
		beatsPerBar: 4,
		slotsPerBeat: 2,
		bpm: 180,
		pattern: 'DDDU.UDU',
		chorusPattern: null,
		durations: [5, 4],
		estimated: [false, false]
	});
	expect(saved.recording).toMatchObject({
		source: { kind: 'youtube', id: 'jv_i536nIvc' },
		chordStarts: [0.2, 1.533],
		disagreements: [{ chord: 1, time: 2.2, expected: 'Sol', heard: 'Fa' }]
	});

	// reopened, the page starts from what was saved
	await goto(page, PAGE_URL);
	await expect(slots(page)).toHaveText(['↓', '↓', '↓', '↑', '·', '↑', '↓', '↑']);
	await expect(page.getByTestId('duration-0')).toHaveValue('5');
	await expect(page.getByTestId('rhythm-status')).toHaveValue('proposed');
});

test('a duration stays between 1 and 64 beats', async ({ page }) => {
	await goto(page, PAGE_URL);
	const duration = page.getByTestId('duration-0');
	await duration.fill('100');
	await duration.blur();
	await expect(duration).toHaveValue('64');
	await expect(page.getByTestId('duration-plus-0')).toBeDisabled();

	await duration.fill('0');
	await duration.blur();
	await expect(duration).toHaveValue('1');
	await expect(page.getByTestId('duration-minus-0')).toBeDisabled();
});

test('switching the meter starts over from that reading', async ({ page }) => {
	await goto(page, PAGE_URL);
	await page.getByTestId('pattern-slot-1').click();
	await page.getByTestId('duration-plus-0').click();

	await page.getByTestId('rhythm-meter').selectOption({ label: '2/4' });
	await expect(slots(page)).toHaveText(['↓', '·', '↓', '↑']);
	await expect(page.getByTestId('pattern').getByTestId('pattern-count')).toHaveText([
		'1', 'e', '2', 'e'
	]);
	await expect(page.getByTestId('chorus-pattern')).toBeVisible();
	await expect(page.getByTestId('duration-0')).toHaveValue('2');
	await expect(page.getByTestId('duration-1')).toHaveValue('2');
	await expect(page.getByTestId('estimated-1')).toBeVisible();
	await expect(page.getByTestId('rhythm-bpm')).toHaveValue('90');
	await expect(page.getByTestId('bar')).toHaveCount(2);

	// back to 4/4: the edits made before are gone
	await page.getByTestId('rhythm-meter').selectOption({ label: '4/4' });
	await expect(slots(page)).toHaveText(['↓', '·', '↓', '↑', '·', '↑', '↓', '↑']);
	await expect(page.getByTestId('duration-0')).toHaveValue('4');
	await expect(page.getByTestId('chorus-pattern')).toHaveCount(0);
});

test('a reading with its own chorus pattern edits it apart from the verse and saves it', async ({
	page
}) => {
	await goto(page, PAGE_URL);
	await page.getByTestId('rhythm-meter').selectOption({ label: '2/4' });
	const verse = page.getByTestId('pattern');
	const chorus = page.getByTestId('chorus-pattern');
	await expect(verse).toHaveAttribute('aria-label', 'Strofa');
	await expect(chorus).toHaveAttribute('aria-label', 'Ritornello');
	const chorusSlots = chorus.locator('[data-testid^="chorus-pattern-slot-"]');
	await expect(chorusSlots).toHaveText(['↓', '↑', '↓', '↑']);

	// a down stroke of the chorus becomes an up stroke; the verse stays as it is
	await page.getByTestId('chorus-pattern-slot-2').click();
	await expect(chorusSlots).toHaveText(['↓', '↑', '↑', '↑']);
	await expect(slots(page)).toHaveText(['↓', '·', '↓', '↑']);

	await page.getByTestId('rhythm-save').click();
	await expect(page.getByTestId('rhythm-save-status')).toHaveText('Salvato.');
	const saved = JSON.parse(fs.readFileSync(RHYTHM, 'utf-8'));
	expect(isRhythmFile(saved)).toBe(true);
	expect(saved.teaching).toMatchObject({
		meter: '2/4',
		beatsPerBar: 2,
		slotsPerBeat: 2,
		pattern: 'D.DU',
		chorusPattern: 'DUUU'
	});

	// reopened, the page starts from the saved reading and its chorus pattern
	await goto(page, PAGE_URL);
	await expect(page.getByTestId('rhythm-meter').locator('option:checked')).toHaveText('2/4');
	await expect(chorusSlots).toHaveText(['↓', '↑', '↑', '↑']);
});

test('plays the recording and the version to learn, and seeks to chords and disagreements', async ({
	page
}) => {
	await goto(page, PAGE_URL);
	const play = page.getByTestId('rhythm-play');
	const mode = page.getByTestId('rhythm-mode');
	await expect(mode.getByRole('button', { name: 'Sulla registrazione' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByTestId('rhythm-click')).toBeChecked();
	await expect(page.getByTestId('rhythm-strum')).toBeChecked();

	// on the recording: the first press loads it, then it plays
	await expect(play).toHaveText('▶ Ascolta');
	await play.click();
	await expect(play).toHaveText('■ Ferma');
	await expect(page.getByTestId('rhythm-audio-error')).toHaveCount(0);
	await play.click();
	await expect(play).toHaveText('▶ Ascolta');

	// a chord seeks the recording to where the engine found it
	await page.getByTestId('chord-1').click();
	await expect(page.getByTestId('rhythm-position')).toHaveText('0:01');
	await expect(page.getByTestId('chord-1')).toHaveClass(/current/);
	await expect(page.getByTestId('chord-0')).not.toHaveClass(/current/);
	await page.getByTestId('chord-0').click();
	await expect(page.getByTestId('chord-0')).toHaveClass(/current/);

	// so does a disagreement
	await page.getByTestId('disagreements').getByRole('button').click();
	await expect(page.getByTestId('rhythm-position')).toHaveText('0:02');
	await expect(page.getByTestId('chord-1')).toHaveClass(/current/);

	// the version to learn plays without the recording
	await mode.getByRole('button', { name: 'Versione da imparare' }).click();
	await expect(mode.getByRole('button', { name: 'Versione da imparare' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(page.getByTestId('rhythm-position')).toHaveText('0:00');
	await expect(page.getByTestId('chord-1')).not.toHaveClass(/current/);
	await play.click();
	await expect(play).toHaveText('■ Ferma');
	await play.click();
	await expect(play).toHaveText('▶ Ascolta');
});

test('switching to the version to learn while the recording loads starts nothing', async ({
	page
}) => {
	// the recording arrives only once the mode has changed
	let release = () => {};
	const held = new Promise<void>((resolve) => (release = resolve));
	await page.route(AUDIO_ROUTE, async (route) => {
		await held;
		await route.continue();
	});
	await goto(page, PAGE_URL);
	const play = page.getByTestId('rhythm-play');
	const mode = page.getByTestId('rhythm-mode');

	await play.click();
	await expect(page.getByText('Carico la registrazione…')).toBeVisible();
	await mode.getByRole('button', { name: 'Versione da imparare' }).click();
	const loaded = page.waitForResponse(AUDIO_ROUTE);
	release();
	await (await loaded).finished();
	// time for the recording to decode: nothing may start once it has
	await page.waitForTimeout(500);
	expect((await play.innerText()).trim()).toBe('▶ Ascolta');

	// back on the recording, it is loaded and waits for a press
	await mode.getByRole('button', { name: 'Sulla registrazione' }).click();
	await expect(play).toBeEnabled();
	expect((await play.innerText()).trim()).toBe('▶ Ascolta');
	await play.click();
	await expect(play).toHaveText('■ Ferma');
	await play.click();
	await expect(play).toHaveText('▶ Ascolta');
});

test('the listening bar stays in view below the header while the page scrolls', async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 400 });
	await goto(page, PAGE_URL);
	await page.getByTestId('rhythm-save').scrollIntoViewIfNeeded();
	expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

	const bar = page.getByTestId('rhythm-listen');
	await expect(bar).toBeInViewport();
	const header = await page.locator('header.topbar').boundingBox();
	const box = await bar.boundingBox();
	expect(box!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
	await expect(page.getByTestId('rhythm-play')).toBeInViewport();
});

test('the source says how far the recording is transposed, one semitone in the singular', async ({
	page
}) => {
	const original = fs.readFileSync(ANALYSIS, 'utf-8');
	try {
		for (const [transpose, text] of [
			[1, '1 semitono sopra'],
			[2, '2 semitoni sopra'],
			[11, '1 semitono sotto']
		] as const) {
			fs.writeFileSync(ANALYSIS, JSON.stringify({ ...JSON.parse(original), transpose }), 'utf-8');
			await goto(page, PAGE_URL);
			await expect(page.locator('p.source')).toContainText(`, che suona ${text} la canzone.`);
		}
	} finally {
		fs.writeFileSync(ANALYSIS, original, 'utf-8');
	}
});

test('an analysis of another recording cannot be saved', async ({ page, request }) => {
	const res = await request.put(API, {
		data: { content: seed.replace('{x_youtube:jv_i536nIvc}', '{x_youtube:dQw4w9WgXcQ}') }
	});
	expect(res.ok()).toBe(true);
	await goto(page, PAGE_URL);
	await expect(page.getByTestId('rhythm-other-recording')).toHaveText(
		"L'analisi è di un'altra registrazione: rilancia il motore."
	);
	await expect(page.getByTestId('rhythm-command')).toHaveText(
		'make rhythm SONG=varie/ritmo_di_prova.cho'
	);
	await expect(page.getByTestId('rhythm-old-song')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-save')).toBeDisabled();
});

test('an analysis of an older version of the song cannot be saved', async ({ page, request }) => {
	const res = await request.put(API, {
		data: { content: seed.replace('[Do]Prima riga', '[Do]Prima [Fa]riga') }
	});
	expect(res.ok()).toBe(true);
	await goto(page, PAGE_URL);
	await expect(page.getByTestId('rhythm-old-song')).toHaveText(
		"L'analisi è di una versione precedente della canzone: rilancia il motore."
	);
	await expect(page.getByTestId('rhythm-other-recording')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-save')).toBeDisabled();
});

test('a song without analysis shows the command to run the engine', async ({ page }) => {
	await goto(page, '/ritmo/clan/senza_ritmo.cho');
	await expect(page.getByRole('heading', { level: 2 })).toHaveText('Ritmo — Senza ritmo');
	await expect(page.getByText('Nessuna analisi per questa canzone.')).toBeVisible();
	await expect(page.getByTestId('rhythm-no-recording')).toHaveText(
		'Prima metti la tua registrazione in registrazioni/clan/senza_ritmo.m4a (va bene anche mp3 o wav), oppure aggiungi il link YouTube nei metadati.'
	);
	await expect(page.getByTestId('rhythm-command')).toHaveText(
		'make rhythm SONG=clan/senza_ritmo.cho'
	);
	await expect(page.getByTestId('rhythm-play')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-save')).toHaveCount(0);
});

test('an unknown song is not found', async ({ page }) => {
	const res = await page.goto('/ritmo/varie/non_esiste.cho');
	expect(res?.status()).toBe(404);
});

// --- the song page: link to this page and notices on stale saved data ---

// A rhythm file that fits the seeded song, as the review page would save it.
function savedRhythm(): RhythmFile {
	return {
		version: 1,
		teaching: {
			fingerprint: chordLayoutFingerprint(parse(seed)),
			status: 'heard',
			meter: '4/4',
			beatsPerBar: 4,
			slotsPerBeat: 2,
			bpm: 180,
			pattern: 'D.DU.UDU',
			chorusPattern: null,
			durations: [4, 4],
			estimated: [false, false]
		},
		recording: {
			source: { kind: 'youtube', id: 'jv_i536nIvc' },
			analyzed: '2026-11-10',
			transpose: 0,
			beats: [0.2, 0.533, 0.866, 1.2],
			chordStarts: [0.2, 1.533],
			disagreements: []
		}
	};
}

async function saveRhythm(request: APIRequestContext) {
	const res = await request.put(RHYTHM_API, { data: savedRhythm() });
	expect(res.ok()).toBe(true);
}

async function saveSong(request: APIRequestContext, content: string) {
	const res = await request.put(API, { data: { content } });
	expect(res.ok()).toBe(true);
}

test('the song page and the review link to each other, without notices while the saved rhythm fits', async ({
	page,
	request
}) => {
	await saveRhythm(request);
	await goto(page, EDIT_URL);
	const link = page.getByTestId('rhythm-link');
	await expect(link).toHaveText('Ritmo');
	await expect(link).toHaveAttribute('href', PAGE_URL);
	await expect(page.getByTestId('rhythm-stale-teaching')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-stale-recording')).toHaveCount(0);

	await link.click();
	await expect(page).toHaveURL(PAGE_URL);
	await expect(page.getByRole('heading', { level: 2 })).toHaveText('Ritmo — Ritmo di prova');

	await page.getByTestId('rhythm-edit-link').click();
	await expect(page).toHaveURL(EDIT_URL);
	await expect(page.getByTestId('meta-title')).toHaveValue('Ritmo di prova');
});

test('a song with a video link but no saved rhythm still links to the review, without notices', async ({
	page
}) => {
	await goto(page, EDIT_URL);
	await expect(page.getByTestId('rhythm-link')).toHaveAttribute('href', PAGE_URL);
	await expect(page.getByTestId('rhythm-stale-teaching')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-stale-recording')).toHaveCount(0);
});

test('changing only the video link makes the recording stale, not the teaching', async ({
	page,
	request
}) => {
	await saveRhythm(request);
	await saveSong(request, seed.replace('{x_youtube:jv_i536nIvc}', '{x_youtube:dQw4w9WgXcQ}'));
	await goto(page, EDIT_URL);
	await expect(page.getByTestId('rhythm-link')).toHaveAttribute('href', PAGE_URL);
	await expect(page.getByTestId('rhythm-stale-recording')).toHaveText(
		'La registrazione è cambiata: rilancia il motore per aggiornare i tempi.'
	);
	await expect(page.getByTestId('rhythm-stale-teaching')).toHaveCount(0);
});

test('removing the video link keeps the link to the saved rhythm and flags the recording', async ({
	page,
	request
}) => {
	await saveRhythm(request);
	await saveSong(request, seed.replace('{x_youtube:jv_i536nIvc}\n', ''));
	await goto(page, EDIT_URL);
	await expect(page.getByTestId('rhythm-link')).toHaveAttribute('href', PAGE_URL);
	await expect(page.getByTestId('rhythm-stale-recording')).toBeVisible();
	await expect(page.getByTestId('rhythm-stale-teaching')).toHaveCount(0);
});

test('adding a chord makes the saved rhythm to redo, and the notice leads to the review', async ({
	page,
	request
}) => {
	await saveRhythm(request);
	await saveSong(request, seed.replace('[Do]Prima riga', '[Do]Prima [Fa]riga'));
	await goto(page, EDIT_URL);
	const notice = page.getByTestId('rhythm-stale-teaching');
	await expect(notice).toHaveText('Il ritmo salvato è da rifare: gli accordi sono cambiati.');
	await expect(notice.getByRole('link')).toHaveAttribute('href', PAGE_URL);
	await expect(page.getByTestId('rhythm-link')).toHaveAttribute('href', PAGE_URL);
	// the teaching notice already says the recording is stale too
	await expect(page.getByTestId('rhythm-stale-recording')).toHaveCount(0);
});

test('a song without a video link or saved rhythm still links to the review, without notices', async ({
	page
}) => {
	await goto(page, '/edit/clan/senza_ritmo.cho');
	await expect(page.getByTestId('meta-title')).toHaveValue('Senza ritmo');
	await expect(page.getByTestId('rhythm-link')).toHaveAttribute('href', '/ritmo/clan/senza_ritmo.cho');
	await expect(page.getByTestId('rhythm-stale-teaching')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-stale-recording')).toHaveCount(0);
});
