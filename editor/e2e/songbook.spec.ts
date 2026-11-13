import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../../shared/chordpro';
import { linesFingerprint } from '../../shared/pauses';

const TMP = path.resolve('e2e/.tmp-songs');

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ page }) => {
	page.on('pageerror', (e) => {
		throw new Error(`page error: ${e.message}`);
	});
});

// the visual editor's row holding the n-th lyric line: its tools sit beside the line
function lyricRow(page: import('@playwright/test').Page, n: number) {
	return page.getByTestId('line-row').filter({ has: page.getByTestId('lyric-line') }).nth(n);
}

async function goto(page: import('@playwright/test').Page, url: string) {
	await page.goto(url);
	await page.locator('body[data-hydrated]').waitFor();
}

test('home lists categories as folders, folder opens its song list', async ({ page }) => {
	await goto(page, '/');
	const folders = page.getByTestId('folder');
	await expect(folders).toHaveCount(3);
	await expect(folders.filter({ hasText: 'Reparto' })).toContainText('0 canzoni');
	const varie = folders.filter({ hasText: 'Varie' });
	// rhythm-files.spec.ts, running in parallel, briefly moves one of them to clan
	await expect(varie).toContainText(/[34] canzoni/);

	await varie.click();
	await expect(page).toHaveURL(/\/c\/varie/);
	const row = page.getByTestId('song-row').filter({ hasText: 'Stella del mattino' });
	await expect(row).toHaveCount(1);
});

test('global search from the home page finds songs across all categories', async ({ page }) => {
	await goto(page, '/');
	const search = page.getByTestId('global-search');

	// typing shows the flat result list with the category, and the query lands in the URL
	await search.fill('stella');
	const row = page.getByTestId('song-row').filter({ hasText: 'Stella del mattino' });
	await expect(row).toHaveCount(1);
	await expect(row).toContainText('Varie');
	await expect(page).toHaveURL(/\?q=stella/);

	// no match: zero count, no rows
	await search.fill('inesistente');
	await expect(page.getByTestId('song-count')).toHaveText('0 canzoni');

	// clearing the field brings the folders back
	await search.fill('');
	await expect(page.getByTestId('folder')).toHaveCount(3);

	// opening the URL with ?q= restores the search
	await goto(page, '/?q=stella');
	await expect(page.getByTestId('song-row')).toHaveCount(1);

	// a result links to the song editor
	await page.getByTestId('song-row').getByRole('link', { name: 'Stella del mattino' }).click();
	await expect(page).toHaveURL(/\/edit\/varie\/stella_del_mattino\.cho/);
});

test('create a song with the visual editor and verify the generated chordpro file', async ({
	page
}) => {
	// from the category page: the new-song link opens the simplified page with
	// the category preselected, the full-editor link keeps it
	await goto(page, '/c/reparto');
	await page.getByTestId('new-song').click();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.getByTestId('simple-category')).toHaveValue('reparto');
	await page.getByTestId('full-editor').click();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.getByTestId('meta-category')).toHaveValue('reparto');

	// metadata (no tag field: the tag is derived from the category)
	await page.getByTestId('meta-title').fill('Canzone di Prova');
	await page.getByTestId('meta-artist').fill('Gli Scout');

	// paste lyrics in the ChordPro tab, below the generated directives
	await page.getByTestId('tab-raw').click();
	const rawEditor = page.getByTestId('raw-editor');
	const head = (await rawEditor.inputValue()).trimEnd();
	const lyrics = [
		'Alla mattina ci alziamo presto',
		'e cantiamo questa canzone',
		'',
		'Il ritornello arriva adesso',
		'con la sua melodia'
	].join('\n');
	await rawEditor.fill(head + '\n\n' + lyrics);

	// back to the visual editor: 4 lyric lines parsed
	await page.getByTestId('tab-visual').click();
	const lyricLines = page.getByTestId('lyric-line');
	await expect(lyricLines).toHaveCount(4);

	// place [Do] at the start of line 1
	await lyricLines.nth(0).getByTestId('lyric-text').locator('button[data-pos="0"]').click();
	await page.getByTestId('chord-input').fill('Do');
	await page.getByTestId('chord-input').press('Enter');
	await expect(lyricLines.nth(0).getByTestId('chord-pill')).toHaveText('Do');

	// place [Sol] before "questa" on line 2 (pos 11)
	await lyricLines.nth(1).getByTestId('lyric-text').locator('button[data-pos="11"]').click();
	await page.getByTestId('chord-input').fill('Sol');
	await page.getByTestId('chord-input').press('Enter');

	// place [Fa] inside "ritornello" on line 3 (pos 4)
	await lyricLines.nth(2).getByTestId('lyric-text').locator('button[data-pos="4"]').click();
	await page.getByTestId('chord-input').fill('Fa');
	await page.getByTestId('chord-input').press('Enter');

	// save: creates the file and navigates to the edit page
	await page.getByTestId('save').click();
	await page.waitForURL('**/edit/reparto/canzone_di_prova.cho');

	const file = path.join(TMP, 'reparto', 'canzone_di_prova.cho');
	expect(fs.existsSync(file)).toBe(true);
	const content = fs.readFileSync(file, 'utf-8');
	expect(content).toBe(
		`{title:Canzone di Prova}
{artist:Gli Scout}
{tag:Reparto}

[Do]Alla mattina ci alziamo presto
e cantiamo [Sol]questa canzone

Il r[Fa]itornello arriva adesso
con la sua melodia
`
	);

	// reload: the editor renders the saved chords
	await page.reload();
	await expect(page.getByTestId('chord-pill')).toHaveCount(3);
	await expect(page.getByTestId('meta-title')).toHaveValue('Canzone di Prova');
});

