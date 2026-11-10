// Plays a song's cached recording together with the synthesized clicks and
// strums of its rhythm. The recording and the overlay share one clock: the
// recording starts at a time on the audio clock and every overlay sound is
// scheduled relative to that same time, so they stay together however long the
// song runs. Sounds are scheduled a little ahead by a timer (setTimeout alone
// is far too jittery for a rhythm), as the reader's StrumTrainer does.

import { audioContext, now, playClick, playStrum } from '@canzoniere/shared/audio';
import { chordMidi } from '@canzoniere/shared/diagrams';
import type { PlayEvent } from './rhythm-model';

const LOOKAHEAD = 0.14; // how far ahead sounds are scheduled, in seconds
const PUMP_MS = 25;
const START_DELAY = 0.06; // between the call to play and the first sound, so scheduling is never late
const STALE = 0.05; // an event this far in the past is dropped instead of played in a burst
const TAIL = 0.3; // without a recording, the playback ends this long after the last event

export interface PlayOptions {
	from: number; // seconds into the song to start at
	recording: boolean; // play the recording itself
	click: boolean; // play the clicks
	strum: boolean; // play the strums
	chords: string[]; // the song's chords by index, as `PlayEvent.chord` refers to them
}

export interface RhythmPlayer {
	load(url: string): Promise<void>;
	play(events: PlayEvent[], opts: PlayOptions): void;
	stop(): void;
	/** Seconds into the song: where playback is while it plays, where it stopped otherwise. */
	position(): number;
	playing(): boolean;
}

export function createPlayer(): RhythmPlayer {
	let buffer: AudioBuffer | null = null;
	let loadId = 0;

	let isPlaying = false;
	let source: AudioBufferSourceNode | null = null;
	let pump: ReturnType<typeof setInterval> | undefined;
	// the audio-clock time at which the song's second 0 falls, even when playback starts later in it
	let origin = 0;
	let resumedAt = 0; // where in the song playback started
	let stoppedAt = 0;

	async function load(url: string): Promise<void> {
		const id = ++loadId;
		const ctx = audioContext();
		if (!ctx) throw new Error('Questo browser non riproduce audio.');
		const res = await fetch(url);
		if (!res.ok) throw new Error('Impossibile caricare la registrazione.');
		const decoded = await ctx.decodeAudioData(await res.arrayBuffer());
		// a later load wins, whichever finishes last
		if (id === loadId) buffer = decoded;
	}

	function position(): number {
		if (!isPlaying) return stoppedAt;
		return Math.max(resumedAt, now() - origin);
	}

	function stop() {
		if (isPlaying) stoppedAt = position();
		isPlaying = false;
		clearInterval(pump);
		pump = undefined;
		if (source) {
			source.onended = null;
			try {
				source.stop();
			} catch {
				// a source that never started cannot be stopped
			}
			source.disconnect();
			source = null;
		}
	}

	function play(events: PlayEvent[], opts: PlayOptions) {
		stop();
		const ctx = audioContext();
		if (!ctx) return;
		const from = Math.max(0, opts.from);
		const startAt = now() + START_DELAY;
		origin = startAt - from;
		resumedAt = from;
		stoppedAt = from;
		isPlaying = true;

		if (opts.recording && buffer) {
			const node = ctx.createBufferSource();
			node.buffer = buffer;
			node.connect(ctx.destination);
			node.onended = stop;
			node.start(startAt, Math.min(from, buffer.duration));
			source = node;
		}

		const midis = new Map<number, (number | null)[] | null>();
		function shape(chord: number): (number | null)[] | null {
			if (!midis.has(chord)) midis.set(chord, chordMidi(opts.chords[chord] ?? ''));
			return midis.get(chord) ?? null;
		}

		let next = events.findIndex((e) => e.at >= from);
		if (next < 0) next = events.length;
		const lastAt = events.length > 0 ? events[events.length - 1].at : from;

		function schedule() {
			const t = now();
			while (next < events.length && origin + events[next].at < t + LOOKAHEAD) {
				const e = events[next++];
				const at = origin + e.at;
				if (at < t - STALE) continue;
				if (e.kind === 'click') {
					if (opts.click) playClick(e.accent, at);
				} else if (opts.strum && e.chord >= 0) {
					const midi = shape(e.chord);
					if (midi) playStrum(midi, e.down, at);
				}
			}
			// with a recording, its end stops the playback
			if (!source && next >= events.length && t > origin + lastAt + TAIL) stop();
		}

		schedule();
		if (isPlaying) pump = setInterval(schedule, PUMP_MS);
	}

	return { load, play, stop, position, playing: () => isPlaying };
}
