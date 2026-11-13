import fs from 'node:fs/promises';
import path from 'node:path';
import { parse, serialize } from '@canzoniere/shared/chordpro';
import { categoryLabel, sortCategories, isValidCategoryName } from '@canzoniere/shared/categories';

// Songs live in the repo's canzoni/ directory; override with SONGS_DIR (used by tests).
const SONGS_DIR = path.resolve(process.env.SONGS_DIR ?? path.join(process.cwd(), '..', 'canzoni'));

export interface SongListItem {
	category: string;
	file: string;
	title: string;
	artist: string;
}

export interface CategorySummary {
	category: string;
	count: number;
}

// Resolve a path inside the songs directory, refusing anything that escapes it.
export function songsPath(...parts: string[]): string {
	const full = path.resolve(SONGS_DIR, ...parts);
	if (full !== SONGS_DIR && !full.startsWith(SONGS_DIR + path.sep)) {
		throw new Error('invalid path');
	}
	return full;
}

// Persisted custom category order. Categories are directories (no inherent
// order), so the manual ordering set in the manager lives in this manifest.
const ORDER_FILE = path.join(SONGS_DIR, '.categories.json');

async function readOrder(): Promise<string[]> {
	try {
		const parsed = JSON.parse(await fs.readFile(ORDER_FILE, 'utf-8'));
		return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : [];
	} catch {
		return [];
	}
}

async function writeOrder(order: string[]): Promise<void> {
	await fs.writeFile(ORDER_FILE, JSON.stringify(order, null, '\t') + '\n', 'utf-8');
}

async function listCategoryDirs(): Promise<string[]> {
	const entries = await fs.readdir(SONGS_DIR, { withFileTypes: true });
	return entries.filter((e) => e.isDirectory() && !e.name.startsWith('.')).map((e) => e.name);
}

export async function listCategories(): Promise<string[]> {
	const dirs = await listCategoryDirs();
	const order = await readOrder();
	// saved order first (existing dirs only), then any new/unlisted dirs by default sort
	const known = order.filter((c) => dirs.includes(c));
	const rest = sortCategories(dirs.filter((c) => !known.includes(c)));
	return [...known, ...rest];
}

// Persist a manual category order; unknown names are dropped and any missing
// existing dirs are appended (default sort) so the manifest stays complete.
export async function setCategoryOrder(order: string[]): Promise<void> {
	const dirs = await listCategoryDirs();
	const clean = order.filter((c) => dirs.includes(c));
	const missing = sortCategories(dirs.filter((c) => !clean.includes(c)));
	await writeOrder([...clean, ...missing]);
}

export async function categoryExists(category: string): Promise<boolean> {
	try {
		const stat = await fs.stat(songsPath(category));
		return stat.isDirectory();
	} catch {
		return false;
	}
}

export async function createCategory(name: string): Promise<void> {
	if (!isValidCategoryName(name)) {
		throw new Error('nome categoria non valido (usa lettere minuscole, numeri e _)');
	}
	if (await categoryExists(name)) throw new Error(`la categoria "${name}" esiste già`);
	await fs.mkdir(songsPath(name));
}

export async function renameCategory(oldName: string, newName: string): Promise<void> {
	if (!isValidCategoryName(newName)) {
		throw new Error('nome categoria non valido (usa lettere minuscole, numeri e _)');
	}
	if (!(await categoryExists(oldName))) throw new Error(`la categoria "${oldName}" non esiste`);
	if (newName === oldName) return;
	if (await categoryExists(newName)) throw new Error(`la categoria "${newName}" esiste già`);
	await fs.rename(songsPath(oldName), songsPath(newName));
	// the {tag:...} directive mirrors the category label: rewrite it in every song
	await retagCategory(newName);
	// keep the rename's position in the manual order, if one is set
	const order = await readOrder();
	if (order.includes(oldName)) {
		await writeOrder(order.map((c) => (c === oldName ? newName : c)));
	}
}

export async function deleteCategory(name: string, targetCategory: string): Promise<void> {
	if (!(await categoryExists(name))) throw new Error(`la categoria "${name}" non esiste`);
	if (!(await categoryExists(targetCategory))) {
		throw new Error(`la categoria di destinazione "${targetCategory}" non esiste`);
	}
	if (targetCategory === name) throw new Error('scegli una categoria di destinazione diversa');
	const files = (await fs.readdir(songsPath(name))).filter((f) => f.endsWith('.cho'));
	// guard against name collisions before moving anything
	for (const file of files) {
		if (await songExists(targetCategory, file)) {
			throw new Error(`${targetCategory}/${file} esiste già: rinomina o sposta prima quella canzone`);
		}
	}
	for (const file of files) {
		await moveSong(name, file, targetCategory);
	}
	await fs.rmdir(songsPath(name));
	// drop the deleted category from the manual order, if one is set
	const order = await readOrder();
	if (order.includes(name)) {
		await writeOrder(order.filter((c) => c !== name));
	}
}

