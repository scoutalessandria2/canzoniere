<script lang="ts">
	// The song's chords in reading order, laid out in bars of the teaching meter
	// by their durations: each chord with what is sung on it and its length in
	// beats, changed with − and + or typed. A chord longer than the room left in
	// its bar goes on in the next one, where it shows faded.
	import type { BarSegment } from '#lib/rhythm-model.js';
	import Icon from './Icon.svelte';

	let {
		bars,
		chords,
		durations,
		estimated,
		max,
		current,
		seekable,
		onseek,
		onduration,
		onconfirm
	}: {
		bars: BarSegment[][];
		chords: { name: string; lyric: string }[]; // by chord index
		durations: number[];
		estimated: boolean[];
		max: number; // the longest duration allowed, in beats
		current: number; // the chord being played, -1 for none
		seekable: (chord: number) => boolean;
		onseek: (chord: number) => void;
		onduration: (chord: number, beats: number) => void;
		onconfirm: (chord: number) => void;
	} = $props();

	// each segment marked with whether it is where its chord starts
	const rows = $derived.by(() => {
		let previous = -1;
		return bars.map((bar) =>
			bar.map((segment) => {
				const first = segment.chord !== previous;
				previous = segment.chord;
				return { ...segment, first };
			})
		);
	});

	// a typed duration, kept within 1 and `max` whole beats
	function typed(chord: number, input: HTMLInputElement) {
		const value = Math.round(Number(input.value));
		const beats = input.value.trim() === '' || !Number.isFinite(value)
			? durations[chord]
			: Math.min(max, Math.max(1, value));
		input.value = String(beats);
		if (beats !== durations[chord]) onduration(chord, beats);
	}
</script>

<ol class="bars">
	{#each rows as bar, b (b)}
		<li class="bar" data-testid="bar">
			{#each bar as segment (segment.chord)}
				{@const chord = chords[segment.chord]}
				<div
					class="segment"
					class:current={segment.chord === current}
					class:continued={!segment.first}
					style:flex-grow={segment.beats}
				>
					{#if segment.first}
						{#if seekable(segment.chord)}
							<button
								type="button"
								class="chord"
								class:current={segment.chord === current}
								onclick={() => onseek(segment.chord)}
								title="Ascolta da qui sulla registrazione"
								data-testid="chord-{segment.chord}"
							>
								<span class="name">{chord?.name ?? '?'}</span>
								<span class="lyric">{chord?.lyric ?? ''}</span>
							</button>
						{:else}
							<div
								class="chord"
								class:current={segment.chord === current}
								data-testid="chord-{segment.chord}"
							>
								<span class="name">{chord?.name ?? '?'}</span>
								<span class="lyric">{chord?.lyric ?? ''}</span>
							</div>
						{/if}
						<span class="duration">
							<button
								type="button"
								class="step"
								onclick={() => onduration(segment.chord, durations[segment.chord] - 1)}
								disabled={durations[segment.chord] <= 1}
								title="Un tempo in meno"
								aria-label="Un tempo in meno"
								data-testid="duration-minus-{segment.chord}"
							>
								<Icon name="minus" />
							</button>
							<input
								type="number"
								min="1"
								{max}
								value={durations[segment.chord]}
								onchange={(e) => typed(segment.chord, e.currentTarget)}
								aria-label="Tempi di {chord?.name ?? 'accordo'}"
								data-testid="duration-{segment.chord}"
							/>
							<button
								type="button"
								class="step"
								onclick={() => onduration(segment.chord, durations[segment.chord] + 1)}
								disabled={durations[segment.chord] >= max}
								title="Un tempo in più"
								aria-label="Un tempo in più"
								data-testid="duration-plus-{segment.chord}"
							>
								<Icon name="plus" />
							</button>
							{#if estimated[segment.chord]}
								<button
									type="button"
									class="estimated"
									onclick={() => onconfirm(segment.chord)}
									title="Durata non misurata sulla registrazione: clic per confermarla"
									data-testid="estimated-{segment.chord}"
								>
									stimata
								</button>
							{/if}
						</span>
					{:else}
						<span class="name" aria-hidden="true">{chord?.name ?? '?'}</span>
					{/if}
				</div>
			{/each}
		</li>
	{/each}
</ol>

<style>
	.bars {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: var(--space-3);
	}
	.bar {
		display: flex;
		flex-wrap: wrap;
		gap: 1px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--border);
		overflow: hidden;
	}
	.segment {
		flex-basis: 0;
		min-width: 6rem;
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		padding: var(--space-2) var(--space-3);
		background: var(--surface);
	}
	.segment.current {
		background: var(--highlight);
	}
	.segment.continued .name {
		color: var(--faint);
	}
	.chord {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
		border: none;
		background: none;
		padding: 0;
		color: inherit;
		text-align: left;
	}
	button.chord {
		cursor: pointer;
	}
	button.chord:hover .name {
		text-decoration: underline;
	}
	.name {
		color: var(--chord);
		font-weight: 700;
		font-size: var(--text-lg);
	}
	.lyric {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: var(--text-sm);
		color: var(--muted);
		min-height: 1.2em;
	}
	.duration {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-1);
		font-size: var(--text-sm);
	}
	.duration input {
		width: 2.6em;
		font: inherit;
		text-align: center;
		color: var(--text);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-xs);
		padding: 0;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.duration input::-webkit-inner-spin-button,
	.duration input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.duration input:hover,
	.duration input:focus {
		border-color: var(--control-border);
		background: var(--surface);
		outline: none;
	}
	.step {
		width: 1.5rem;
		height: 1.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-pill);
		background: var(--accent-bg);
		color: var(--accent-text);
		font-size: var(--text-md);
		padding: 0;
		cursor: pointer;
	}
	.step:hover:not(:disabled) {
		background: var(--surface-alt);
	}
	.step:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.estimated {
		border: 1px solid var(--notice-border);
		border-radius: var(--radius-pill);
		background: var(--notice-bg);
		color: var(--notice-text);
		font-size: var(--text-xs);
		padding: 0 var(--space-2);
		cursor: pointer;
	}
</style>
