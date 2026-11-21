import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { isRhythmFile } from '../../shared/rhythm';
import { SEED_OWN as seed, silence } from './global-setup';

// A song analysed on the maintainer's own recording instead of a YouTube
// video: clan/ritmo_mio.cho has no recording link, its recording is
// e2e/.tmp-recordings/clan/ritmo_mio.wav and its analysis names that file's
// SHA-256 (both seeded by global-setup).

const SONG = path.resolve('e2e/.tmp-songs/clan/ritmo_mio.cho');
const RHYTHM = path.resolve('e2e/.tmp-songs/clan/ritmo_mio.rhythm.json');
const RECORDING = path.resolve('e2e/.tmp-recordings/clan/ritmo_mio.wav');
const ORIGINAL = silence(2, 22050);
const HASH = createHash('sha256').update(ORIGINAL).digest('hex');
const PAGE_URL = '/ritmo/clan/ritmo_mio.cho';
const EDIT_URL = '/edit/clan/ritmo_mio.cho';

test.beforeEach(async ({ page }) => {
	page.on('pageerror', (e) => {
		throw new Error(`page error: ${e.message}`);
	});
	fs.writeFileSync(SONG, seed, 'utf-8');
	fs.writeFileSync(RECORDING, ORIGINAL);
	fs.rmSync(RHYTHM, { force: true });
});

test.afterAll(() => {
	fs.writeFileSync(SONG, seed, 'utf-8');
	fs.writeFileSync(RECORDING, ORIGINAL);
	fs.rmSync(RHYTHM, { force: true });
});

async function goto(page: Page, url: string) {
	await page.goto(url);
	await page.locator('body[data-hydrated]').waitFor();
}

async function saveReview(page: Page) {
	await goto(page, PAGE_URL);
	await page.getByTestId('rhythm-save').click();
	await expect(page.getByTestId('rhythm-save-status')).toHaveText('Salvato.');
}

test('a song without a link is reviewed and saved on the own recording', async ({ page }) => {
	await goto(page, PAGE_URL);
	await expect(page.locator('.source')).toHaveText(
		/^Analisi del \d\d\/\d\d\/\d{4} sulla tua registrazione \(registrazioni\/clan\/ritmo_mio\.wav\)\.$/
	);
	await expect(page.getByTestId('rhythm-own-file')).toHaveText('registrazioni/clan/ritmo_mio.wav');
	await expect(page.getByTestId('rhythm-other-recording')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-command')).toHaveCount(0);

	await page.getByTestId('rhythm-save').click();
	await expect(page.getByTestId('rhythm-save-status')).toHaveText('Salvato.');
	const saved = JSON.parse(fs.readFileSync(RHYTHM, 'utf-8'));
	expect(isRhythmFile(saved)).toBe(true);
	expect(saved.recording.source).toEqual({ kind: 'file', id: HASH });
	// the audio itself never reaches the songs
	expect(fs.readFileSync(SONG, 'utf-8')).toBe(seed);

	await goto(page, EDIT_URL);
	await expect(page.getByTestId('rhythm-stale-teaching')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-stale-recording')).toHaveCount(0);
});

test('replacing the own recording asks to run the engine again', async ({ page }) => {
	await saveReview(page);
	fs.writeFileSync(RECORDING, silence(3, 22050));

	await goto(page, PAGE_URL);
	await expect(page.getByTestId('rhythm-other-recording')).toHaveText(
		"L'analisi è di un'altra registrazione: rilancia il motore."
	);
	await expect(page.getByTestId('rhythm-command')).toHaveText('make rhythm SONG=clan/ritmo_mio.cho');
	await expect(page.getByTestId('rhythm-own-file')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-no-recording')).toHaveCount(0);
	await expect(page.getByTestId('rhythm-save')).toBeDisabled();

	await goto(page, EDIT_URL);
	await expect(page.getByTestId('rhythm-stale-recording')).toBeVisible();
	await expect(page.getByTestId('rhythm-stale-teaching')).toHaveCount(0);
});

test('removing the own recording of a song without a link says where to put one', async ({
	page
}) => {
	await saveReview(page);
	fs.rmSync(RECORDING);

	await goto(page, PAGE_URL);
	await expect(page.getByTestId('rhythm-other-recording')).toBeVisible();
	await expect(page.getByTestId('rhythm-no-recording')).toContainText(
		'registrazioni/clan/ritmo_mio.m4a'
	);

	await goto(page, EDIT_URL);
	await expect(page.getByTestId('rhythm-stale-recording')).toBeVisible();
});