// Rewrite the {tag:...} of every song in a category to match its current label.
async function retagCategory(category: string): Promise<void> {
	const dir = songsPath(category);
	const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.cho'));
	const label = categoryLabel(category);
	for (const file of files) {
		const song = parse(await fs.readFile(path.join(dir, file), 'utf-8'));
		song.meta.tags = [label];
		await fs.writeFile(path.join(dir, file), serialize(song), 'utf-8');
	}
}

export async function listCategorySummaries(): Promise<CategorySummary[]> {
	const summaries: CategorySummary[] = [];
	for (const category of await listCategories()) {
		const files = (await fs.readdir(songsPath(category))).filter((f) => f.endsWith('.cho'));
		summaries.push({ category, count: files.length });
	}
	return summaries;
}

export async function listSongsByCategory(category: string): Promise<SongListItem[]> {
	const dir = songsPath(category);
	const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.cho'));
	const songs: SongListItem[] = [];
	for (const file of files) {
		const content = await fs.readFile(path.join(dir, file), 'utf-8');
		const { meta } = parse(content);
		songs.push({
			category,
			file,
			title: meta.title || file,
			artist: meta.artist
		});
	}
	songs.sort((a, b) => a.title.localeCompare(b.title, 'it'));
	return songs;
}

export async function listAllSongs(): Promise<SongListItem[]> {
	const songs: SongListItem[] = [];
	for (const category of await listCategories()) {
		songs.push(...(await listSongsByCategory(category)));
	}
	songs.sort((a, b) => a.title.localeCompare(b.title, 'it'));
	return songs;
}

// Every {x_tag:...} in use across the whole repertoire, for the autocomplete.
export async function listAllTags(): Promise<string[]> {
	const tags = new Set<string>();
	for (const category of await listCategories()) {
		const dir = songsPath(category);
		const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.cho'));
		for (const file of files) {
			const { meta } = parse(await fs.readFile(path.join(dir, file), 'utf-8'));
			for (const tag of meta.labels) tags.add(tag);
		}
	}
	return [...tags].sort((a, b) => a.localeCompare(b, 'it'));
}

export async function readSong(category: string, file: string): Promise<string> {
	return fs.readFile(songsPath(category, file), 'utf-8');
}

export async function writeSong(category: string, file: string, content: string): Promise<void> {
	if (!file.endsWith('.cho')) throw new Error('file must end with .cho');
	await fs.writeFile(songsPath(category, file), content, 'utf-8');
}

// The rhythm file saved next to a song: la_gioia.cho -> la_gioia.rhythm.json.
function rhythmName(file: string): string {
	return file.replace(/\.cho$/, '.rhythm.json');
}

// Moving a song takes its rhythm file along.
export async function moveSong(
	category: string,
	file: string,
	newCategory: string
): Promise<void> {
	const categories = await listCategories();
	if (!categories.includes(newCategory)) throw new Error('categoria non valida');
	if (newCategory === category) return;
	if (await songExists(newCategory, file)) {
		throw new Error(`${newCategory}/${file} esiste già`);
	}
	const rhythm = rhythmName(file);
	const hasRhythm = await songExists(category, rhythm);
	if (hasRhythm && (await songExists(newCategory, rhythm))) {
		throw new Error(`${newCategory}/${rhythm} esiste già`);
	}
	// the {tag:...} directive mirrors the category: rewrite it while moving
	const song = parse(await readSong(category, file));
	song.meta.tags = [categoryLabel(newCategory)];
	await writeSong(newCategory, file, serialize(song));
	if (hasRhythm) await fs.rename(songsPath(category, rhythm), songsPath(newCategory, rhythm));
	await deleteSong(category, file);
}

// Deleting a song deletes its rhythm file too.
export async function deleteSong(category: string, file: string): Promise<void> {
	await fs.unlink(songsPath(category, file));
	await fs.rm(songsPath(category, rhythmName(file)), { force: true });
}

export async function songExists(category: string, file: string): Promise<boolean> {
	try {
		await fs.access(songsPath(category, file));
		return true;
	} catch {
		return false;
	}
}