test('create a song from the simplified page and land in the full editor', async ({ page }) => {
	await goto(page, '/c/varie');
	await page.getByTestId('new-song').click();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.getByTestId('simple-category')).toHaveValue('varie');

	// title and text are required, everything else is optional
	await page.getByTestId('simple-save').click();
	await expect(page.getByTestId('simple-status')).toHaveText('Il titolo è obbligatorio');
	await page.getByTestId('simple-title').fill('Canto Semplice');
	await page.getByTestId('simple-save').click();
	await expect(page.getByTestId('simple-status')).toHaveText('Il testo è obbligatorio');

	await page.getByTestId('simple-artist').fill('Il Branco');
	await page
		.getByTestId('simple-text')
		.fill('Prima riga del canto\nseconda riga\n\nSeconda strofa qui');

	// save: creates the file and opens the full editor on it
	await page.getByTestId('simple-save').click();
	await page.waitForURL('**/edit/varie/canto_semplice.cho');
	await expect(page.getByTestId('lyric-line')).toHaveCount(3);

	const content = fs.readFileSync(path.join(TMP, 'varie', 'canto_semplice.cho'), 'utf-8');
	expect(content).toBe(
		`{title:Canto Semplice}
{artist:Il Branco}
{tag:Varie}

Prima riga del canto
seconda riga

Seconda strofa qui
`
	);
});

test('edit an existing chord and move one by dragging', async ({ page }) => {
	await goto(page, '/edit/varie/stella_del_mattino.cho');

	const firstLine = page.getByTestId('lyric-line').nth(0);
	const pill = firstLine.getByTestId('chord-pill');
	await expect(pill).toHaveText('Do');

	// click the pill, change the chord to Rem
	await pill.click();
	await page.getByTestId('chord-input').fill('Rem');
	await page.getByTestId('chord-input').press('Enter');
	await expect(pill).toHaveText('Rem');

	// drag the pill 7 characters to the right ("Stella " -> before "del")
	const charBox = await firstLine
		.getByTestId('lyric-text')
		.locator('button[data-pos="0"]')
		.boundingBox();
	const charW = charBox!.width; // each char button is exactly 1ch wide
	const pillBox = await pill.boundingBox();
	const startX = pillBox!.x + pillBox!.width / 2;
	const startY = pillBox!.y + pillBox!.height / 2;
	await page.mouse.move(startX, startY);
	await page.mouse.down();
	await page.mouse.move(startX + charW * 7, startY, { steps: 5 });
	await page.mouse.up();
	await expect(pill).toHaveAttribute('data-pos', '7');

	// save and verify the file on disk
	await page.getByTestId('save').click();
	await expect(page.getByTestId('save-status')).toHaveText('Salvato ✓');

	const content = fs.readFileSync(path.join(TMP, 'varie', 'stella_del_mattino.cho'), 'utf-8');
	expect(content).toContain('Stella [Rem]del mattino brilla');
});

test('lyric line edit: Enter commits, Esc discards', async ({ page }) => {
	await goto(page, '/edit/varie/stella_del_mattino.cho');
	const firstLine = page.getByTestId('lyric-line').nth(0);

	// Enter commits
	await lyricRow(page, 0).hover();
	await lyricRow(page, 0).getByTestId('edit-lyric-text').click();
	const input = page.getByTestId('lyric-text-input');
	await expect(input).toBeFocused();
	await input.fill('Stella del mattino splende');
	await input.press('Enter');
	await expect(firstLine.getByTestId('lyric-text')).toContainText('splende');

	// Esc discards
	await lyricRow(page, 0).hover();
	await lyricRow(page, 0).getByTestId('edit-lyric-text').click();
	await input.fill('testo da scartare');
	await input.press('Escape');
	await expect(firstLine.getByTestId('lyric-text')).toContainText('splende');
	await expect(firstLine.getByTestId('lyric-text')).not.toContainText('scartare');
});

test('lyric line edit keeps chords on their characters', async ({ page }) => {
	await goto(page, '/edit/varie/stella_del_mattino.cho');
	const secondLine = page.getByTestId('lyric-line').nth(1);
	const pill = secondLine.getByTestId('chord-pill');
	await expect(pill).toHaveAttribute('data-pos', '4'); // "nel [Sol]cielo"

	// text inserted before the chord moves it along
	await lyricRow(page, 1).hover();
	await lyricRow(page, 1).getByTestId('edit-lyric-text').click();
	const input = page.getByTestId('lyric-text-input');
	await input.fill('Sotto nel cielo di settembre');
	await input.press('Enter');
	await expect(pill).toHaveAttribute('data-pos', '10');

	// a leading character removed moves it back
	await lyricRow(page, 1).hover();
	await lyricRow(page, 1).getByTestId('edit-lyric-text').click();
	await input.fill('otto nel cielo di settembre');
	await input.press('Enter');
	await expect(pill).toHaveAttribute('data-pos', '9');
});

