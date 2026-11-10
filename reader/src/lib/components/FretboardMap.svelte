<script lang="ts">
	import { midiAt, noteAt, STRING_NAMES } from '#lib/harmony.js';
	import { audioSupported, playNote } from '@canzoniere/shared/audio';

	interface Props {
		/** Fret to mark on each string, from the 6ª to the 1ª: -1 mutes the string. */
		highlight?: number[];
		/** How many frets to show after the open string. */
		frets?: number;
		/** Make the cells playable: a tap sounds the note and keeps it selected. */
		interactive?: boolean;
	}

	let { highlight, frets = 4, interactive = false }: Props = $props();

	const columns = $derived(Array.from({ length: frets + 1 }, (_, f) => f));
	// same order as the diagrams: the 6ª first, the 1ª last
	const rows = [0, 1, 2, 3, 4, 5];

	let picked = $state<{ string: number; fret: number } | null>(null);

	function pick(s: number, fret: number) {
		picked = { string: s, fret };
		playNote(midiAt(s, fret), { duration: 2 });
	}
</script>

<div class="scroller">
	<table>
		<thead>
			<tr>
				<th scope="col" class="corner">corda</th>
				{#each columns as f (f)}
					<th scope="col">{f === 0 ? 'vuoto' : `${f}º`}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each rows as s (s)}
				<tr class:muted={highlight?.[s] === -1}>
					<th scope="row">
						<span class="num">{6 - s}ª</span>
						<span class="who">{STRING_NAMES[s]}</span>
					</th>
					{#each columns as f (f)}
						<td
							class:on={highlight?.[s] === f}
							class:picked={picked?.string === s && picked?.fret === f}
							class:playable={interactive}
						>
							{#if interactive}
								<button onclick={() => pick(s, f)}>{noteAt(s, f)}</button>
							{:else}
								{noteAt(s, f)}
							{/if}
						</td>
					{/each}
				</tr>
			{/each}
		</tbody>
	</table>
</div>

{#if interactive}
	<p class="readout" aria-live="polite">
		{#if picked}
			{6 - picked.string}ª corda ({STRING_NAMES[picked.string]})
			{#if picked.fret === 0}a vuoto{:else}al {picked.fret}º tasto{/if}: suona un
			<strong>{noteAt(picked.string, picked.fret)}</strong>.
		{:else if audioSupported()}
			Tocca una casella per sentire la nota che esce da quella corda a quel tasto.
		{:else}
			Questo browser non riesce a generare suoni: resta la tabella delle note.
		{/if}
	</p>
{/if}

<style>
	.scroller {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
		margin-bottom: var(--space-5);
	}

	table {
		border-collapse: collapse;
		font-size: var(--text-sm);
		width: 100%;
		min-width: 300px;
		max-width: 520px;
	}

	th,
	td {
		border: 1px solid var(--border);
		padding: var(--space-1) var(--space-1);
		text-align: center;
		white-space: nowrap;
	}

	thead th {
		font-size: var(--text-xs);
		font-weight: 600;
		color: var(--muted);
		border: none;
		padding-bottom: 3px;
	}

	tbody th {
		text-align: left;
		font-weight: 600;
		border-left: none;
	}

	.corner {
		text-align: left;
	}

	.num {
		margin-right: var(--space-1);
	}

	.who {
		font-weight: 400;
		color: var(--muted);
	}

	td.on {
		background: var(--active-bg);
		color: var(--active-text);
		font-weight: 700;
	}

	td.playable {
		padding: 0;
	}

	td button {
		font: inherit;
		font-size: var(--text-sm);
		display: block;
		width: 100%;
		padding: var(--space-2) var(--space-1);
		border: none;
		background: none;
		color: inherit;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	td.picked {
		background: var(--active-bg);
		color: var(--active-text);
		font-weight: 700;
	}

	tr.muted th,
	tr.muted td {
		color: var(--faint);
	}

	tr.muted th::after {
		content: ' ✕';
		color: var(--faint);
	}

	.readout {
		margin: 0 0 var(--space-4);
		font-size: var(--text-sm);
		color: var(--muted);
	}

	.readout strong {
		color: var(--chord);
	}
</style>
