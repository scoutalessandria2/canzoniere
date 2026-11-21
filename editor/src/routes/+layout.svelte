<script lang="ts">
	import { asset, resolve } from '$app/paths';
	import '@canzoniere/shared/tokens.css';
	import HeaderMenu from '#lib/components/HeaderMenu.svelte';

	let { children } = $props();

	// the sticky header's height, so a page's own sticky bar can stop below it
	let topbarHeight = $state(0);

	// marker for e2e tests: only interact after hydration
	$effect(() => {
		document.body.dataset.hydrated = 'true';
	});
</script>

<svelte:head>
	<link rel="icon" href="{asset('logo.png')}" />
	<title>Canzoniere Alessandria 2</title>
</svelte:head>

<header class="topbar" bind:offsetHeight={topbarHeight}>
	<a href="{resolve('/')}" class="brand">
		<img class="logo" src="{asset('logo.png')}" alt="" />
		Canzoniere Alessandria 2
	</a>
	<HeaderMenu />
</header>

<main style:--topbar-height="{topbarHeight}px">
	{@render children()}
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
		background: var(--bg);
		color: var(--text);
		/* No iOS text inflation in landscape (same as the reader). */
		-webkit-text-size-adjust: 100%;
	}
	/* Same look as the reader header (reader/src/routes/+layout.svelte). */
	.topbar {
		background: var(--header-bg);
		/* Side insets keep the brand clear of the Dynamic Island in landscape. */
		padding: calc(env(safe-area-inset-top) + var(--space-4)) calc(env(safe-area-inset-right) + var(--space-7))
			var(--space-4) calc(env(safe-area-inset-left) + var(--space-7));
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--space-9);
	}
	.brand {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		color: var(--brand);
		text-decoration: none;
		font-weight: 700;
		font-size: var(--text-xl);
		min-width: 0;
	}
	.brand .logo {
		width: 28px;
		height: 28px;
		border-radius: var(--radius-sm);
		flex-shrink: 0;
	}
	/* Phones: keep the brand on one line next to the burger. */
	@media (max-width: 640px) {
		.brand {
			font-size: var(--text-lg);
			white-space: nowrap;
		}
	}
	main {
		max-width: 1100px;
		margin: 0 auto;
		padding: var(--space-8);
	}
	:global(button) {
		font: inherit;
	}
	:global(input),
	:global(textarea),
	:global(select) {
		background: var(--surface);
		color: var(--text);
		border-color: var(--control-border);
	}
	:global(.btn) {
		display: inline-block;
		border: 1px solid var(--control-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		padding: var(--space-2) var(--space-5);
		cursor: pointer;
		text-decoration: none;
		color: inherit;
		font-size: var(--text-lg);
	}
	:global(.btn:hover) {
		background: var(--surface-alt);
	}
	:global(.btn.primary) {
		background: var(--active-bg);
		border-color: var(--active-bg);
		color: var(--active-text);
	}
	:global(.btn.primary:hover) {
		background: var(--active-bg-hover);
		border-color: var(--active-bg-hover);
	}
	:global(.btn.danger) {
		color: var(--danger);
		border-color: var(--danger-border);
	}
	:global(.btn.danger:hover) {
		background: var(--danger-bg);
	}
</style>
