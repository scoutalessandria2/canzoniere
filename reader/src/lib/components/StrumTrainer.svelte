<script lang="ts">
	// A metronome that also strums: the pattern is a grid of eighth notes, the
	// current one lights up while the chord and the click are played. Sounds are
	// scheduled ahead on the audio clock (setTimeout is far too jittery for a
	// rhythm), and the highlight follows that clock instead of driving it.
	import { onDestroy, untrack } from 'svelte';
	import { audioSupported, now, playClick, playStrum } from '@canzoniere/shared/audio';
	import { chordVoicing, voicingMidi } from '#lib/harmony.js';

	type Stroke = 'down' | 'up' | null;

	interface Pattern {
		id: string;
		label: string;
		say: string;
		strokes: Stroke[]; // one slot per eighth note, two per beat
	}

	const D: Stroke = 'down';
	const U: Stroke = 'up';

	const PATTERNS: Pattern[] = [
		{
			id: 'base',
			label: 'Base',
			say: 'giù, giù, giù, giù',
			strokes: [D, null, D, null, D, null, D, null]
		},
		{
			id: 'classico',
			label: 'Il classico',
			say: 'giù, giù-su, su-giù-su',
			strokes: [D, null, D, U, null, U, D, U]
		},
		{
			id: 'valzer',
			label: 'Valzer (3/4)',
			say: 'giù, su, su',
			strokes: [D, null, U, null, U, null]
		}
	];

	interface Props {
		// The primer trains on a fixed handful of chords; a song's study panel
		// passes the song's own chords and a slower starting tempo.
		chords?: string[];
		initialBpm?: number;
	}

	const COMMON = ['Lam', 'Mim', 'Do', 'Sol', 'Re'];

	let { chords = COMMON, initialBpm = 80 }: Props = $props();

	let patternId = $state('classico');
	// svelte-ignore state_referenced_locally
	let chord = $state(chords[0] ?? 'Lam');
	// svelte-ignore state_referenced_locally
	let bpm = $state(initialBpm);

	// A new chord list (another song's study panel) can leave the selection
	// pointing at a chord that is no longer on offer.
	$effect(() => {
		if (!chords.includes(untrack(() => chord))) chord = chords[0] ?? 'Lam';
	});
	let withClick = $state(true);
	let playing = $state(false);
	let slot = $state(-1);

	const pattern = $derived(PATTERNS.find((p) => p.id === patternId) ?? PATTERNS[0]);
	const midis = $derived.by(() => {
		const voicing = chordVoicing(chord);
		return voicing ? voicingMidi(voicing) : [];
	});

	// scheduling state, all in seconds on the audio clock
	let nextSlotAt = 0;
	let nextIndex = 0;
	let pump: ReturnType<typeof setInterval> | undefined;
	let frame = 0;
	let queue: { index: number; at: number }[] = [];

	const LOOKAHEAD = 0.14; // how far ahead sounds are scheduled
	const PUMP_MS = 25;

	function eighth(): number {
		return 30 / bpm; // 60 / bpm is a beat, half of it is an eighth note
	}

	function schedule() {
		const strokes = pattern.strokes;
		while (nextSlotAt < now() + LOOKAHEAD) {
			const i = nextIndex % strokes.length;
			if (withClick && i % 2 === 0) playClick(i === 0, nextSlotAt);
			const stroke = strokes[i];
			if (stroke) playStrum(midis, stroke === 'down', nextSlotAt);
			queue.push({ index: i, at: nextSlotAt });
			nextSlotAt += eighth();
			nextIndex++;
		}
	}

	function follow() {
		const t = now();
		while (queue.length > 0 && queue[0].at <= t) {
			slot = queue[0].index;
			queue.shift();
		}
		frame = requestAnimationFrame(follow);
	}

	function start() {
		// the first sound is what creates the audio context, so play it before
		// reading the clock for the schedule
		playClick(true);
		nextSlotAt = now() + 0.06;
		nextIndex = 0;
		queue = [];
		playing = true;
		schedule();
		pump = setInterval(schedule, PUMP_MS);
		frame = requestAnimationFrame(follow);
	}

	function stop() {
		playing = false;
		slot = -1;
		queue = [];
		clearInterval(pump);
		pump = undefined;
		// nothing has been scheduled during prerendering, where the frame API is absent
		if (frame) cancelAnimationFrame(frame);
		frame = 0;
	}

	function toggle() {
		if (playing) stop();
		else start();
	}

	onDestroy(stop);
