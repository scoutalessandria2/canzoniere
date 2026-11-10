// Which note comes out of every string of a chord shape, and what that note is
// doing inside the chord. Everything is derived from the same ChordPro
// definitions that draw the diagrams, so the theory always matches the picture.
// Strings are indexed as in ChordPro's frets array: 0 = 6ª (Mi basso), 5 = 1ª
// (Mi cantino).

import { getChordDefinition, OPEN_MIDI } from '@canzoniere/shared/diagrams';

const SCALE = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

const NOTE_SEMITONE: Record<string, number> = {
	Do: 0,
	Re: 2,
	Mi: 4,
	Fa: 5,
	Sol: 7,
	La: 9,
	Si: 11
};

// standard tuning, from the 6ª to the 1ª: Mi La Re Sol Si Mi
const OPEN_STRINGS = [4, 9, 2, 7, 11, 4];

/** Name of each string, from the 6ª to the 1ª. */
export const STRING_NAMES = ['Mi basso', 'La', 'Re', 'Sol', 'Si', 'Mi cantino'];

/** "6ª corda (Mi basso)" for the string at index `s` of the frets array. */
export function stringLabel(s: number): string {
	return `${6 - s}ª corda (${STRING_NAMES[s]})`;
}

/** The note the string at index `s` gives when pressed at `fret` (0 = open). */
export function noteAt(s: number, fret: number): string {
	return SCALE[(OPEN_STRINGS[s] + fret) % 12];
}

/** MIDI number of that same note, for playback. */
export function midiAt(s: number, fret: number): number {
	return OPEN_MIDI[s] + fret;
}

/** MIDI number of every string of a shape, from the 6ª to the 1ª; null when muted. */
export function voicingMidi(voicing: Voicing): (number | null)[] {
	return voicing.strings.map((s) => (s.fret < 0 ? null : midiAt(s.string, s.fret)));
}

