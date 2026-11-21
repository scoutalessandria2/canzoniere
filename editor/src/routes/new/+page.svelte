<script lang="ts">
	import { onMount } from 'svelte';
	import { parse, type Song } from '@canzoniere/shared/chordpro';
	import { getPending } from '#lib/pending.svelte.js';
	import SongEditor from '#lib/components/SongEditor.svelte';

	let { data } = $props();

	const empty: Song = {
		meta: { title: '', artist: '', tags: [], labels: [], columns: null, scroll: null, youtube: null },
		lines: []
	};

	// The starting category comes from ?category=, read client-side because the
	// page is prerendered without query params. ?pending= reopens a song
	// created on this device (online mode) from the local queue.
	let category = $state<string | null>(null);
	let initial = $state<Song>(empty);
	let file = $state<string | undefined>(undefined);

	onMount(() => {
		const params = new URLSearchParams(location.search);
		const pending = params.get('pending') ? getPending(params.get('pending')!) : undefined;
		if (pending) {
			const [, pendingCategory, pendingFile] = pending.path.split('/');
			const parsed = parse(pending.content);
			initial = { meta: parsed.meta, lines: parsed.lines };
			file = pendingFile;
			category = data.categories.includes(pendingCategory) ? pendingCategory : data.categories[0];
			return;
		}
		const requested = params.get('category');
		category = requested && data.categories.includes(requested) ? requested : data.categories[0];
	});
</script>

<h2>Nuova canzone</h2>

{#if category}
	{#key file ?? ''}
		<SongEditor {initial} categories={data.categories} allTags={data.allTags} mode="new" {category} {file} />
	{/key}
{/if}