test('convert english chords to latin and transpose', async ({ page }) => {
	await goto(page, '/new?category=reparto');
	await page.getByTestId('meta-title').fill('Test Accordi');

	// paste english chords in the ChordPro tab
	await page.getByTestId('tab-raw').click();
	const rawEditor = page.getByTestId('raw-editor');
	const head = (await rawEditor.inputValue()).trimEnd();
	await rawEditor.fill(head + '\n\n[Am]Hello [C7]world [F#m]again [G/B]bye');

	// convert A,B,C -> La,Si,Do (in the raw tab)
	await page.getByTestId('convert-latin').click();
	await expect(rawEditor).toHaveValue(/\[Lam\]Hello \[Do7\]world \[Fa#m\]again \[Sol\/Si\]bye/);

	// transpose +1 in the visual tab: pills update
	await page.getByTestId('tab-visual').click();
	await page.getByTestId('transpose-up').click();
	const pills = page.getByTestId('chord-pill');
	await expect(pills.nth(0)).toHaveText('La#m');
	await expect(pills.nth(1)).toHaveText('Do#7');
	await expect(pills.nth(2)).toHaveText('Solm');
	await expect(pills.nth(3)).toHaveText('Sol#/Do');

	// -1 brings them back
	await page.getByTestId('transpose-down').click();
	await expect(pills.nth(0)).toHaveText('Lam');

	// save and check the file
	await page.getByTestId('save').click();
	await page.waitForURL('**/edit/reparto/test_accordi.cho');
	const content = fs.readFileSync(path.join(TMP, 'reparto', 'test_accordi.cho'), 'utf-8');
	expect(content).toContain('[Lam]Hello [Do7]world [Fa#m]again [Sol/Si]bye');
});

test('move a song to a different category', async ({ page }) => {
	// move varie -> clan from the category page row select
	await goto(page, '/c/varie');
	const row = page.getByTestId('song-row').filter({ hasText: 'Stella del mattino' });
	await row.getByTestId('move-select').selectOption('clan');
	await expect(row).toHaveCount(0);

	const moved = path.join(TMP, 'clan', 'stella_del_mattino.cho');
	expect(fs.existsSync(moved)).toBe(true);
	expect(fs.existsSync(path.join(TMP, 'varie', 'stella_del_mattino.cho'))).toBe(false);
	expect(fs.readFileSync(moved, 'utf-8')).toContain('{tag:Clan}');

	// move back clan -> varie from the edit page category select
	await goto(page, '/edit/clan/stella_del_mattino.cho');
	await page.getByTestId('meta-category').selectOption('varie');
	await page.getByTestId('save').click();
	await page.waitForURL('**/edit/varie/stella_del_mattino.cho');

	const back = path.join(TMP, 'varie', 'stella_del_mattino.cho');
	expect(fs.existsSync(back)).toBe(true);
	expect(fs.existsSync(moved)).toBe(false);
	expect(fs.readFileSync(back, 'utf-8')).toContain('{tag:Varie}');
});

test('event songbooks: list, view, create, edit, delete', async ({ page }) => {
	const TMP_BOOKS = path.resolve('e2e/.tmp-songbooks');

	// list shows the seeded songbook
	await goto(page, '/songbooks');
	const seeded = page.getByTestId('songbook-row').filter({ hasText: 'uscita_2026' });
	await expect(seeded).toHaveCount(1);
	await expect(seeded).toContainText('1');

	// view: the entry resolves to the song title
	await seeded.getByRole('link').click();
	await expect(page.getByTestId('songbook-entry')).toContainText('Stella del mattino');

	// create a new songbook
	await goto(page, '/songbooks');
	await page.getByTestId('new-songbook-name').fill('Campo Estivo');
	await page.getByTestId('new-songbook-create').click();
	await page.waitForURL('**/songbooks/campo_estivo');

	// add both available songs, reorder, save
	await page.getByTestId('picker-add').first().click();
	await page.getByTestId('picker-add').first().click();
	await expect(page.getByTestId('songbook-entry')).toHaveCount(2);
	await page.getByTestId('songbook-save').click();
	await expect(page.getByTestId('songbook-status')).toHaveText('Salvato ✓');

	const file = path.join(TMP_BOOKS, 'campo_estivo.txt');
	const lines = fs.readFileSync(file, 'utf-8').trim().split('\n');
	expect(lines).toHaveLength(2);
	for (const l of lines) expect(l).toMatch(/^(clan|reparto|varie)\/.+\.cho$/);

	// remove one entry and save again
	await page.getByTestId('entry-remove').first().click();
	await page.getByTestId('songbook-save').click();
	await expect(page.getByTestId('songbook-status')).toHaveText('Salvato ✓');
	expect(fs.readFileSync(file, 'utf-8').trim().split('\n')).toHaveLength(1);

	// delete the songbook from the list
	await goto(page, '/songbooks');
	page.on('dialog', (d) => d.accept());
	const row = page.getByTestId('songbook-row').filter({ hasText: 'campo_estivo' });
	await row.getByRole('button', { name: 'Elimina' }).click();
	await expect(row).toHaveCount(0);
	expect(fs.existsSync(file)).toBe(false);
});

test('undo/redo: text edits and structural changes', async ({ page }) => {
	await goto(page, '/new?category=reparto');
	const title = page.getByTestId('meta-title');
	const undo = page.getByTestId('undo');
	const redo = page.getByTestId('redo');

	// nothing to undo yet on a fresh editor
	await expect(undo).toBeDisabled();

	// two text edits, each its own history entry (debounce coalesces a burst into one)
	await title.fill('Primo Titolo');
	await page.waitForTimeout(500);
	await title.fill('Secondo Titolo');
	await page.waitForTimeout(500);

	await undo.click();
	await expect(title).toHaveValue('Primo Titolo');
	await undo.click();
	await expect(title).toHaveValue('');

	// redo walks forward again
	await redo.click();
	await expect(title).toHaveValue('Primo Titolo');
	await redo.click();
	await expect(title).toHaveValue('Secondo Titolo');

	// structural change: add a line and give it text (a blank lyric line cannot survive a
	// serialize round-trip, so type something so the snapshot is faithful)
	await page.getByTestId('add-line-end').click();
	await page.getByTestId('add-lyric').click();
	const lyricLines = page.getByTestId('lyric-line');
	await expect(lyricLines).toHaveCount(1);
	await lyricRow(page, 0).hover();
	await lyricRow(page, 0).getByTestId('edit-lyric-text').click();
	await lyricLines.first().getByTestId('lyric-text-input').fill('Riga di testo');
	await lyricLines.first().getByTestId('lyric-text-input').press('Enter');
	await expect(lyricLines.first().getByTestId('lyric-text')).toContainText('Riga di testo');
	await page.waitForTimeout(500);

	// undo removes the line, redo brings it back with its text
	await undo.click();
	await expect(lyricLines).toHaveCount(0);
	await redo.click();
	await expect(lyricLines).toHaveCount(1);
	await expect(lyricLines.first().getByTestId('lyric-text')).toContainText('Riga di testo');

	// a fresh edit after undo discards the redo branch
	await undo.click();
	await expect(lyricLines).toHaveCount(0);
	await title.fill('Ramo Nuovo');
	await page.waitForTimeout(500);
	await expect(redo).toBeDisabled();
});

test('add a tab block from the add menu, edit it, verify the chordpro output', async ({
	page
}) => {
	await goto(page, '/new?category=reparto');
	await page.getByTestId('meta-title').fill('Canzone con Tab');

	// insert a tab: the editor prefills a six-string staff
	await page.getByTestId('add-line-end').click();
	await page.getByTestId('add-tab').click();
	const tab = page.getByTestId('tab-editor');
	await expect(tab).toHaveCount(1);
	await expect(tab).toHaveValue(/e\|-+\|/);

	// replace the template with real content
	await tab.fill('e|--0--2--|\nB|--1--3--|');

	// the raw tab wraps it in start_of_tab/end_of_tab
	await page.getByTestId('tab-raw').click();
	const raw = await page.getByTestId('raw-editor').inputValue();
	expect(raw).toContain('{start_of_tab}\ne|--0--2--|\nB|--1--3--|\n{end_of_tab}');

	// and back in the visual editor the block survives the round-trip
	await page.getByTestId('tab-visual').click();
	await expect(page.getByTestId('tab-editor')).toHaveValue('e|--0--2--|\nB|--1--3--|');
});

test('delete a song from the category page', async ({ page }) => {
	await goto(page, '/c/varie');
	page.on('dialog', (d) => d.accept());
	const row = page.getByTestId('song-row').filter({ hasText: 'Stella del mattino' });
	await row.getByRole('button', { name: 'Elimina' }).click();
	await expect(row).toHaveCount(0);
	expect(fs.existsSync(path.join(TMP, 'varie', 'stella_del_mattino.cho'))).toBe(false);
});

test('category manager: create, rename, delete with song move', async ({ page }) => {
	// create a new category from the manager
	await goto(page, '/categories');
	await page.getByTestId('new-category-name').fill('Estate 2026');
	await page.getByTestId('new-category-create').click();
	const row = page.getByTestId('category-row').filter({ hasText: 'estate_2026' });
	await expect(row).toHaveCount(1);
	expect(fs.existsSync(path.join(TMP, 'estate_2026'))).toBe(true);

	// rename it (folder is renamed on disk)
	await row.getByRole('button', { name: 'Rinomina' }).click();
	await page.getByTestId('edit-category-name').fill('estate_2027');
	await page.getByRole('button', { name: 'Salva' }).click();
	const renamed = page.getByTestId('category-row').filter({ hasText: 'estate_2027' });
	await expect(renamed).toHaveCount(1);
	expect(fs.existsSync(path.join(TMP, 'estate_2026'))).toBe(false);
	expect(fs.existsSync(path.join(TMP, 'estate_2027'))).toBe(true);

	// reorder: move the new (last) category to the top, persisted to disk
	const rows = page.getByTestId('category-row');
	const last = (await rows.count()) - 1;
	await rows.nth(last).getByRole('button', { name: 'Sposta su' }).click();
	await expect(rows.nth(last)).not.toContainText('estate_2027');
	const orderFile = path.join(TMP, '.categories.json');
	expect(fs.existsSync(orderFile)).toBe(true);
	const order = JSON.parse(fs.readFileSync(orderFile, 'utf-8'));
	expect(order.indexOf('estate_2027')).toBeLessThan(order.length - 1);

	// put a song in it, then delete the category moving the song to clan
	fs.writeFileSync(
		path.join(TMP, 'estate_2027', 'sole.cho'),
		'{title:Sole}\n{tag:Estate 2027}\n\n[Do]Sole\n',
		'utf-8'
	);
	await goto(page, '/categories');
	const target = page.getByTestId('category-row').filter({ hasText: 'estate_2027' });
	page.on('dialog', (d) => {
		if (d.type() === 'prompt') d.accept('clan');
		else d.accept();
	});
	await target.getByRole('button', { name: 'Elimina' }).click();
	await expect(page.getByTestId('category-row').filter({ hasText: 'estate_2027' })).toHaveCount(0);
	expect(fs.existsSync(path.join(TMP, 'estate_2027'))).toBe(false);
	// the song moved to clan with its tag rewritten
	const moved = path.join(TMP, 'clan', 'sole.cho');
	expect(fs.existsSync(moved)).toBe(true);
	expect(fs.readFileSync(moved, 'utf-8')).toContain('{tag:Clan}');
});

test('the visual editor shows chord diagrams for the chords in use', async ({ page }) => {
	fs.writeFileSync(
		path.join(TMP, 'varie', 'prova_diagrammi.cho'),
		'{title:Prova diagrammi}\n{tag:Varie}\n\n[Do]Stella del mattino brilla\nnel [Sol]cielo di settembre\n',
		'utf-8'
	);
	await goto(page, '/edit/varie/prova_diagrammi.cho');

	// the seed song uses Do and Sol: one diagram each, in order of appearance
	const panel = page.getByTestId('chord-diagrams');
	const diagrams = panel.getByTestId('chord-diagram');
	await expect(diagrams).toHaveCount(2);
	await expect(diagrams.nth(0)).toHaveAttribute('data-chord', 'Do');
	await expect(diagrams.nth(1)).toHaveAttribute('data-chord', 'Sol');

	// adding a chord updates the panel immediately
	const firstLine = page.getByTestId('lyric-line').nth(0);
	await firstLine.getByTestId('lyric-text').locator('button[data-pos="7"]').click();
	await page.getByTestId('chord-input').fill('Mim');
	await page.getByTestId('chord-input').press('Enter');
	await expect(diagrams).toHaveCount(3);
	await expect(panel.locator('[data-chord="Mim"]')).toBeVisible();

	// a duplicate chord does not add a second diagram
	await firstLine.getByTestId('lyric-text').locator('button[data-pos="12"]').click();
	await page.getByTestId('chord-input').fill('Do');
	await page.getByTestId('chord-input').press('Enter');
	await expect(diagrams).toHaveCount(3);

	// a chord ChordPro has no diagram for gets the "nessun diagramma" placeholder
	await firstLine.getByTestId('lyric-text').locator('button[data-pos="14"]').click();
	await page.getByTestId('chord-input').fill('Doadd');
	await page.getByTestId('chord-input').press('Enter');
	const unknown = panel.getByTestId('chord-diagram-unknown');
	await expect(unknown).toHaveCount(1);
	await expect(unknown).toContainText('nessun diagramma');
});

test('the chord popover offers the chords already used as one-click suggestions', async ({ page }) => {
	fs.writeFileSync(
		path.join(TMP, 'varie', 'prova_suggerimenti.cho'),
		'{title:Prova suggerimenti}\n{tag:Varie}\n\n[Do]Stella del mattino brilla\nnel [Sol]cielo di settembre\n',
		'utf-8'
	);
	await goto(page, '/edit/varie/prova_suggerimenti.cho');

	// open the popover on the second line: both song chords are offered
	const secondLine = page.getByTestId('lyric-line').nth(1);
	await secondLine.getByTestId('lyric-text').locator('button[data-pos="10"]').click();
	const suggestions = page.getByTestId('chord-suggestion');
	await expect(suggestions).toHaveCount(2);
	await expect(suggestions.nth(0)).toHaveText('Do');
	await expect(suggestions.nth(1)).toHaveText('Sol');

	// one click inserts the chord and closes the popover
	await suggestions.nth(0).click();
	await expect(page.getByTestId('chord-popover')).toHaveCount(0);
	await expect(secondLine.getByTestId('chord-pill')).toHaveCount(2);
	await expect(secondLine.getByTestId('chord-pill').nth(1)).toHaveText('Do');
});

test('the simplify toggle shows basic triads without touching the song', async ({ page }) => {
	fs.writeFileSync(
		path.join(TMP, 'varie', 'prova_semplifica.cho'),
		'{title:Prova semplifica}\n{tag:Varie}\n\n[Lam7]Stella del [Re7sus4]mattino [Sol/Si]brilla\nnel [Fa#m7b5]cielo di [Lam]settembre\n',
		'utf-8'
	);
	await goto(page, '/edit/varie/prova_semplifica.cho');

	const pills = page.getByTestId('chord-pill');
	await expect(pills.nth(0)).toHaveText('Lam7');

	// toggle on: pills and diagrams show the simplified chords, deduplicated
	await page.getByTestId('simplify-toggle').click();
	await expect(pills.nth(0)).toHaveText('Lam');
	await expect(pills.nth(1)).toHaveText('Re');
	await expect(pills.nth(2)).toHaveText('Sol');
	await expect(pills.nth(3)).toHaveText('Fa#m');
	const diagrams = page.getByTestId('chord-diagram');
	await expect(diagrams).toHaveCount(4); // Lam7 and Lam collapse into Lam
	await expect(diagrams.nth(0)).toHaveAttribute('data-chord', 'Lam');

	// the song is untouched: no dirty flag, raw tab still has the originals
	await expect(page.getByTestId('dirty-indicator')).toHaveCount(0);

	// toggle off: originals come back
	await page.getByTestId('simplify-toggle').click();
	await expect(pills.nth(0)).toHaveText('Lam7');
	await expect(diagrams).toHaveCount(5);
});

test('song tags: add with normalization, save as x_tag, autocomplete on existing tags', async ({
	page
}) => {
	await goto(page, '/edit/varie/prova_semplifica.cho');

	// typed tags are normalized: lowercase, spaces become hyphens
	const entry = page.getByTestId('tag-entry');
	await entry.fill('Omelia');
	await entry.press('Enter');
	await entry.fill('spirito santo');
	await entry.press('Enter');
	const chips = page.getByTestId('tag-chip');
	await expect(chips).toHaveCount(2);
	await expect(chips.nth(0)).toContainText('#omelia');
	await expect(chips.nth(1)).toContainText('#spirito-santo');

	// saved as one {x_tag:...} per tag, after the category {tag:...}
	await page.getByTestId('save').click();
	await expect(page.getByTestId('save-status')).toHaveText('Salvato ✓');
	const file = path.join(TMP, 'varie', 'prova_semplifica.cho');
	expect(fs.readFileSync(file, 'utf-8')).toContain(
		'{tag:Varie}\n{x_tag:omelia}\n{x_tag:spirito-santo}\n'
	);

	// reload: chips come back from the file
	await page.reload();
	await page.locator('body[data-hydrated]').waitFor();
	await expect(page.getByTestId('tag-chip')).toHaveCount(2);

	// the new-song form suggests the tags already used across the repertoire
	await goto(page, '/new');
	await page.getByTestId('tag-entry').fill('om');
	const suggestions = page.getByTestId('tag-suggestion');
	await expect(suggestions).toHaveCount(1);
	await expect(suggestions.first()).toHaveText('#omelia');
	await suggestions.first().click();
	await expect(page.getByTestId('tag-chip')).toHaveCount(1);
	await expect(page.getByTestId('tag-chip')).toContainText('#omelia');

	// removing the chip empties the field
	await page.getByTestId('tag-remove').click();
	await expect(page.getByTestId('tag-chip')).toHaveCount(0);
});

// --- line-by-line chord mode (small screens) ---

const FOCUS_SEED = `{title:Prova riga per riga}
{tag:Varie}

[Do]Alza gli occhi verso il cielo
e respira il vento nuovo
canta forte la tua gioia
`;

function seedFocusSong() {
	fs.writeFileSync(path.join(TMP, 'varie', 'prova_riga_per_riga.cho'), FOCUS_SEED, 'utf-8');
}

test('small screens: the visual tab opens in line-by-line mode, tap places chords', async ({
	page
}) => {
	seedFocusSong();
	await page.setViewportSize({ width: 852, height: 393 }); // iPhone 15 landscape
	await goto(page, '/edit/varie/prova_riga_per_riga.cho');

	// the line-by-line mode replaces the whole-sheet editor
	await expect(page.getByTestId('line-mode')).toBeVisible();
	await expect(page.getByTestId('visual-editor')).toHaveCount(0);
	await expect(page.getByTestId('line-counter')).toHaveText('1 / 3');

	// the palette lists the chords already in the song
	const chips = page.getByTestId('palette-chip');
	await expect(chips).toHaveCount(1);
	await expect(chips.first()).toHaveText('Do');

	// add a new chord to the palette; it comes back armed (selected)
	await page.getByTestId('palette-add-input').fill('Sol');
	await page.getByTestId('palette-add').click();
	await expect(chips).toHaveCount(2);

	// tap a character: the armed chord lands there ("Alza " -> before "gli")
	await page.getByTestId('focus-text').locator('button[data-pos="5"]').click();
	await expect(page.getByTestId('focus-pill').nth(1)).toHaveText('Sol');
	await expect(page.getByTestId('focus-pill').nth(1)).toHaveAttribute('data-pos', '5');

	// next line: the counter advances and the palette chord can be re-placed by tap
	await page.getByTestId('next-line').click();
	await expect(page.getByTestId('line-counter')).toHaveText('2 / 3');
	await expect(page.getByTestId('focus-pill')).toHaveCount(0);
	await chips.first().click(); // arm Do
	await page.getByTestId('focus-text').locator('button[data-pos="0"]').click();
	await expect(page.getByTestId('focus-pill')).toHaveText('Do');

	// save and verify the generated chordpro
	await page.getByTestId('save').click();
	await expect(page.getByTestId('save-status')).toHaveText('Salvato ✓');
	const content = fs.readFileSync(path.join(TMP, 'varie', 'prova_riga_per_riga.cho'), 'utf-8');
	expect(content).toContain('[Do]Alza [Sol]gli occhi verso il cielo');
	expect(content).toContain('[Do]e respira il vento nuovo');
});

test('small screens: drag a chord from the palette onto the line', async ({ page }) => {
	seedFocusSong();
	await page.setViewportSize({ width: 852, height: 393 });
	await goto(page, '/edit/varie/prova_riga_per_riga.cho');
	await expect(page.getByTestId('line-mode')).toBeVisible();

	// drag the Do chip onto "verso" (pos 15)
	const chip = page.getByTestId('palette-chip').first();
	const chipBox = await chip.boundingBox();
	const target = await page.getByTestId('focus-text').locator('button[data-pos="15"]').boundingBox();
	await page.mouse.move(chipBox!.x + chipBox!.width / 2, chipBox!.y + chipBox!.height / 2);
	await page.mouse.down();
	await page.mouse.move(target!.x + 2, target!.y + target!.height / 2, { steps: 10 });
	await page.mouse.up();

	const pills = page.getByTestId('focus-pill');
	await expect(pills).toHaveCount(2);
	await expect(pills.nth(1)).toHaveAttribute('data-pos', '15');

	// tap the new pill: the action bar appears (no text input, the phone keyboard stays closed)
	await pills.nth(1).click();
	await expect(page.getByTestId('pill-actions')).toBeVisible();
	expect(await page.locator('input:focus').count()).toBe(0);

	// with the pill selected, a tap on a character moves it there
	await page.getByTestId('focus-text').locator('button[data-pos="20"]').click();
	await expect(pills.nth(1)).toHaveAttribute('data-pos', '20');
	await expect(page.getByTestId('pill-actions')).toHaveCount(0);

	// with the pill selected, a tap on a palette chip replaces the chord
	await page.getByTestId('palette-add-input').fill('Mim');
	await page.getByTestId('palette-add').click();
	await pills.nth(1).click();
	await page.getByTestId('palette-chip').nth(1).click();
	await expect(pills.nth(1)).toHaveText('Mim');

	// the remove button deletes the selected pill
	await pills.nth(1).click();
	await page.getByTestId('focus-chord-remove').click();
	await expect(pills).toHaveCount(1);
});

test('small screens: the toggle switches back to the whole-sheet editor', async ({ page }) => {
	seedFocusSong();
	await page.setViewportSize({ width: 852, height: 393 });
	await goto(page, '/edit/varie/prova_riga_per_riga.cho');
	await expect(page.getByTestId('line-mode')).toBeVisible();

	await page.getByTestId('line-mode-toggle').click();
	await expect(page.getByTestId('visual-editor')).toBeVisible();
	await expect(page.getByTestId('line-mode')).toHaveCount(0);

	await page.getByTestId('line-mode-toggle').click();
	await expect(page.getByTestId('line-mode')).toBeVisible();
});

test('pauses: add from the menu, edit the seconds, written as x_pause', async ({ page }) => {
	await goto(page, '/new?category=reparto');
	await page.getByTestId('meta-title').fill('Canzone con pausa');
	await page.getByTestId('add-line-end').click();
	await page.getByTestId('add-pause').click();
	await expect(page.getByTestId('pause-seconds')).toHaveValue('4');
	await page.getByTestId('pause-seconds').fill('7');

	await page.getByTestId('tab-raw').click();
	expect(await page.getByTestId('raw-editor').inputValue()).toContain('{x_pause:7}');
	await page.getByTestId('tab-visual').click();
	await expect(page.getByTestId('pause-seconds')).toHaveValue('7');
});

test('line tools: pause after a line, seconds stepper, chorus rail, delete', async ({ page }) => {
	const file = path.join(TMP, 'varie', 'strumenti_riga.cho');
	fs.writeFileSync(
		file,
		'{title:Strumenti riga}\n{tag:Varie}\n\nuno\n{start_of_chorus}\ndue\n{end_of_chorus}\n{comment:Rit.}\n',
		'utf-8'
	);
	await goto(page, '/edit/varie/strumenti_riga.cho');

	// the pause goes right after the line, and that line offers no second one
	const row = lyricRow(page, 0);
	await row.hover();
	await row.getByTestId('add-pause-after').click();
	await expect(page.getByTestId('pause-seconds')).toHaveValue('4');
	await row.hover();
	await expect(row.getByTestId('add-pause-after')).toHaveCount(0);

	await page.getByTestId('pause-more').click();
	await page.getByTestId('pause-more').click();
	await page.getByTestId('pause-less').click();
	await expect(page.getByTestId('pause-seconds')).toHaveValue('5');

	// start, line and end of the chorus sit on the rail
	await expect(page.locator('.line-wrap.in-chorus')).toHaveCount(3);

	await page.getByTestId('tab-raw').click();
	expect(await page.getByTestId('raw-editor').inputValue()).toContain('uno\n{x_pause:5}\n');
	await page.getByTestId('tab-visual').click();

	const pauseRow = page.getByTestId('line-row').filter({ has: page.getByTestId('pause-line') });
	await pauseRow.hover();
	await pauseRow.getByTestId('delete-line').click();
	await expect(page.getByTestId('pause-line')).toHaveCount(0);

	// a line can go before the first one
	await page.getByTestId('visual-editor').hover();
	await page.getByTestId('add-line-top').click();
	await page.getByTestId('add-chorus-start').click();
	await page.getByTestId('tab-raw').click();
	expect(await page.getByTestId('raw-editor').inputValue()).toMatch(
		/\n\n\{start_of_chorus\}\nuno\n\{start_of_chorus\}/
	);
	fs.rmSync(file);
});

test('pauses: a proposal link is applied, a stale or malformed one is not', async ({ page }) => {
	// a song of its own: earlier tests move and delete the seed
	const file = path.join(TMP, 'varie', 'pausa_proposta.cho');
	const before = '{title:Pausa proposta}\n{tag:Varie}\n\n[Do]Stella del mattino brilla\nnel [Sol]cielo di settembre\n';
	fs.writeFileSync(file, before, 'utf-8');
	const fp = linesFingerprint(parse(before));

	await goto(page, `/edit/varie/pausa_proposta.cho?pauses=1:6&fp=${fp}`);
	await expect(page.getByTestId('pause-import')).toBeVisible();
	await expect(page.getByTestId('pause-line')).toHaveCount(1);
	await expect(page.getByTestId('pause-seconds')).toHaveValue('6');
	await page.getByTestId('tab-raw').click();
	expect(await page.getByTestId('raw-editor').inputValue()).toMatch(/settembre\n\{x_pause:6\}/);
	expect(fs.readFileSync(file, 'utf-8')).toBe(before); // nothing written until save

	// the link is consumed: a reload must not apply it again over later edits
	expect(page.url()).not.toContain('pauses=');

	await goto(page, '/edit/varie/pausa_proposta.cho?pauses=1:6&fp=deadbeef');
	await expect(page.getByTestId('pause-import-error')).toBeVisible();
	await expect(page.getByTestId('pause-line')).toHaveCount(0);

	await goto(page, `/edit/varie/pausa_proposta.cho?pauses=abc&fp=${fp}`);
	await expect(page.getByTestId('pause-line')).toHaveCount(0);

	// the proposal is an unsaved change: saving writes it
	await goto(page, `/edit/varie/pausa_proposta.cho?pauses=1:6&fp=${fp}`);
	await page.getByTestId('save').click();
	await expect(page.getByTestId('save-status')).toHaveText('Salvato ✓');
	expect(fs.readFileSync(file, 'utf-8')).toMatch(/settembre\n\{x_pause:6\}/);
	fs.rmSync(file);
});

test('chordpro tab: typing { lists the directives, the choice is written ready to fill', async ({
	page
}) => {
	await goto(page, '/new?category=reparto');
	await page.getByTestId('meta-title').fill('Direttive');
	await page.getByTestId('tab-raw').click();
	const raw = page.getByTestId('raw-editor');
	await raw.fill((await raw.inputValue()).trimEnd() + '\n\nuno\n');
	const toEnd = () =>
		raw.evaluate((el: HTMLTextAreaElement) => {
			el.focus();
			el.setSelectionRange(el.value.length, el.value.length);
		});
	const menu = page.getByTestId('directive-menu');
	const options = page.getByTestId('directive-option');

	// `{` lists every directive, `{x` only the project's own
	await toEnd();
	await page.keyboard.type('{');
	await expect(menu).toBeVisible();
	await expect(options.first()).toHaveAttribute('data-name', 'x_pause');
	await page.keyboard.type('x');
	await expect(options).toHaveCount(4);
	await expect(options.nth(0)).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('ArrowDown');
	await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
	await page.keyboard.press('ArrowUp');

	// Enter writes the pause with its default seconds selected: typing replaces them
	await page.keyboard.press('Enter');
	await expect(menu).toHaveCount(0);
	await page.keyboard.type('7');
	expect(await raw.inputValue()).toMatch(/uno\n\{x_pause:7\}$/);

	// the name matches without the x_ prefix too; Escape closes the list
	await toEnd();
	await page.keyboard.type('\n{pau');
	await expect(options).toHaveCount(1);
	await page.keyboard.press('Escape');
	await expect(menu).toHaveCount(0);
	await page.keyboard.press('Backspace');
	await page.keyboard.press('Backspace');
	await page.keyboard.press('Backspace');

	// a click picks an option; a text directive gets the caret before `}`
	await page.keyboard.type('ta');
	await options.filter({ hasText: 'x_tag' }).click();
	await page.keyboard.type('omelia');
	expect(await raw.inputValue()).toMatch(/\{x_pause:7\}\n\{x_tag:omelia\}$/);
	await expect(page.getByTestId('raw-problems')).toHaveCount(0);

	await page.getByTestId('tab-visual').click();
	await expect(page.getByTestId('pause-seconds')).toHaveValue('7');
});

test('chordpro tab: wrong directives are marked and listed, a click goes to the line', async ({
	page
}) => {
	await goto(page, '/new?category=reparto');
	await page.getByTestId('tab-raw').click();
	const raw = page.getByTestId('raw-editor');
	const lines = [
		'{title:Direttive}',
		'{tag:Reparto}',
		'{x_pause:3}',
		'',
		'uno',
		'{x_pause:99}',
		'{x_pausa:3}',
		'{x_tag}',
		' {comment:a}',
		'{comment: Rit.}due',
		'{x_scroll:5',
		'{end_of_chorus:x}',
		'{x_pause:5}',
		'{start_of_chorus}',
		'tre',
		'{end_of_chorus}',
		'{x_youtube:abc}',
		'{x_youtube:jv_i536nIvc}'
	];
	await raw.fill(lines.join('\n'));

	await expect(page.getByTestId('raw-problem')).toHaveText([
		/^Riga 3\s+Pausa prima della prima riga di testo/,
		/^Riga 6\s+«x_pause» vuole un numero intero da 1 a 60/,
		/^Riga 7\s+Direttiva sconosciuta «x_pausa»: forse «x_pause»\?/,
		/^Riga 8\s+«x_tag» vuole un valore/,
		/^Riga 9\s+Togli gli spazi prima della «\{»/,
		/^Riga 10\s+Dopo la «\}» non va scritto altro/,
		/^Riga 11\s+Manca la «\}» di chiusura/,
		/^Riga 12\s+«end_of_chorus» non vuole un valore/,
		/^Riga 17\s+«x_youtube» vuole l'id di un video YouTube/
	]);
	const highlight = page.getByTestId('raw-highlight');
	await expect(highlight.locator('.hl-error')).toHaveCount(8);
	await expect(highlight.locator('.hl-warning')).toHaveCount(1);
	await expect(highlight.locator('.hl-custom')).toHaveCount(6);
	await expect(highlight.locator('.hl-error')).toHaveText([
		'99',
		'x_pausa',
		'x_tag',
		' {comment:a}',
		'{comment: Rit.}due',
		'{x_scroll:5',
		'x',
		'abc'
	]);

	// a click on the line number puts the caret at the start of that line
	await page.getByTestId('raw-problem').nth(2).getByRole('button').click();
	const lineStart = lines.slice(0, 6).join('\n').length + 1;
	expect(await raw.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(lineStart);

	await raw.fill(['{title:Direttive}', '', 'uno', '{x_pause:5}', '{x_tag:omelia}'].join('\n'));
	await expect(page.getByTestId('raw-problems')).toHaveCount(0);
});
