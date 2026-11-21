<script lang="ts">
	// The lesson for one chord, opened from a chord tapped in a song: diagram,
	// finger-by-finger steps, the sound, the microphone check and the switch that
	// adds it to "the chords I can play". It is the bridge from any song to the
	// guitar primer, so it repeats nothing the primer has: it links to it.
	import { fade, fly } from 'svelte/transition';
	import { resolve } from '$app/paths';
	import ChordDiagram from '@canzoniere/shared/ChordDiagram.svelte';
	import ChordChecker from '#lib/components/ChordChecker.svelte';
	import { chordTutorial } from '#lib/chord-tutorial.js';
	import { audioSupported, playStrum } from '@canzoniere/shared/audio';
	import { chordVoicing, voicingMidi } from '#lib/harmony.js';

	interface Props {
		chord: string;
		known: boolean;
		onknown: (known: boolean) => void;
		onclose: () => void;
	}

	let { chord, known, onknown, onclose }: Props = $props();

	const tutorial = $derived(chordTutorial(chord));
	const voicing = $derived(chordVoicing(chord));

	function hear() {
		if (voicing) playStrum(voicingMidi(voicing));
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}
</script>

<svelte:window onkeydown={onKeydown}></svelte:window>

<button
	class="overlay"
	onclick={onclose}
	aria-label="Chiudi la scheda dell'accordo"
	tabindex="-1"
	transition:fade={{ duration: 150 }}
></button>

<div
	class="sheet"
	role="dialog"
	aria-label="Come si suona {chord}"
	transition:fly={{ y: 320, duration: 220, opacity: 1 }}
>
	<div class="head">
		<strong>{chord}</strong>
		{#if known}<span class="badge">già tuo</span>{/if}
		<button class="close" onclick={onclose} aria-label="Chiudi">✕</button>
	</div>

	<div class="body">
		<div class="figure">
			<ChordDiagram name={chord} scale={2.6} />
			{#if audioSupported() && voicing}
				<button class="hear" onclick={hear}>🔊 Ascolta</button>
			{/if}
		</div>

		{#if tutorial}
			<div class="howto">
				<ol>
					{#each tutorial.steps as step, i (i)}
						<li>{step}</li>
					{/each}
				</ol>
				{#if tutorial.open.length > 0}
					<p class="strings">Lascia suonare a vuoto: {tutorial.open.join(', ')}.</p>
				{/if}
				{#if tutorial.muted.length > 0}
					<p class="strings">Non suonare: {tutorial.muted.join(', ')}.</p>
				{/if}
			</div>
		{:else}
			<p class="howto">Per questo accordo non c'è un diagramma nel canzoniere.</p>
		{/if}
	</div>

	<div class="actions">
		<button
			class="learned"
			class:on={known}
			onclick={() => onknown(!known)}
			aria-pressed={known}
		>{known ? '✓ Lo so fare' : 'Lo so fare'}</button>

		<ChordChecker chord={chord} />
	</div>

	<p class="more">
		<a href={resolve(`impara/`)} onclick={onclose}>🎓 Impara la chitarra</a>
		<a href={resolve(`accordi/`)} onclick={onclose}>🎸 I miei accordi</a>
	</p>
</div>

<style>
	.overlay {
		position: fixed;
		inset: 0;
		background: var(--overlay);
		border: none;
		padding: 0;
		z-index: 60;
	}

	/* Sheet from the bottom, rounded on top, the song stays visible behind it. */
	.sheet {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 61;
		max-height: 88vh;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		background: var(--bg);
		color: var(--text);
		border-radius: var(--radius-xl) var(--radius-xl) 0 0;
		box-shadow: 0 -4px 32px var(--shadow);
		padding: var(--space-7) var(--space-7) calc(env(safe-area-inset-bottom) + var(--space-7));
		box-sizing: border-box;
	}

	.head {
		display: flex;
		align-items: baseline;
		gap: var(--space-4);
	}

	.head strong {
		font-size: var(--text-3xl);
	}

	.badge {
		font-size: var(--text-xs);
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--muted);
	}

	.close {
		margin-left: auto;
		font: inherit;
		font-size: var(--text-xl);
		background: none;
		border: none;
		color: var(--muted);
		padding: 2px var(--space-2);
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.body {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--space-4) var(--space-8);
		margin-top: var(--space-5);
	}

	.figure {
		flex: 0 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}

	.hear {
		font: inherit;
		font-size: var(--text-md);
		padding: var(--space-2) var(--space-5);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-pill);
		background: transparent;
		color: inherit;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.hear:active {
		background: var(--active-bg);
		border-color: var(--active-bg);
		color: var(--active-text);
	}

	.howto {
		flex: 1 1 220px;
		font-size: var(--text-md);
	}

	.howto ol {
		margin: 0;
		padding-left: var(--space-8);
	}

	.howto li {
		margin-bottom: var(--space-2);
	}

	.strings {
		margin: var(--space-3) 0 0;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-3) var(--space-5);
		margin-top: var(--space-6);
	}

	.learned {
		font: inherit;
		font-size: var(--text-md);
		font-weight: 500;
		padding: var(--space-3) var(--space-6);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-pill);
		background: transparent;
		color: inherit;
		cursor: pointer;
		-webkit-tap-highlight-color: transparent;
	}

	.learned.on {
		background: var(--active-bg);
		border-color: var(--active-bg);
		color: var(--active-text);
	}

	.more {
		display: flex;
		gap: var(--space-7);
		margin: var(--space-7) 0 0;
		font-size: var(--text-md);
	}
</style>
