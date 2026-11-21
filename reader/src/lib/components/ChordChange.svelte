<script lang="ts">
	// Two chords side by side and what the left hand actually does to go from one
	// to the other: which fingers stay down (the pivot), which slide, which come
	// off. All of it is derived from the diagrams, so it matches the pictures.
	import ChordDiagram from '@canzoniere/shared/ChordDiagram.svelte';
	import {
		chordVoicing,
		moveSentence,
		stringList,
		voicingMidi,
		voicingMoves,
		type StringMove
	} from '#lib/harmony.js';
	import { audioSupported, now, playStrum } from '@canzoniere/shared/audio';

	interface Props {
		// Which chords the pickers offer and where they start: the primer shows
		// the common open chords, a song's study panel only its own chords.
		chords?: string[];
		initialFrom?: string;
		initialTo?: string;
	}

	// the open chords that show up most often in the songbook
	const COMMON = [
		'Do',
		'Re',
		'Rem',
		'Mi',
		'Mim',
		'Fa',
		'Sol',
		'La',
		'Lam',
		'Sim',
		'Do7',
		'Re7',
		'Mi7',
		'Sol7',
		'La7',
		'Si7'
	];

	let { chords = COMMON, initialFrom = 'Lam', initialTo = 'Do' }: Props = $props();

	// svelte-ignore state_referenced_locally
	let from = $state(initialFrom);
	// svelte-ignore state_referenced_locally
	let to = $state(initialTo);

	// A new pair arriving from the parent (another change picked in the study
	// panel) replaces the local selection.
	$effect(() => {
		from = initialFrom;
		to = initialTo;
	});

	const fromVoicing = $derived(chordVoicing(from));
	const toVoicing = $derived(chordVoicing(to));
	const moves = $derived(
		fromVoicing && toVoicing ? voicingMoves(fromVoicing, toVoicing) : ([] as StringMove[])
	);

	const pivots = $derived(moves.filter((m) => m.kind === 'still'));
	const changes = $derived(moves.filter((m) => m.kind !== 'still' && m.kind !== 'open'));

	function hear(which: 'from' | 'to') {
		const voicing = which === 'from' ? fromVoicing : toVoicing;
		if (voicing) playStrum(voicingMidi(voicing));
	}

	function hearBoth() {
		if (!fromVoicing || !toVoicing) return;
		playStrum(voicingMidi(fromVoicing));
		// the second chord is scheduled on the audio clock, which exists now that
		// the first strum has created the context
		playStrum(voicingMidi(toVoicing), true, now() + 1.3);
	}
</script>

<div class="change">
	<div class="picker">
		<span class="picker-label" id="change-from">Parti da</span>
		<div class="chips" role="group" aria-labelledby="change-from">
			{#each chords as c (c)}
				<button class="chip" class:on={from === c} aria-pressed={from === c} onclick={() => (from = c)}>
					{c}
				</button>
			{/each}
		</div>
	</div>
	<div class="picker">
		<span class="picker-label" id="change-to">Vai su</span>
		<div class="chips" role="group" aria-labelledby="change-to">
			{#each chords as c (c)}
				<button class="chip" class:on={to === c} aria-pressed={to === c} onclick={() => (to = c)}>
					{c}
				</button>
			{/each}
		</div>
	</div>

	<div class="shapes">
		<figure>
			<ChordDiagram name={from} scale={2.2} />
			{#if audioSupported()}
				<figcaption>
					<button class="play" onclick={() => hear('from')} aria-label="Ascolta {from}">
						▶ ascolta
					</button>
				</figcaption>
			{/if}
		</figure>
		<div class="arrow" aria-hidden="true">➜</div>
		<figure>
			<ChordDiagram name={to} scale={2.2} />
			{#if audioSupported()}
				<figcaption>
					<button class="play" onclick={() => hear('to')} aria-label="Ascolta {to}">
						▶ ascolta
					</button>
				</figcaption>
			{/if}
		</figure>
	</div>

	{#if audioSupported() && fromVoicing && toVoicing && from !== to}
		<p class="listen">
			<button class="wide" onclick={hearBoth}>Ascolta il passaggio {from} → {to}</button>
		</p>
	{/if}

	{#if !fromVoicing || !toVoicing}
		<p class="hint">Per uno di questi due accordi non c'è un diagramma nel canzoniere.</p>
	{:else if from === to}
		<p class="hint">Scegli due accordi diversi per vedere cosa si muove.</p>
	{:else}
		{#if pivots.length > 0}
			<p class="pivot">
				<strong>Dita che restano ferme</strong>: {stringList(pivots.map((m) => m.string))}. Lascia
				giù quelle e muovi solo le altre: è il trucco per cambiare accordo a tempo.
			</p>
		{:else}
			<p class="pivot">
				<strong>Nessun dito resta fermo</strong>: qui la mano si stacca e si riforma. Conviene
				provare il passaggio molto lento, guardando dove va prima il dito più importante.
			</p>
		{/if}
		<ul class="moves">
			{#each changes as m (m.string)}
				<li>{moveSentence(m, to)}</li>
			{/each}
		</ul>
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

	.shapes {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: center;
		gap: var(--space-1) var(--space-7);
		margin: var(--space-4) 0;
	}

	.shapes figure {
		margin: 0;
		text-align: center;
		max-width: 140px;
	}

	.shapes figcaption {
		font-size: var(--text-sm);
		font-weight: 600;
		margin-top: 2px;
	}

	.play {
		font: inherit;
		font-size: var(--text-xs);
		line-height: 1;
		padding: 3px var(--space-2);
		margin-left: var(--space-1);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
	}

	.arrow {
		font-size: var(--text-3xl);
		color: var(--muted);
	}

	.listen {
		margin: 0 0 var(--space-4);
		text-align: center;
	}

	.wide {
		font: inherit;
		font-size: var(--text-md);
		padding: var(--space-2) var(--space-6);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
	}

	.pivot {
		margin: 0 0 var(--space-3);
	}

	.moves {
		margin: 0;
		padding-left: var(--space-8);
	}

	.moves li {
		margin-bottom: var(--space-1);
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
</style>