// "Sol" must come before "Si" so that "Sol#" is not parsed as "Si"
const LATIN_NOTE_RE = /^(Do|Re|Mi|Fa|Sol|Si|La)([#b]?)/;

/** Semitone of the note that names the chord, or null when unparseable. */
export function rootSemitone(latinChord: string): number | null {
	const m = latinChord.trim().match(LATIN_NOTE_RE);
	if (!m) return null;
	const flat = m[2] === 'b' ? -1 : m[2] === '#' ? 1 : 0;
	return (((NOTE_SEMITONE[m[1]] + flat) % 12) + 12) % 12;
}

// What each distance from the root is called. The short form goes in the
// diagram table, the long one in the explanations.
const ROLES: { short: string; long: string }[] = [
	{ short: '1', long: 'fondamentale' },
	{ short: '9♭', long: 'nona minore' },
	{ short: '9', long: 'nona' },
	{ short: '3m', long: 'terza minore' },
	{ short: '3', long: 'terza maggiore' },
	{ short: '4', long: 'quarta' },
	{ short: '5♭', long: 'quinta diminuita' },
	{ short: '5', long: 'quinta' },
	{ short: '5♯', long: 'quinta aumentata' },
	{ short: '6', long: 'sesta' },
	{ short: '7', long: 'settima' },
	{ short: '7+', long: 'settima maggiore' }
];

export interface StringNote {
	string: number; // index in the frets array: 0 = 6ª, 5 = 1ª
	fret: number; // -1 muted, 0 open, otherwise the fret to press
	note: string | null; // null on a muted string
	interval: number | null; // semitones above the root
	role: string | null; // "fondamentale", "terza minore", …
	roleShort: string | null; // "1", "3m", …
}

export interface Voicing {
	chord: string; // latin name, e.g. "Lam7"
	strings: StringNote[]; // from the 6ª to the 1ª
}

/**
 * The sounding notes of a chord shape, one entry per string. Returns null when
 * ChordPro has no diagram for the chord or the name has no readable root.
 */
export function chordVoicing(latinChord: string): Voicing | null {
	const def = getChordDefinition(latinChord);
	const root = rootSemitone(latinChord);
	if (!def || root === null) return null;

	const strings = def.frets.map((fret, s) => {
		// above the first position the diagram window starts at def.base
		const at = fret > 0 && def.base > 1 ? fret + def.base - 1 : fret;
		if (at < 0) {
			return { string: s, fret: -1, note: null, interval: null, role: null, roleShort: null };
		}
		const semitone = (OPEN_STRINGS[s] + at) % 12;
		const interval = (((semitone - root) % 12) + 12) % 12;
		return {
			string: s,
			fret: at,
			note: SCALE[semitone],
			interval,
			role: ROLES[interval].long,
			roleShort: ROLES[interval].short
		};
	});

	return { chord: latinChord, strings };
}

export interface ChordNote {
	note: string;
	interval: number;
	role: string;
	roleShort: string;
}

/** The distinct notes of a voicing, from the fondamentale upwards. */
export function chordNotes(voicing: Voicing): ChordNote[] {
	const seen = new Map<number, ChordNote>();
	for (const s of voicing.strings) {
		if (s.note === null || s.interval === null) continue;
		if (!seen.has(s.interval)) {
			seen.set(s.interval, {
				note: s.note,
				interval: s.interval,
				role: s.role as string,
				roleShort: s.roleShort as string
			});
		}
	}
	return [...seen.values()].sort((a, b) => a.interval - b.interval);
}

export interface VoicingChange {
	string: number;
	from: StringNote;
	to: StringNote;
}

/** The strings whose fret differs between two shapes of the same root. */
export function voicingDiff(from: Voicing, to: Voicing): VoicingChange[] {
	const out: VoicingChange[] = [];
	for (let s = 0; s < from.strings.length; s++) {
		const a = from.strings[s];
		const b = to.strings[s];
		if (a.fret !== b.fret) out.push({ string: s, from: a, to: b });
	}
	return out;
}

function fretPhrase(s: StringNote): string {
	if (s.fret < 0) return 'resta muta';
	if (s.fret === 0) return `suona il ${s.note} a vuoto`;
	return `suona il ${s.note} al ${s.fret}º tasto`;
}

/** One sentence per changed string, explaining the move and what it adds. */
export function changeSentence(change: VoicingChange, toChord: string): string {
	const { from, to } = change;
	const head = `Sulla ${stringLabel(change.string)}`;
	if (to.fret < 0) return `${head} togli il dito e non suoni più la corda.`;
	const move =
		from.fret < 0
			? `entra nell'accordo e ${fretPhrase(to)}`
			: to.fret === 0
				? `alzi il dito dal ${from.fret}º tasto e la corda dà il ${to.note} a vuoto`
				: from.fret === 0
					? `appoggi un dito al ${to.fret}º tasto e la corda dà il ${to.note}`
					: `sposti il dito dal ${from.fret}º al ${to.fret}º tasto e la corda dà il ${to.note}`;
	const tail =
		to.role === from.role
			? `, sempre la ${to.role}`
			: from.role === null
				? `, che è la ${to.role} di ${toChord}`
				: `, che è la ${to.role} di ${toChord} al posto della ${from.role}`;
	return `${head} ${move}${tail}.`;
}

/** What the hand does on one string when going from a chord to another one. */
export type MoveKind =
	| 'still' // a finger already there and it does not move: the pivot
	| 'open' // the string was and stays open
	| 'moves' // the finger slides to another fret
	| 'press' // a finger comes down on a string that was open
	| 'lift' // the finger comes off and the string rings open
	| 'mute' // the string stops being played
	| 'enter'; // the string comes back into the chord

export interface StringMove {
	string: number;
	from: StringNote;
	to: StringNote;
	kind: MoveKind;
}

function moveKind(from: StringNote, to: StringNote): MoveKind {
	if (to.fret < 0) return 'mute';
	if (from.fret < 0) return 'enter';
	if (from.fret === to.fret) return to.fret === 0 ? 'open' : 'still';
	if (from.fret === 0) return 'press';
	if (to.fret === 0) return 'lift';
	return 'moves';
}

/**
 * String by string, what changes between two chord shapes. Unlike
 * `voicingDiff`, which only lists the strings that differ, this keeps every
 * string: for a chord change the ones that stay put matter just as much, since
 * they are the fingers to leave down while the others move.
 */
export function voicingMoves(from: Voicing, to: Voicing): StringMove[] {
	return from.strings.map((a, s) => {
		const b = to.strings[s];
		return { string: s, from: a, to: b, kind: moveKind(a, b) };
	});
}

/** One sentence for a string that changes, ending with the note's role in the new chord. */
export function moveSentence(move: StringMove, toChord: string): string {
	const { from, to, kind } = move;
	const head = `Sulla ${stringLabel(move.string)}`;
	const role = to.role ? `, che in ${toChord} è la ${to.role}` : '';
	switch (kind) {
		case 'mute':
			return `${head} togli il dito e non suoni più la corda.`;
		case 'enter':
			return to.fret === 0
				? `${head} la corda torna a suonare, a vuoto: dà il ${to.note}${role}.`
				: `${head} appoggi un dito al ${to.fret}º tasto e la corda rientra con il ${to.note}${role}.`;
		case 'press':
			return `${head} appoggi un dito al ${to.fret}º tasto: da ${from.note} a vuoto passi al ${to.note}${role}.`;
		case 'lift':
			return `${head} alzi il dito dal ${from.fret}º tasto e la corda suona a vuoto il ${to.note}${role}.`;
		case 'moves':
			return `${head} sposti il dito dal ${from.fret}º al ${to.fret}º tasto: dà il ${to.note}${role}.`;
		case 'still':
			return `${head} il dito resta al ${to.fret}º tasto e continua a dare il ${to.note}${role}.`;
		case 'open':
			return `${head} non tocchi niente: resta a vuoto sul ${to.note}${role}.`;
	}
}

/** "la 4ª e la 2ª corda" from a list of string indexes, for the summary lines. */
export function stringList(strings: number[]): string {
	const names = strings.map((s) => `la ${6 - s}ª`);
	if (names.length === 0) return '';
	if (names.length === 1) return `${names[0]} corda`;
	return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]} corda`;
}
