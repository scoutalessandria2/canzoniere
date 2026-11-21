import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { isRhythmFile, isRhythmSource, type RhythmFile } from '@canzoniere/shared/rhythm';
import type { RhythmAnalysis } from '#lib/rhythm-model.js';
import { songsPath } from './songs.js';

// The rhythm engine's cache (audio, stems, analyses) lives in rhythm/.cache/,
// outside the songs; override with RHYTHM_CACHE_DIR (used by tests).
export const CACHE_DIR = path.resolve(
	process.env.RHYTHM_CACHE_DIR ?? path.join(process.cwd(), '..', 'rhythm', '.cache')
);

// The maintainer's own recordings, never committed: registrazioni/ at the
// repository root, laid out like the songs (<category>/<slug>.<any audio
// extension>); override with RECORDINGS_DIR (used by tests).
export const RECORDINGS_DIR = path.resolve(
	process.env.RECORDINGS_DIR ?? path.join(process.cwd(), '..', 'registrazioni')
);

// The rhythm file saved next to a song: la_gioia.cho -> la_gioia.rhythm.json.
export function rhythmFileName(file: string): string {
	if (!file.endsWith('.cho')) throw new Error('file must end with .cho');
	return file.slice(0, -'.cho'.length) + '.rhythm.json';
}

// The saved rhythm of a song, or null when it has none or the file is not valid.
export async function readRhythm(category: string, file: string): Promise<RhythmFile | null> {
	try {
		const data: unknown = JSON.parse(
			await fs.readFile(songsPath(category, rhythmFileName(file)), 'utf-8')
		);
		return isRhythmFile(data) ? data : null;
	} catch {
		return null;
	}
}

export async function writeRhythm(
	category: string,
	file: string,
	data: RhythmFile
): Promise<void> {
	await fs.writeFile(
		songsPath(category, rhythmFileName(file)),
		JSON.stringify(data, null, '\t') + '\n',
		'utf-8'
	);
}

// The cache folder of a song: <CACHE_DIR>/<category>/<slug>.
function cacheFolder(category: string, file: string): string {
	if (!file.endsWith('.cho')) throw new Error('file must end with .cho');
	const slug = file.slice(0, -'.cho'.length);
	const folder = path.resolve(CACHE_DIR, category, slug);
	if (!folder.startsWith(CACHE_DIR + path.sep)) throw new Error('invalid path');
	return folder;
}

// The maintainer's own recording of a song: its path relative to
// RECORDINGS_DIR and the SHA-256 of its bytes, or null when there is none.
// With several files for the song (the engine refuses to choose), the first
// by name.
export async function ownRecording(
	category: string,
	file: string
): Promise<{ path: string; hash: string } | null> {
	if (!file.endsWith('.cho')) throw new Error('file must end with .cho');
	const slug = file.slice(0, -'.cho'.length);
	const folder = path.resolve(RECORDINGS_DIR, category);
	if (!folder.startsWith(RECORDINGS_DIR + path.sep)) throw new Error('invalid path');
	let names: string[];
	try {
		names = await fs.readdir(folder);
	} catch {
		return null;
	}
	for (const name of names.sort()) {
		if (name.startsWith('.') || path.parse(name).name !== slug) continue;
		const full = path.join(folder, name);
		try {
			if (!(await fs.stat(full)).isFile()) continue;
			const hash = createHash('sha256');
			await pipeline(createReadStream(full), hash);
			return { path: `${category}/${name}`, hash: hash.digest('hex') };
		} catch {
			continue;
		}
	}
	return null;
}

// The engine's analysis of a song, or null when it has none or it is not the known format.
export async function readAnalysis(
	category: string,
	file: string
): Promise<RhythmAnalysis | null> {
	try {
		const data: unknown = JSON.parse(
			await fs.readFile(path.join(cacheFolder(category, file), 'analysis.json'), 'utf-8')
		);
		if (typeof data !== 'object' || data === null) return null;
		const analysis = data as Partial<RhythmAnalysis>;
		const known =
			analysis.version === 1 &&
			isRhythmSource(analysis.source) &&
			typeof analysis.audio === 'string' &&
			Array.isArray(analysis.readings);
		return known ? (analysis as RhythmAnalysis) : null;
	} catch {
		return null;
	}
}

// The cached audio the analysis names, when the file exists.
export async function analysisAudioPath(category: string, file: string): Promise<string | null> {
	const analysis = await readAnalysis(category, file);
	if (!analysis) return null;
	const folder = cacheFolder(category, file);
	const audio = path.resolve(folder, analysis.audio);
	if (!audio.startsWith(folder + path.sep)) return null;
	try {
		return (await fs.stat(audio)).isFile() ? audio : null;
	} catch {
		return null;
	}
}
