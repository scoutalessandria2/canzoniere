import { error } from '@sveltejs/kit';
import { parse } from '@canzoniere/shared/chordpro';
import { chordLayoutFingerprint } from '@canzoniere/shared/rhythm';
import { online } from '#lib/online.js';
import { readSong, songExists } from '#lib/server/songs.js';
import { ownRecording, readAnalysis, readRhythm } from '#lib/server/rhythm.js';
import type { PageServerLoad } from './$types';

// Local only: rendered on every request from the engine's cache, never part of
// the online build.
export const prerender = false;

export const load: PageServerLoad = async ({ params }) => {
	const { category, file } = params;
	if (online || !file.endsWith('.cho') || !(await songExists(category, file))) {
		error(404, 'Canzone non trovata');
	}
	const [content, analysis, saved, recording] = await Promise.all([
		readSong(category, file),
		readAnalysis(category, file),
		readRhythm(category, file),
		ownRecording(category, file)
	]);
	return {
		category,
		file,
		content,
		analysis,
		saved,
		recording,
		fingerprint: chordLayoutFingerprint(parse(content))
	};
};
