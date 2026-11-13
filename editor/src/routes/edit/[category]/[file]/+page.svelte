<script lang="ts">
	import { resolve } from '$app/paths';
	import { replaceState } from '$app/navigation';
	import { parse, serialize } from '@canzoniere/shared/chordpro';
	import { decodePauses, linesFingerprint, withPauses } from '@canzoniere/shared/pauses';
	import { categoryLabel } from '@canzoniere/shared/categories';
	import { rhythmStaleness } from '@canzoniere/shared/rhythm';
	import { online } from '#lib/online.js';
	import { getPending } from '#lib/pending.svelte.js';
	import SongEditor from '#lib/components/SongEditor.svelte';

	let { data } = $props();

	// Online mode: a song already edited on this device reopens in its queued
	// version, not the bundled one. Resolved client-side (localStorage), so the
	// editor renders only once the content for the current path is decided.
	const path = $derived(`canzoni/${data.category}/${data.file}`);
	let content = $state<string | null>(null);
	let resolvedFor = $state<string | null>(null);
	// Pauses proposed from the reader (?pauses=…&fp=…): applied to the version
	// about to be edited only if its lines are the ones the reader learned on,
	// as an unsaved change (baseline = the version without them). The link is
	// consumed: the query leaves the URL, so a reload or a later save never
	// applies it again over the user's own edits.
	let pauseImport = $state<'applied' | 'stale' | null>(null);
	let baseline = $state<string | undefined>(undefined);
	$effect(() => {
		let next = (online ? getPending(path)?.content : undefined) ?? data.content;
		const url = new URL(window.location.href);
		const proposed = url.searchParams.get('pauses');
		baseline = undefined;
		if (proposed !== null) {
			const song = parse(next);
			if (url.searchParams.get('fp') === linesFingerprint(song)) {
				baseline = serialize(song);
				next = serialize(withPauses(song, decodePauses(proposed)));
				pauseImport = 'applied';
			} else {
				pauseImport = 'stale';
			}
			url.searchParams.delete('pauses');
			url.searchParams.delete('fp');
			replaceState(url, {});
		}
		content = next;
		resolvedFor = path;
	});

	const song = $derived(parse(content ?? data.content));
	const title = $derived(song.meta.title || data.file);

	// The rhythm review (local mode only), with a notice when the saved rhythm
	// data no longer fits the song. A changed chord layout outdates the
	// recording too, so only the teaching notice is shown then.
	const rhythmUrl = $derived(
		resolve(`ritmo/${encodeURIComponent(data.category)}/${encodeURIComponent(data.file)}`)
	);
	const stale = $derived(
		!online && data.saved
			? rhythmStaleness(data.saved, song, data.recordingHash)
			: { teaching: false, recording: false }
	);
</script>

<div class="head">
	<nav class="crumbs">
		<a href="{resolve('/')}">Categorie</a>
		/

		<a
			href={resolve(`c/${encodeURIComponent(data.category)}`)}
		>{categoryLabel(data.category)}</a>

		/ {title}
	</nav>
	{#if !online}
		<a href={rhythmUrl} class="btn" data-testid="rhythm-link">Ritmo</a>
	{/if}
</div>

{#if pauseImport === 'applied'}
	<p class="notice" data-testid="pause-import">
		Tempi proposti dal reader: controlla le pause e salva.
	</p>
{:else if pauseImport === 'stale'}
	<p class="notice error" data-testid="pause-import-error">
		La canzone è cambiata da quando i tempi sono stati imparati: imparali di nuovo sul reader
		aggiornato.
	</p>
{/if}

{#if stale.teaching}
	<p class="stale" data-testid="rhythm-stale-teaching">
		<a href={rhythmUrl}>Il ritmo salvato è da rifare: gli accordi sono cambiati.</a>
	</p>
{:else if stale.recording}
	<p class="stale light" data-testid="rhythm-stale-recording">
		La registrazione è cambiata: rilancia il motore per aggiornare i tempi.
	</p>
{/if}

{#if content !== null && resolvedFor === path}
	{#key data.category + '/' + data.file}
		<SongEditor
			initial={parse(content)}
			categories={data.categories}
			allTags={data.allTags}
			mode="edit"
			category={data.category}
			file={data.file}
			{baseline}
		/>
	{/key}
{/if}

<style>
	.notice {
		padding: var(--space-3) var(--space-5);
		border-radius: var(--radius-sm);
		background: var(--accent-bg);
		color: var(--text);
	}
	.notice.error {
		background: var(--danger-bg);
		color: var(--danger);
	}
	/* saved rhythm data that no longer fits the song: a warning when it has to
	   be redone, a lighter note when only the recording needs the engine again */
	.stale {
		padding: var(--space-3) var(--space-5);
		border-radius: var(--radius-sm);
		border: 1px solid var(--notice-border);
		background: var(--notice-bg);
		color: var(--notice-text);
	}
	.stale.light {
		border-color: transparent;
		background: var(--accent-bg);
		color: var(--accent-text);
		font-size: var(--text-md);
	}
	.stale a {
		color: inherit;
	}
	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-4);
		margin-bottom: var(--space-5);
	}
	.crumbs {
		font-size: var(--text-lg);
		color: var(--muted);
	}
	.crumbs a {
		color: var(--text);
	}
</style>
