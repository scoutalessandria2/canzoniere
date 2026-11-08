import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sveltekit({
			preprocess: vitePreprocess(),
			compilerOptions: { runes: true },
			adapter: adapter(),
			// Registered manually in the layout with updateViaCache: 'none' and an
			// active update check, so installed PWAs pick up new deploys.
			serviceWorker: { register: false },
			// BASE_PATH is set by CI when the app is deployed under a sub-path
			// (e.g. /app on GitHub Pages); empty for local dev.
			paths: { base: process.env.BASE_PATH ?? '' }
		})
	],
	server: {
		// Songs (../canzoni), songbooks (../canzonieri) and the shared editor
		// lib live outside the app root.
		fs: { allow: ['..'] }
	}
});
