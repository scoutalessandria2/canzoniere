// Lookup of guitar chord diagrams from ChordPro's built-in definitions.
// chord-definitions.json is the guitar.json shipped inside the chordpro Docker
// image (ChordPro/res/config/guitar.json), the same data the PDF diagrams use.

import raw from './chord-definitions.json';

export interface ChordDef {
	base: number;
	frets: number[];
	fingers?: (number | string)[];
}

interface RawChord {
	name: string;
	base?: number;
	frets?: number[];
	fingers?: (number | string)[];
	copy?: string;
}

const byName = new Map<string, RawChord>();
for (const c of (raw as { chords: RawChord[] }).chords) byName.set(c.name, c);

// entries with `copy` inherit from another chord, optionally overriding fields
function resolve(name: string, depth = 0): ChordDef | null {
	const c = byName.get(name);
	if (!c || depth > 5) return null;
	if (c.copy) {
		const base = resolve(c.copy, depth + 1);
		if (!base) return null;
		return {
			base: c.base ?? base.base,
			frets: c.frets ?? base.frets,
			fingers: c.fingers ?? base.fingers
		};
	}
	if (!c.frets) return null;
	return { base: c.base ?? 1, frets: c.frets, fingers: c.fingers };
}

const LATIN_TO_EN: Record<string, string> = {
	Do: 'C',
	Re: 'D',
	Mi: 'E',
	Fa: 'F',
	Sol: 'G',
	La: 'A',
	Si: 'B'
};

// "Sol" must come before "Si" so that "Sol#" is not parsed as "Si"
const LATIN_PART_RE = /^(Do|Re|Mi|Fa|Sol|Si|La)([#b]?)(.*)$/;

/** "Sol" -> "G", "Lam" -> "Am", "Re/Fa#" -> "D/F#"; non-latin parts pass through ("Do6/9" -> "C6/9"). */
export function latinChordToEnglish(chord: string): string {
	return chord
		.split('/')
		.map((part) => {
			const m = part.match(LATIN_PART_RE);
			if (!m) return part;
			return LATIN_TO_EN[m[1]] + m[2] + m[3];
		})
		.join('/');
}

/**
 * Diagram definition for a latin chord name, or null when ChordPro has no
 * built-in diagram for it (in that case the PDF shows no diagram either).
 */
export function getChordDefinition(latinChord: string): ChordDef | null {
	return resolve(latinChordToEnglish(latinChord.trim()));
}

/** Open strings of a standard-tuned guitar as MIDI note numbers, from the 6ª to the 1ª: Mi La Re Sol Si Mi. */
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];

/**
 * MIDI number of every string of a chord's diagram shape, from the 6ª to the
 * 1ª; null on a muted string, and null overall when there is no diagram.
 */
export function chordMidi(latinChord: string): (number | null)[] | null {
	const def = getChordDefinition(latinChord);
	if (!def) return null;
	return def.frets.map((fret, s) => {
		if (fret < 0) return null;
		// above the first position the diagram window starts at def.base
		const at = fret > 0 && def.base > 1 ? fret + def.base - 1 : fret;
		return OPEN_MIDI[s] + at;
	});
}