</script>

<div class="trainer">
	<div class="picker">
		<span class="picker-label" id="strum-pattern">Ritmo</span>
		<div class="chips" role="group" aria-labelledby="strum-pattern">
			{#each PATTERNS as p (p.id)}
				<button
					class="chip"
					class:on={patternId === p.id}
					aria-pressed={patternId === p.id}
					onclick={() => (patternId = p.id)}
				>
					{p.label}
				</button>
			{/each}
		</div>
	</div>
	<div class="picker">
		<span class="picker-label" id="strum-chord">Accordo</span>
		<div class="chips" role="group" aria-labelledby="strum-chord">
			{#each chords as c (c)}
				<button class="chip" class:on={chord === c} aria-pressed={chord === c} onclick={() => (chord = c)}>
					{c}
				</button>
			{/each}
		</div>
	</div>

	<div class="grid" aria-hidden="true">
		{#each pattern.strokes as stroke, i (i)}
			<div class="cell" class:beat={i % 2 === 0} class:now={slot === i}>
				<span class="stroke" class:empty={stroke === null}>
					{stroke === 'down' ? '↓' : stroke === 'up' ? '↑' : '·'}
				</span>
				<span class="count">{i % 2 === 0 ? i / 2 + 1 : 'e'}</span>
			</div>
		{/each}
	</div>
	<p class="say">«{pattern.say}»</p>

	<div class="transport">
		<button class="go" class:on={playing} onclick={toggle} disabled={!audioSupported()}>
			{playing ? '■ Ferma' : '▶ Parti'}
		</button>
		<label class="speed">
			<span>{bpm} bpm</span>
			<input type="range" min="45" max="140" step="1" bind:value={bpm} aria-label="Battiti al minuto" />
		</label>
		<label class="click">
			<input type="checkbox" bind:checked={withClick} />
			<span>click</span>
		</label>
	</div>

	{#if audioSupported()}
		<p class="hint">
			Il puntino è una pennata saltata: il braccio scende e risale comunque, senza toccare le corde.
			Parti lento, anche a 50 bpm, e alza la velocità solo quando la mano va da sola.
		</p>
	{:else}
		<p class="hint">
			Questo browser non riesce a generare suoni: resta lo schema delle pennate da leggere a tempo.
		</p>
	{/if}
</div>

<style>
	.picker {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}

	.picker-label {
		font-size: var(--text-sm);
		color: var(--muted);
		min-width: 68px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chip {
		font: inherit;
		font-size: var(--text-md);
		padding: var(--space-1) var(--space-4);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.chip.on {
		background: var(--active-bg);
		border-color: var(--active-bg);
		color: var(--active-text);
	}

	.grid {
		display: flex;
		gap: var(--space-1);
		margin: var(--space-5) 0 var(--space-2);
	}

	.cell {
		flex: 1 1 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: var(--space-2) 0;
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface);
	}

	.cell.beat {
		border-color: var(--control-border);
	}

	.cell.now {
		background: var(--active-bg);
		border-color: var(--active-bg);
		color: var(--active-text);
	}

	.stroke {
		font-size: var(--text-2xl);
		font-weight: 700;
		line-height: 1;
	}

	.stroke.empty {
		color: var(--faint);
		font-weight: 400;
	}

	.cell.now .stroke.empty {
		color: inherit;
	}

	.count {
		font-size: var(--text-xs);
		color: var(--muted);
	}

	.cell.now .count {
		color: inherit;
	}

	.say {
		margin: 0 0 var(--space-4);
		font-size: var(--text-sm);
		color: var(--muted);
	}

	.transport {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4) var(--space-6);
		margin-bottom: var(--space-4);
	}

	.go {
		font: inherit;
		font-size: var(--text-md);
		min-width: 92px;
		padding: var(--space-2) var(--space-6);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
	}

	.go.on {
		background: var(--active-bg);
		border-color: var(--active-bg);
		color: var(--active-text);
	}

	.go:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.speed {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex: 1 1 180px;
		font-size: var(--text-sm);
		color: var(--muted);
	}

	.speed span {
		min-width: 62px;
	}

	.speed input {
		flex: 1 1 auto;
		min-width: 110px;
		accent-color: var(--active-bg);
	}

	.click {
		display: flex;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-sm);
		color: var(--muted);
	}

	.click input {
		accent-color: var(--active-bg);
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
</style>
