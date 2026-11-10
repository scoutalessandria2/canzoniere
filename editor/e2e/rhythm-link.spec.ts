import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// The song form's YouTube field. It edits its own seeded song so it can run in
// parallel with the specs that rely on the other seed.
const FILE = path.resolve('e2e/.tmp-songs/varie/link_di_prova.cho');

async function goto(page: import('@playwright/test').Page, url: string) {
	await page.goto(url);
	await page.locator('body[data-hydrated]').waitFor();
}

test('the YouTube field stores the video id, shows the watch link and rejects other links', async ({
	page
}) => {
	await goto(page, '/edit/varie/link_di_prova.cho');
	const field = page.getByTestId('meta-youtube');
	const error = page.getByTestId('meta-youtube-error');
	await expect(field).toHaveValue('');
	await expect(error).toHaveCount(0);

	// a short link with extra parameters is stored as the bare id
	await field.fill('https://youtu.be/jv_i536nIvc?si=abc');
	await field.blur();
	await expect(field).toHaveValue('https://www.youtube.com/watch?v=jv_i536nIvc');
	await expect(error).toHaveCount(0);
	await page.getByTestId('save').click();
	await expect(page.getByTestId('save-status')).toHaveText('Salvato ✓');
	expect(fs.readFileSync(FILE, 'utf-8')).toContain('{x_youtube:jv_i536nIvc}');

	// reload: the field shows the canonical link
	await page.reload();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(field).toHaveValue('https://www.youtube.com/watch?v=jv_i536nIvc');

	// a link that is not YouTube keeps the typed text, shows the error and
	// leaves the song as it was saved
	await field.fill('https://vimeo.com/1');
	await field.blur();
	await expect(error).toHaveText('Link YouTube non valido');
	await expect(field).toHaveValue('https://vimeo.com/1');
	await expect(page.getByTestId('dirty-indicator')).toHaveCount(0);
	await page.getByTestId('tab-raw').click();
	await expect(page.getByTestId('raw-editor')).toHaveValue(/\{x_youtube:jv_i536nIvc\}/);
	await page.getByTestId('tab-visual').click();

	// emptying the field removes the directive
	await field.fill('');
	await field.blur();
	await expect(error).toHaveCount(0);
	await page.getByTestId('save').click();
	await expect(page.getByTestId('save-status')).toHaveText('Salvato ✓');
	expect(fs.readFileSync(FILE, 'utf-8')).not.toContain('x_youtube');
});
