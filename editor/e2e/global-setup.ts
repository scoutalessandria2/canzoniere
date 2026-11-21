import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { parse } from '../../shared/chordpro';
import { chordLayoutFingerprint } from '../../shared/rhythm';

const TMP = path.resolve('e2e/.tmp-songs');
const TMP_BOOKS = path.resolve('e2e/.tmp-songbooks');
const TMP_RHYTHM_CACHE = path.resolve('e2e/.tmp-rhythm-cache');
const TMP_RECORDINGS = path.resolve('e2e/.tmp-recordings');

const SEED = `{title:Stella del mattino}
{tag:Varie}

[Do]Stella del mattino brilla
nel [Sol]cielo di settembre
`;

// A second song for the specs that edit it in parallel with the ones using the
// first.
const SEED_LINK = `{title:Link di prova}
{tag:Varie}

[Do]Una riga
`;

// The song the rhythm file routes are tested on.
const SEED_RHYTHM = `{title:Ritmo file}
{tag:Varie}
{x_youtube:jv_i536nIvc}

[Do]Prima riga [Sol]qui
[Do]Seconda [Sol]riga
`;

// The song the review page is tested on, with the engine's analysis of it.
export const SEED_REVIEW = `{title:Ritmo di prova}
{tag:Varie}
{x_youtube:jv_i536nIvc}

[Do]Prima riga
{start_of_chorus}
la se[Sol]conda
{end_of_chorus}
`;

// A song with no recording link and no analysis, for the rhythm pages' empty
// states. It sits in clan, where no test counts the songs, and no test moves or
// deletes it.
const SEED_PLAIN = `{title:Senza ritmo}
{tag:Clan}

[Do]Una riga senza [Sol]link
`;
// A song with no recording link, analysed on the maintainer's own recording
// (OWN_RECORDING). It sits in clan, where no test counts the songs.
export const SEED_OWN = `{title:Ritmo mio}
{tag:Clan}

[Do]Prima riga
{start_of_chorus}
la se[Sol]conda
{end_of_chorus}
`;
const ANALYSIS = path.resolve('e2e/fixtures/rhythm-analysis.json');

// A WAV file of silence, 16-bit mono: the recording the review page plays.
export function silence(seconds: number, rate: number): Buffer {
	const bytes = Math.round(seconds * rate) * 2;
	const wav = Buffer.alloc(44 + bytes);
	wav.write('RIFF', 0);
	wav.writeUInt32LE(36 + bytes, 4);
	wav.write('WAVE', 8);
	wav.write('fmt ', 12);
	wav.writeUInt32LE(16, 16); // format chunk size
	wav.writeUInt16LE(1, 20); // PCM
	wav.writeUInt16LE(1, 22); // channels
	wav.writeUInt32LE(rate, 24);
	wav.writeUInt32LE(rate * 2, 28); // bytes per second
	wav.writeUInt16LE(2, 32); // bytes per frame
	wav.writeUInt16LE(16, 34); // bits per sample
	wav.write('data', 36);
	wav.writeUInt32LE(bytes, 40);
	return wav;
}

export default function globalSetup() {
	fs.rmSync(TMP, { recursive: true, force: true });
	fs.mkdirSync(path.join(TMP, 'clan'), { recursive: true });
	fs.mkdirSync(path.join(TMP, 'reparto'), { recursive: true });
	fs.mkdirSync(path.join(TMP, 'varie'), { recursive: true });
	fs.writeFileSync(path.join(TMP, 'varie', 'stella_del_mattino.cho'), SEED, 'utf-8');
	fs.writeFileSync(path.join(TMP, 'varie', 'link_di_prova.cho'), SEED_LINK, 'utf-8');
	fs.writeFileSync(path.join(TMP, 'varie', 'ritmo_file.cho'), SEED_RHYTHM, 'utf-8');
	fs.writeFileSync(path.join(TMP, 'varie', 'ritmo_di_prova.cho'), SEED_REVIEW, 'utf-8');
	fs.writeFileSync(path.join(TMP, 'clan', 'senza_ritmo.cho'), SEED_PLAIN, 'utf-8');
	fs.writeFileSync(path.join(TMP, 'clan', 'ritmo_mio.cho'), SEED_OWN, 'utf-8');

	fs.rmSync(TMP_RHYTHM_CACHE, { recursive: true, force: true });
	const review = path.join(TMP_RHYTHM_CACHE, 'varie', 'ritmo_di_prova');
	fs.mkdirSync(review, { recursive: true });
	const analysis = JSON.parse(fs.readFileSync(ANALYSIS, 'utf-8'));
	analysis.fingerprint = chordLayoutFingerprint(parse(SEED_REVIEW));
	fs.writeFileSync(path.join(review, 'analysis.json'), JSON.stringify(analysis, null, '\t'), 'utf-8');
	fs.writeFileSync(path.join(review, 'audio.wav'), silence(3, 22050));

	fs.rmSync(TMP_RECORDINGS, { recursive: true, force: true });
	fs.mkdirSync(path.join(TMP_RECORDINGS, 'clan'), { recursive: true });
	const recording = silence(2, 22050);
	fs.writeFileSync(path.join(TMP_RECORDINGS, 'clan', 'ritmo_mio.wav'), recording);
	const own = path.join(TMP_RHYTHM_CACHE, 'clan', 'ritmo_mio');
	fs.mkdirSync(own, { recursive: true });
	fs.writeFileSync(
		path.join(own, 'analysis.json'),
		JSON.stringify(
			{
				...analysis,
				song: 'clan/ritmo_mio.cho',
				source: { kind: 'file', id: createHash('sha256').update(recording).digest('hex') },
				fingerprint: chordLayoutFingerprint(parse(SEED_OWN))
			},
			null,
			'\t'
		),
		'utf-8'
	);
	fs.writeFileSync(path.join(own, 'audio.wav'), recording);

	fs.rmSync(TMP_BOOKS, { recursive: true, force: true });
	fs.mkdirSync(TMP_BOOKS, { recursive: true });
	fs.writeFileSync(
		path.join(TMP_BOOKS, 'uscita_2026.txt'),
		'varie/stella_del_mattino.cho\n',
		'utf-8'
	);
}
