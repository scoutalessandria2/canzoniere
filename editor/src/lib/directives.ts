// The ChordPro directives the editor knows: the ones the ChordPro tab offers
// while typing `{`, with an Italian description, and the checks that flag a
// directive line the reader, the editor or the PDF tools would misread.

import { PAUSE_MAX } from '@canzoniere/shared/pauses';
import { YOUTUBE_ID_RE } from '@canzoniere/shared/youtube';

export type DirectiveKind = 'meta' | 'custom' | 'chorus' | 'comment' | 'other';

export interface DirectiveSpec {
	name: string;
	aliases?: string[];
	kind: DirectiveKind;
	// none: {name}; optional: {name} or {name:label}; text: {name:value};
	// int: {name:N}, N a whole number in [min, max]; youtube: {name:<video id>}
	value: 'none' | 'optional' | 'text' | 'int' | 'youtube';
	min?: number;
	max?: number;
	description: string;
	// value the autocomplete inserts already selected, so typing replaces it
	placeholder?: string;
	// offered by the autocomplete
	suggest?: boolean;
}

// in the order the autocomplete lists them
const SPECS: DirectiveSpec[] = [
	{
		name: 'x_pause',
		kind: 'custom',
		value: 'int',
		min: 1,
		max: PAUSE_MAX,
		placeholder: '4',
		description: `pausa dello scorrimento sulla riga sopra, in secondi (1–${PAUSE_MAX})`,
		suggest: true
	},
	{
		name: 'x_tag',
		kind: 'custom',
		value: 'text',
		description: 'tag di ricerca, uno per direttiva (es. omelia)',
		suggest: true
	},
	{
		name: 'x_scroll',
		kind: 'custom',
		value: 'int',
		min: 1,
		max: 10,
		placeholder: '3',
		description: 'velocità iniziale dello scorrimento (1–10)',
		suggest: true
	},
	{
		name: 'x_youtube',
		kind: 'custom',
		value: 'youtube',
		placeholder: 'id del video',
		description: 'video YouTube della registrazione (id di 11 caratteri)',
		suggest: true
	},
	{
		name: 'comment',
		aliases: ['c'],
		kind: 'comment',
		value: 'text',
		description: 'commento, es. Rit.',
		suggest: true
	},
	{
		name: 'start_of_chorus',
		aliases: ['soc'],
		kind: 'chorus',
		value: 'optional',
		description: 'inizio del ritornello',
		suggest: true
	},
	{
		name: 'end_of_chorus',
		aliases: ['eoc'],
		kind: 'chorus',
		value: 'none',
		description: 'fine del ritornello',
		suggest: true
	},
	{
		name: 'start_of_tab',
		aliases: ['sot'],
		kind: 'other',
		value: 'optional',
		description: 'inizio della tablatura',
		suggest: true
	},
	{
		name: 'end_of_tab',
		aliases: ['eot'],
		kind: 'other',
		value: 'none',
		description: 'fine della tablatura',
		suggest: true
	},
	{ name: 'title', aliases: ['t'], kind: 'meta', value: 'text', description: 'titolo', suggest: true },
	{ name: 'artist', kind: 'meta', value: 'text', description: 'autore', suggest: true },
	{
		name: 'columns',
		aliases: ['col'],
		kind: 'meta',
		value: 'int',
		min: 1,
		max: 4,
		placeholder: '2',
		description: 'colonne nel PDF (1–4)',
		suggest: true
	},
	{
		name: 'transpose',
		kind: 'other',
		value: 'int',
		placeholder: '2',
		description: 'trasporta gli accordi di N semitoni nel PDF',
		suggest: true
	},
	// the editor writes it from the category on save
	{ name: 'tag', kind: 'meta', value: 'text', description: 'categoria' },
	{ name: 'chorus', kind: 'chorus', value: 'optional', description: 'ripete il ritornello' }
];

// standard ChordPro directives the songs may carry: accepted as they are
const OTHER_CHORDPRO = [
	'subtitle', 'st', 'composer', 'lyricist', 'copyright', 'album', 'year', 'key', 'time',
	'tempo', 'duration', 'capo', 'meta', 'sorttitle', 'start_of_verse', 'sov', 'end_of_verse',
	'eov', 'start_of_bridge', 'sob', 'end_of_bridge', 'eob', 'start_of_grid', 'sog',
	'end_of_grid', 'eog', 'comment_italic', 'ci', 'comment_box', 'cb', 'highlight', 'image',
	'define', 'chord', 'new_page', 'np', 'new_physical_page', 'npp', 'column_break', 'colb',
	'new_song', 'ns', 'grid', 'g', 'no_grid', 'ng', 'titles', 'pagetype', 'textfont',
	'textsize', 'textcolour', 'chordfont', 'chordsize', 'chordcolour', 'tabfont', 'tabsize',
	'tabcolour'
];

const BY_NAME = new Map<string, DirectiveSpec>();
for (const spec of SPECS) {
	BY_NAME.set(spec.name, spec);
	for (const alias of spec.aliases ?? []) BY_NAME.set(alias, spec);
}
for (const name of OTHER_CHORDPRO) {
	BY_NAME.set(name, { name, kind: 'other', value: 'optional', description: '' });
}

// the directives offered for what follows `{`: by name, or by name without
// the x_ prefix (`{pau` finds x_pause)
export function completions(query: string): DirectiveSpec[] {
	const q = query.toLowerCase();
	return SPECS.filter(
		(s) => s.suggest && (s.name.startsWith(q) || s.name.replace(/^x_/, '').startsWith(q))
	);
}

export interface Problem {
	line: number; // 0-based
	severity: 'error' | 'warning';
	message: string;
}

