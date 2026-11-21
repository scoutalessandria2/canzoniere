<script lang="ts">
	// The capo table read backwards: you know the chord you need to hear, the
	// component finds a capo position where that chord becomes an open shape.
	import ChordDiagram from '@canzoniere/shared/ChordDiagram.svelte';
	import { transposeChord } from '@canzoniere/shared/chords';
	import { chordVoicing, voicingMidi } from '#lib/harmony.js';
	import { audioSupported, playStrum } from '@canzoniere/shared/audio';

	const ROOTS = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];

	// shapes that need no barré: everything else is what we are trying to avoid
	const OPEN_SHAPES = ['Do', 'Re', 'Mi', 'Sol', 'La', 'Rem', 'Mim', 'Lam'];
	const MAX_CAPO = 7;

	let root = $state('Si');
	let minor = $state(false);

	const target = $derived(root + (minor ? 'm' : ''));
	const alreadyOpen = $derived(OPEN_SHAPES.includes(target));

	interface Option {
		capo: number;
		shape: string;
	}

	const options = $derived.by(() => {
		const out: Option[] = [];
		for (let capo = 1; capo <= MAX_CAPO; capo++) {
			const shape = transposeChord(target, -capo);
			if (OPEN_SHAPES.includes(shape)) out.push({ capo, shape });
		}
		return out;
	});

	function hear(shape: string) {
		const voicing = chordVoicing(shape);
		if (voicing) playStrum(voicingMidi(voicing));
	}
</script>

<div class="finder">
	<div class="picker">
		<span class="picker-label" id="capo-root">Vuoi sentire</span>
		<div class="chips" role="group" aria-labelledby="capo-root">
			{#each ROOTS as r (r)}
				<button class="chip" class:on={root === r} aria-pressed={root === r} onclick={() => (root = r)}>
					{r}
				</button>
			{/each}
		</div>
	</div>
	<div class="picker">
		<span class="picker-label" id="capo-quality">Tipo</span>
		<div class="chips" role="group" aria-labelledby="capo-quality">
			<button class="chip" class:on={!minor} aria-pressed={!minor} onclick={() => (minor = false)}>
				maggiore
			</button>
			<button class="chip" class:on={minor} aria-pressed={minor} onclick={() => (minor = true)}>
				minore
			</button>
		</div>
	</div>

	{#if alreadyOpen}
		<p class="verdict">
			<strong>{target}</strong> è già una posizione aperta: niente capo, niente barrè.
		</p>
		<div class="shapes">
			<figure>
				<ChordDiagram name={target} scale={2.2} />
				<figcaption>{target} senza capo</figcaption>
			</figure>
		</div>
	{:else if options.length === 0}
		<p class="verdict">
			Per <strong>{target}</strong> non c'è un capo entro il {MAX_CAPO}º tasto che lo trasformi in
			una posizione aperta. Qui il barrè serve davvero, oppure si cambia tonalità al canto.
		</p>
	{:else}
		<p class="verdict">
			Per sentire un <strong>{target}</strong> senza barrè:
		</p>
		<div class="shapes">
			{#each options as o (o.capo)}
				<figure>
					<ChordDiagram name={o.shape} scale={2} />
					<figcaption>
						capo al {o.capo}º, posizione di <strong>{o.shape}</strong>
						{#if audioSupported()}
							<button
								class="play"
								onclick={() => hear(o.shape)}
								aria-label="Ascolta la posizione di {o.shape}"
							>
								▶
							</button>
						{/if}
					</figcaption>
				</figure>
			{/each}
		</div>
		<p class="hint">
			L'ascolto fa sentire la posizione senza capo, cioè un {options[0].shape}: con la pinza al
			{options[0].capo}º tasto le stesse dita danno il {target}. Se suoni con altri, il capo va messo
			da tutti allo stesso tasto, altrimenti le tonalità non coincidono.
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
		min-width: 84px;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}

	.chip {
		font: inherit;
		font-size: var(--text-md);
		padding: var(--space-1) var(--space-3);
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

	.verdict {
		margin: var(--space-4) 0 var(--space-3);
	}

	.shapes {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--space-3) var(--space-8);
		margin-bottom: var(--space-4);
	}

	.shapes figure {
		margin: 0;
		text-align: center;
		max-width: 150px;
	}

	.shapes figcaption {
		font-size: var(--text-xs);
		color: var(--muted);
		margin-top: 2px;
	}

	.play {
		font: inherit;
		font-size: var(--text-xs);
		line-height: 1;
		padding: 3px var(--space-2);
		margin-left: 3px;
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
