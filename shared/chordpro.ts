// ChordPro parse/serialize for the visual editor.
// Lyric lines are modeled as plain text plus chords anchored at character positions.

import { YOUTUBE_ID_RE } from './youtube';

export interface Chord {
	pos: number; // character index in the lyric text where the chord is anchored
	chord: string;
}

export type Line =
	| { type: 'lyric'; text: string; chords: Chord[] }
	| { type: 'empty' }
	| { type: 'chorus_start' }
	| { type: 'chorus_end' }
	| { type: 'comment'; text: string }
	| { type: 'tab'; text: string } // {start_of_tab}...{end_of_tab} block, content verbatim (multiline)
	| { type: 'pause'; seconds: number } // {x_pause:N}: the reader's autoscroll holds N seconds on the preceding line
	| { type: 'directive'; raw: string }; // preserved verbatim (e.g. {transpose:2}, {chorus})

export interface SongMeta {
	title: string;
	artist: string;
	tags: string[];
	labels: string[]; // free-form search tags ({x_tag:...}), distinct from the category {tag:...}
	columns: number | null;
	scroll: number | null; // initial autoscroll speed for the reader ({x_scroll:N})
	youtube: string | null; // id of the recording's YouTube video ({x_youtube:<id>})
}

export interface Song {
	meta: SongMeta;
	lines: Line[];
}

const DIRECTIVE_RE = /^\{\s*([\w-]+)\s*(?::\s*(.*?)\s*)?\}\s*$/;

export function parseLyricLine(raw: string): { text: string; chords: Chord[] } {
	let text = '';
	const chords: Chord[] = [];
	let i = 0;
	while (i < raw.length) {
		if (raw[i] === '[') {
			const close = raw.indexOf(']', i);
			if (close !== -1) {
				chords.push({ pos: text.length, chord: raw.slice(i + 1, close) });
				i = close + 1;
				continue;
			}
		}
		text += raw[i];
		i++;
	}
	return { text, chords };
}

export function parse(source: string): Song {
	const meta: SongMeta = {
		title: '',
		artist: '',
		tags: [],
		labels: [],
		columns: null,
		scroll: null,
		youtube: null
	};
	const lines: Line[] = [];

	// inside a tab block every line is kept verbatim until {end_of_tab}
	let tabBuffer: string[] | null = null;

	for (const raw of source.split(/\r?\n/)) {
		const m = raw.match(DIRECTIVE_RE);
		if (tabBuffer !== null) {
			const name = m?.[1].toLowerCase();
			if (name === 'end_of_tab' || name === 'eot') {
				lines.push({ type: 'tab', text: tabBuffer.join('\n') });
				tabBuffer = null;
			} else {
				tabBuffer.push(raw);
			}
			continue;
		}
		if (m) {
			const name = m[1].toLowerCase();
			const value = m[2] ?? '';
			switch (name) {
				case 'title':
				case 't':
					meta.title = value;
					continue;
				case 'artist':
					meta.artist = value;
					continue;
				case 'tag':
					meta.tags.push(value);
					continue;
				case 'x_tag':
					if (value !== '') meta.labels.push(value);
					continue;
				case 'columns':
					meta.columns = parseInt(value, 10) || null;
					continue;
				case 'x_scroll':
					meta.scroll = parseInt(value, 10) || null;
					continue;
				case 'x_youtube':
					if (YOUTUBE_ID_RE.test(value)) {
						meta.youtube = value;
						continue;
					}
					lines.push({ type: 'directive', raw: raw.trim() });
					continue;
				case 'x_pause': {
					const seconds = parseInt(value, 10);
					if (seconds > 0) {
						lines.push({ type: 'pause', seconds });
						continue;
					}
					lines.push({ type: 'directive', raw: raw.trim() });
					continue;
				}
				case 'start_of_chorus':
				case 'soc':
					lines.push({ type: 'chorus_start' });
					continue;
				case 'end_of_chorus':
				case 'eoc':
					lines.push({ type: 'chorus_end' });
					continue;
				case 'comment':
				case 'c':
					lines.push({ type: 'comment', text: value });
					continue;
				case 'start_of_tab':
				case 'sot':
					tabBuffer = [];
					continue;
				default:
					lines.push({ type: 'directive', raw: raw.trim() });
					continue;
			}
		}
		if (raw.trim() === '') {
			lines.push({ type: 'empty' });
		} else {
			lines.push({ type: 'lyric', ...parseLyricLine(raw) });
		}
	}

	// a tab block never closed still becomes a tab line
	if (tabBuffer !== null) {
		lines.push({ type: 'tab', text: tabBuffer.join('\n') });
	}

	// drop leading/trailing empties left over from the metadata block
	while (lines.length && lines[0].type === 'empty') lines.shift();
	while (lines.length && lines[lines.length - 1].type === 'empty') lines.pop();

	return { meta, lines };
}

