<script lang="ts">
	// A reference tone for each open string, synthesized on the fly: it is not a
	// tuner (it does not listen), it is the note to match by ear.
	import { onDestroy } from 'svelte';
	import { audioSupported, playNote } from '@canzoniere/shared/audio';
	import { STRING_NAMES, midiAt, noteAt } from '#lib/harmony.js';

	// index in the frets array: 0 = 6ª (Mi basso), 5 = 1ª (Mi cantino)
	const STRINGS = [0, 1, 2, 3, 4, 5];

	let sounding = $state<number | null>(null);
	let clear: ReturnType<typeof setTimeout> | undefined;
	let sequence: ReturnType<typeof setTimeout>[] = [];

	function pluck(s: number) {
		playNote(midiAt(s, 0), { duration: 2.4, gain: 0.26 });
		sounding = s;
		clearTimeout(clear);
		clear = setTimeout(() => (sounding = null), 1400);
	}

	function playAll() {
		stopSequence();
		STRINGS.forEach((s) => {
			sequence.push(setTimeout(() => pluck(s), s * 900));
		});
	}

	function stopSequence() {
		for (const t of sequence) clearTimeout(t);
		sequence = [];
	}

	onDestroy(() => {
		stopSequence();
		clearTimeout(clear);
	});
</script>

<div class="tuner">
	{#if audioSupported()}
		<div class="strings">
			{#each STRINGS as s (s)}
				<button class="string" class:on={sounding === s} onclick={() => pluck(s)}>
					<span class="num">{6 - s}ª</span>
					<span class="note">{noteAt(s, 0)}</span>
					<!-- only the two Mi need telling apart: elsewhere the name is the note -->
					{#if STRING_NAMES[s] !== noteAt(s, 0)}
						<span class="who">{STRING_NAMES[s]}</span>
					{/if}
				</button>
			{/each}
		</div>
		<button class="all" onclick={playAll}>Suona tutte, dalla 6ª alla 1ª</button>
		<p class="hint">
			Tocca una corda per sentire come dovrebbe suonare, poi gira la sua meccanica finché la tua
			corda dà la stessa nota. Il suono qui è sintetico: serve l'altezza giusta, non il timbro di
			una chitarra.
		</p>
	{:else}
		<p class="hint">Questo browser non riesce a generare suoni, quindi il riferimento non parte.</p>
	{/if}
</div>

<style>
	.strings {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		margin-bottom: var(--space-3);
	}

	.string {
		font: inherit;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		flex: 1 1 78px;
		min-width: 78px;
		/* the two Mi carry an extra label: the height is fixed so the row stays even */
		min-height: 62px;
		justify-content: center;
		padding: var(--space-2) var(--space-1);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-lg);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.string.on {
		background: var(--active-bg);
		border-color: var(--active-bg);
		color: var(--active-text);
	}

	.num {
		font-size: var(--text-xs);
		color: var(--muted);
	}

	.string.on .num,
	.string.on .who {
		color: inherit;
	}

	.note {
		font-size: var(--text-2xl);
		font-weight: 700;
	}

	.who {
		font-size: var(--text-xs);
		color: var(--muted);
	}

	.all {
		font: inherit;
		font-size: var(--text-md);
		padding: var(--space-2) var(--space-5);
		margin-bottom: var(--space-3);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-pill);
		background: var(--surface);
		color: inherit;
		cursor: pointer;
	}

	.hint {
		margin: 0;
		color: var(--muted);
		font-size: var(--text-sm);
	}
</style>
