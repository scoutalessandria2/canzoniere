<script lang="ts">
	// A strumming pattern as a row of slots, one per subdivision of the bar's
	// beats, grouped by beat: each slot shows its stroke (↓ down, ↑ up, · rest)
	// under the count spoken over it, and a click turns it into the next stroke.
	import { cycleSlot } from '#lib/rhythm-model.js';

	let {
		pattern,
		beatsPerBar,
		slotsPerBeat,
		label,
		testid = 'pattern',
		onchange
	}: {
		pattern: string;
		beatsPerBar: number;
		slotsPerBeat: number;
		label: string;
		testid?: string; // the slots are `<testid>-slot-<i>`
		onchange: (pattern: string) => void;
	} = $props();

	const ARROWS: Record<string, string> = { D: '↓', U: '↑', '.': '·' };
	const NAMES: Record<string, string> = { D: 'giù', U: 'su', '.': 'pausa' };

	// "1 e 2 e" on two slots per beat, "1 e & a" on four, and every slot
	// numbered on three (compound meters: 6/8 is counted 1 2 3 4 5 6).
	function count(slot: number): string {
		if (slotsPerBeat === 3) return String(slot + 1);
		const sub = slot % slotsPerBeat;
		if (sub === 0) return String(Math.floor(slot / slotsPerBeat) + 1);
		return slotsPerBeat === 2 ? 'e' : (['e', '&', 'a'][sub - 1] ?? '');
	}

	const beats = $derived(
		Array.from({ length: beatsPerBar }, (_, b) =>
			Array.from({ length: slotsPerBeat }, (_, j) => b * slotsPerBeat + j)
		)
	);
</script>

<div class="pattern" role="group" aria-label={label} data-testid={testid}>
	<span class="label">{label}</span>
	<div class="beats">
		{#each beats as slots, b (b)}
			<div class="beat">
				{#each slots as slot (slot)}
					{@const stroke = pattern[slot] ?? '.'}
					<div class="slot">
						<span class="count" data-testid="pattern-count">{count(slot)}</span>
						<button
							type="button"
							class="stroke"
							class:rest={stroke === '.'}
							onclick={() => onchange(cycleSlot(pattern, slot))}
							title="Clic: giù → su → pausa"
							aria-label="{count(slot)}: {NAMES[stroke] ?? NAMES['.']}"
							data-testid="{testid}-slot-{slot}"
						>
							{ARROWS[stroke] ?? ARROWS['.']}
						</button>
					</div>
				{/each}
			</div>
		{/each}
	</div>
</div>

<style>
	.pattern {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3) var(--space-5);
	}
	.label {
		min-width: 5.5rem;
		font-size: var(--text-sm);
		color: var(--muted);
		padding-bottom: var(--space-3);
	}
	.beats {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
	}
	.beat {
		display: flex;
		gap: var(--space-1);
		padding: var(--space-1);
		border-radius: var(--radius-md);
		background: var(--surface-alt);
	}
	.slot {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-1);
	}
	.count {
		font-size: var(--text-xs);
		color: var(--muted);
	}
	.stroke {
		width: 2.25rem;
		height: 2.25rem;
		border: 1px solid var(--control-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
		font-size: var(--text-3xl);
		line-height: 1;
		padding: 0;
		cursor: pointer;
	}
	.stroke:hover {
		border-color: var(--active-bg);
	}
	.stroke.rest {
		color: var(--faint);
	}
</style>