export type LineInfo =
	| { kind: 'text' } // lyrics and blank lines
	| { kind: 'tab' } // inside {start_of_tab}…{end_of_tab}, kept verbatim
	| {
			kind: 'directive';
			spec: DirectiveSpec | null;
			// the line split so that open + name + sep + value + close === line
			open: string;
			name: string;
			sep: string;
			value: string;
			close: string;
			problem: Problem | null;
			bad: 'name' | 'value' | 'line' | null; // the part the problem is about
	  }
	| { kind: 'malformed'; problem: Problem }; // starts with `{`, parsed as lyrics

// a directive alone on its line, as shared/chordpro.ts parses it
const DIRECTIVE_RE = /^(\{\s*)([\w-]+)(?:(\s*:\s*)(.*?))?(\s*\}\s*)$/;

function distance(a: string, b: string): number {
	const row = Array.from({ length: b.length + 1 }, (_, j) => j);
	for (let i = 1; i <= a.length; i++) {
		let prev = row[0];
		row[0] = i;
		for (let j = 1; j <= b.length; j++) {
			const cur = row[j];
			row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
			prev = cur;
		}
	}
	return row[b.length];
}

function closest(name: string): string | null {
	let best: string | null = null;
	let bestDistance = 3;
	for (const known of BY_NAME.keys()) {
		const d = distance(name, known);
		if (d < bestDistance && d < known.length / 2) {
			best = known;
			bestDistance = d;
		}
	}
	return best;
}

function rangeText(spec: DirectiveSpec): string {
	if (spec.min !== undefined && spec.max !== undefined) return ` da ${spec.min} a ${spec.max}`;
	if (spec.min !== undefined) return ` da ${spec.min} in su`;
	return '';
}

// what is wrong with a line that starts with `{` but is not a directive:
// the parser reads it as lyrics
function malformedMessage(line: string): string {
	const close = line.lastIndexOf('}');
	if (close === -1) return 'Manca la «}» di chiusura';
	if (line.slice(close + 1).trim() !== '')
		return 'Dopo la «}» non va scritto altro: la direttiva vuole una riga tutta sua';
	return 'Direttiva scritta male: usa {nome} oppure {nome:valore}';
}

export function analyze(source: string): { lines: LineInfo[]; problems: Problem[] } {
	const lines: LineInfo[] = [];
	const problems: Problem[] = [];
	let inTab = false;
	// a pause holds on the timed line before it: one with none above is ignored
	let timedSeen = false;

	source.split('\n').forEach((raw, idx) => {
		const line = raw.replace(/\r$/, '');
		const m = line.match(DIRECTIVE_RE);
		const name = m?.[2].toLowerCase() ?? '';

		if (inTab) {
			if (name === 'end_of_tab' || name === 'eot') inTab = false;
			else {
				lines.push({ kind: 'tab' });
				return;
			}
		}

		if (!m) {
			if (/^\s*\{/.test(line)) {
				const trimmed = line.trimStart();
				const message =
					trimmed !== line && DIRECTIVE_RE.test(trimmed)
						? 'Togli gli spazi prima della «{»: così la riga è letta come testo'
						: malformedMessage(trimmed);
				const problem: Problem = { line: idx, severity: 'error', message };
				problems.push(problem);
				lines.push({ kind: 'malformed', problem });
			} else {
				lines.push({ kind: 'text' });
			}
			if (line.trim() !== '') timedSeen = true;
			return;
		}

		const [, open, rawName, sep = '', value = '', close] = m;
		const spec = BY_NAME.get(name) ?? null;
		const issue = check(spec, rawName, value, timedSeen);
		const problem: Problem | null = issue
			? { line: idx, severity: issue.severity, message: issue.message }
			: null;
		if (problem) problems.push(problem);
		lines.push({
			kind: 'directive',
			spec,
			open,
			name: rawName,
			sep,
			value,
			close,
			problem,
			bad: issue?.part ?? null
		});

		if (spec?.name === 'start_of_tab') inTab = true;
		if (spec?.name === 'comment' || spec?.name === 'start_of_tab') timedSeen = true;
	});

	return { lines, problems };
}

function check(
	spec: DirectiveSpec | null,
	rawName: string,
	value: string,
	timedSeen: boolean
): { part: 'name' | 'value' | 'line'; severity: Problem['severity']; message: string } | null {
	const error = (part: 'name' | 'value', message: string) => ({
		part,
		severity: 'error' as const,
		message
	});
	if (!spec) {
		const guess = closest(rawName.toLowerCase());
		return error(
			'name',
			guess
				? `Direttiva sconosciuta «${rawName}»: forse «${guess}»?`
				: `Direttiva sconosciuta «${rawName}»`
		);
	}
	if (spec.value === 'none' && value !== '') return error('value', `«${spec.name}» non vuole un valore`);
	if ((spec.value === 'text' || spec.value === 'int' || spec.value === 'youtube') && value === '')
		return error('name', `«${spec.name}» vuole un valore: {${spec.name}:…}`);
	if (spec.value === 'int') {
		const n = Number(value);
		if (
			!/^[+-]?\d+$/.test(value) ||
			(spec.min !== undefined && n < spec.min) ||
			(spec.max !== undefined && n > spec.max)
		)
			return error('value', `«${spec.name}» vuole un numero intero${rangeText(spec)}`);
	}
	if (spec.value === 'youtube' && !YOUTUBE_ID_RE.test(value))
		return error('value', `«${spec.name}» vuole l'id di un video YouTube (11 caratteri)`);
	if (spec.name === 'x_pause' && !timedSeen)
		return {
			part: 'line',
			severity: 'warning',
			message: 'Pausa prima della prima riga di testo: il reader la ignora'
		};
	return null;
}
