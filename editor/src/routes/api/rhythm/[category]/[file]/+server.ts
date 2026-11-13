import { error } from '@sveltejs/kit';
import { isRhythmFile } from '@canzoniere/shared/rhythm';
import { songExists } from '#lib/server/songs.js';
import { writeRhythm } from '#lib/server/rhythm.js';
import type { RequestHandler } from './$types';

// Save the rhythm file next to its song.
export const PUT: RequestHandler = async ({ params, request }) => {
	const data: unknown = await request.json().catch(() => null);
	if (!isRhythmFile(data)) error(400, 'File del ritmo non valido');
	if (!params.file.endsWith('.cho') || !(await songExists(params.category, params.file))) {
		error(404, 'Canzone non trovata');
	}
	await writeRhythm(params.category, params.file, data);
	return Response.json({ ok: true });
};
