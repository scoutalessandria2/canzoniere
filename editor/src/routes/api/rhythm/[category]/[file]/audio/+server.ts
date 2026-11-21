import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { error } from '@sveltejs/kit';
import { analysisAudioPath } from '#lib/server/rhythm.js';
import type { RequestHandler } from './$types';

const TYPES: Record<string, string> = { '.m4a': 'audio/mp4', '.wav': 'audio/wav' };

// The audio of the song's recording, from the engine's cache. Byte ranges are
// served so the browser can seek in it.
export const GET: RequestHandler = async ({ params, request }) => {
	const audio = await analysisAudioPath(params.category, params.file);
	if (!audio) error(404, 'Registrazione non trovata');
	const { size } = await fs.promises.stat(audio);
	const headers: Record<string, string> = {
		'Content-Type': TYPES[path.extname(audio).toLowerCase()] ?? 'application/octet-stream',
		'Accept-Ranges': 'bytes'
	};

	let start = 0;
	let end = size - 1;
	let status = 200;
	const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('range') ?? '');
	if (range && (range[1] || range[2])) {
		if (range[1] === '') {
			start = Math.max(0, size - Number(range[2]));
		} else {
			start = Number(range[1]);
			if (range[2]) end = Math.min(end, Number(range[2]));
		}
		if (start > end) {
			return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
		}
		status = 206;
		headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
	}
	headers['Content-Length'] = String(end - start + 1);

	const body = Readable.toWeb(fs.createReadStream(audio, { start, end })) as ReadableStream;
	return new Response(body, { status, headers });
};
