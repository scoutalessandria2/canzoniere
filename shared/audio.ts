// Sound synthesized in the browser, shared by the reader's learning page and the
// editor's rhythm review: plucked notes, strummed chords and the metronome
// click. Nothing is downloaded and no sample is bundled, so the pages keep
// working offline. The AudioContext is shared and created lazily, on the first
// note, which is always inside a user gesture: browsers refuse to start audio
// any other way.

const A4_MIDI = 69;
const A4_HZ = 440;

let ctx: AudioContext | null = null;

export function audioSupported(): boolean {
	return typeof window !== 'undefined' && 'AudioContext' in window;
}

/** The shared context, resumed when the browser has parked it; null where the browser has no audio. */
export function audioContext(): AudioContext | null {
	if (!audioSupported()) return null;
	ctx ??= new AudioContext();
	// Safari hands out a suspended context even inside a user gesture
	if (ctx.state === 'suspended') void ctx.resume();
	return ctx;
}

/** Seconds on the audio clock, or 0 before any sound has been played. */
export function now(): number {
	return ctx?.currentTime ?? 0;
}

function hz(midi: number): number {
	return A4_HZ * 2 ** ((midi - A4_MIDI) / 12);
}

export interface NoteOptions {
	/** When to start, on the audio clock; earlier than now means right away. */
	at?: number;
	/** Peak level, 0 to 1. */
	gain?: number;
	/** Seconds until the note has faded out. */
	duration?: number;
}

/**
 * One plucked note: a triangle for the body plus a quieter saw for the attack,
 * both through a lowpass that closes while the note decays. It is not a guitar,
 * but the pitch is exact and that is what the page needs.
 */
export function playNote(midi: number, { at = 0, gain = 0.22, duration = 1.8 }: NoteOptions = {}) {
	const c = audioContext();
	if (!c) return;
	const start = Math.max(at, c.currentTime);
	const end = start + duration;
	const freq = hz(midi);

	const amp = c.createGain();
	amp.gain.setValueAtTime(0.0001, start);
	amp.gain.linearRampToValueAtTime(gain, start + 0.006);
	amp.gain.exponentialRampToValueAtTime(0.0001, end);
	amp.connect(c.destination);

	const tone = c.createBiquadFilter();
	tone.type = 'lowpass';
	tone.Q.value = 0.8;
	tone.frequency.setValueAtTime(Math.min(freq * 9, 7000), start);
	tone.frequency.exponentialRampToValueAtTime(Math.max(freq * 2, 180), end);
	tone.connect(amp);

	for (const [type, level] of [
		['triangle', 1],
		['sawtooth', 0.35]
	] as const) {
		const osc = c.createOscillator();
		osc.type = type;
		osc.frequency.setValueAtTime(freq, start);
		const mix = c.createGain();
		mix.gain.value = level;
		osc.connect(mix).connect(tone);
		osc.start(start);
		osc.stop(end + 0.02);
	}
}

/**
 * A strum: the strings enter one after the other, from the 6ª down on a
 * downstroke and from the 1ª up on an upstroke. `midis` goes from the 6ª to the
 * 1ª, with nulls for the strings the shape mutes.
 */
export function playStrum(midis: (number | null)[], down = true, at = 0, gain = 0.13) {
	const c = audioContext();
	if (!c) return;
	const start = Math.max(at, c.currentTime);
	const sounding = midis.filter((m): m is number => m !== null);
	const order = down ? sounding : [...sounding].reverse();
	// an upstroke is faster and mostly brushes the thin strings
	const spread = down ? 0.02 : 0.014;
	order.forEach((midi, i) => {
		playNote(midi, {
			at: start + i * spread,
			gain: down ? gain : gain * 0.75,
			duration: down ? 1.5 : 1
		});
	});
}

/** Metronome click: a short blip, higher on the first beat of the bar. */
export function playClick(accent = false, at = 0) {
	const c = audioContext();
	if (!c) return;
	const start = Math.max(at, c.currentTime);
	const end = start + 0.05;

	const amp = c.createGain();
	amp.gain.setValueAtTime(accent ? 0.3 : 0.16, start);
	amp.gain.exponentialRampToValueAtTime(0.0001, end);
	amp.connect(c.destination);

	const osc = c.createOscillator();
	osc.type = 'square';
	osc.frequency.setValueAtTime(accent ? 1900 : 1250, start);
	osc.connect(amp);
	osc.start(start);
	osc.stop(end);
}
