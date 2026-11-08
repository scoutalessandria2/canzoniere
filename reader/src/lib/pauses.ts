// Autoscroll pauses learned on this device, per song, persisted in
// localStorage. They are kept with the song's line layout and official pauses
// they were learned against (shared/pauses), and dropped as soon as either
// changes, so the official timing applies again.

import type { Song } from '@canzoniere/shared/chordpro';
import {
	encodePauses,
	linesFingerprint,
	resolveDevicePauses,
	samePauses,
	songPauses,
	type Pauses,
	type StoredPauses
} from '@canzoniere/shared/pauses';

function pausesKey(category: string, slug: string): string {
	return `reader:pauses:${category}/${slug}`;
}

export function loadDevicePauses(category: string, slug: string, song: Song): Pauses | null {
	if (typeof localStorage === 'undefined') return null;
	try {
		const raw = localStorage.getItem(pausesKey(category, slug));
		const pauses = resolveDevicePauses(raw ? (JSON.parse(raw) as StoredPauses) : null, song);
		if (raw && !pauses) localStorage.removeItem(pausesKey(category, slug));
		return pauses;
	} catch {
		return null;
	}
}

export function saveDevicePauses(category: string, slug: string, song: Song, pauses: Pauses): void {
	if (typeof localStorage === 'undefined') return;
	const base = songPauses(song);
	try {
		if (samePauses(pauses, base)) localStorage.removeItem(pausesKey(category, slug));
		else {
			const stored: StoredPauses = { fp: linesFingerprint(song), base, pauses };
			localStorage.setItem(pausesKey(category, slug), JSON.stringify(stored));
		}
	} catch {
		// storage full or unavailable: the pauses apply for this visit only
	}
}

export function clearDevicePauses(category: string, slug: string): void {
	if (typeof localStorage === 'undefined') return;
	try {
		localStorage.removeItem(pausesKey(category, slug));
	} catch {
		// nothing to clear
	}
}

// The online editor lives next to the reader on the same site; in dev it runs
// on its own port, set with VITE_EDITOR_BASE.
const EDITOR_BASE = import.meta.env.VITE_EDITOR_BASE ?? '/editor';

// Opens the song in the online editor with this device's pauses applied; the
// fingerprint lets the editor refuse them if its version of the song differs.
export function proposalHref(category: string, slug: string, song: Song, pauses: Pauses): string {
	return `${EDITOR_BASE}/edit/${category}/${slug}.cho?pauses=${encodePauses(pauses)}&fp=${linesFingerprint(song)}`;
}