/**
 * Moves chord positions so they stay on the same characters after the lyric
 * text changes: the edit is the span between the common prefix and suffix of
 * the two texts, chords after it shift by the length difference and chords
 * inside it are clamped to its end.
 */
export function remapChords(oldText: string, newText: string, chords: Chord[]): void {
	const maxCommon = Math.min(oldText.length, newText.length);
	let prefix = 0;
	while (prefix < maxCommon && oldText[prefix] === newText[prefix]) prefix++;
	let suffix = 0;
	while (
		suffix < maxCommon - prefix &&
		oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
	)
		suffix++;
	const oldEditEnd = oldText.length - suffix;
	const newEditEnd = newText.length - suffix;
	for (const c of chords) {
		if (c.pos <= prefix) continue;
		c.pos = c.pos >= oldEditEnd ? c.pos - oldEditEnd + newEditEnd : Math.min(c.pos, newEditEnd);
	}
}

export function serializeLyricLine(text: string, chords: Chord[]): string {
	const sorted = [...chords].sort((a, b) => a.pos - b.pos);
	let out = '';
	let cursor = 0;
	for (const c of sorted) {
		const pos = Math.max(0, Math.min(c.pos, text.length));
		out += text.slice(cursor, pos) + '[' + c.chord + ']';
		cursor = pos;
	}
	out += text.slice(cursor);
	return out;
}

export function serialize(song: Song): string {
	const head: string[] = [];
	head.push(`{title:${song.meta.title}}`);
	if (song.meta.artist) head.push(`{artist:${song.meta.artist}}`);
	for (const tag of song.meta.tags) head.push(`{tag:${tag}}`);
	for (const label of song.meta.labels) head.push(`{x_tag:${label}}`);
	if (song.meta.columns) head.push(`{columns:${song.meta.columns}}`);
	if (song.meta.scroll) head.push(`{x_scroll:${song.meta.scroll}}`);
	if (song.meta.youtube) head.push(`{x_youtube:${song.meta.youtube}}`);

	const body: string[] = [];
	for (const line of song.lines) {
		switch (line.type) {
			case 'lyric':
				body.push(serializeLyricLine(line.text, line.chords));
				break;
			case 'empty':
				body.push('');
				break;
			case 'chorus_start':
				body.push('{start_of_chorus}');
				break;
			case 'chorus_end':
				body.push('{end_of_chorus}');
				break;
			case 'comment':
				body.push(`{comment:${line.text}}`);
				break;
			case 'tab':
				body.push('{start_of_tab}');
				if (line.text !== '') body.push(...line.text.split('\n'));
				body.push('{end_of_tab}');
				break;
			case 'pause':
				body.push(`{x_pause:${line.seconds}}`);
				break;
			case 'directive':
				body.push(line.raw);
				break;
		}
	}

	return head.join('\n') + '\n\n' + body.join('\n') + '\n';
}
