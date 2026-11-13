import { error } from '@sveltejs/kit';
import { online } from '#lib/online.js';
import { readSong, listCategories, listAllTags, songExists } from '#lib/server/songs.js';
import { ownRecording, readRhythm } from '#lib/server/rhythm.js';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	if (!(await songExists(params.category, params.file))) {
		error(404, 'Canzone non trovata');
	}
	// The saved rhythm and the maintainer's own recording, to tell whether the
	// rhythm still fits (local mode only: the rhythm tools are not part of the
	// online build).
	const [content, categories, allTags, saved, recording] = await Promise.all([
		readSong(params.category, params.file),
		listCategories(),
		listAllTags(),
		online ? null : readRhythm(params.category, params.file),
		online ? null : ownRecording(params.category, params.file)
	]);
	return {
		content,
		categories,
		allTags,
		saved,
		recordingHash: recording?.hash ?? null,
		category: params.category,
		file: params.file
	};
};
