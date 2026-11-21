import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	globalSetup: './e2e/global-setup.ts',
	timeout: 30_000,
	use: {
		baseURL: 'http://localhost:5174'
	},
	webServer: {
		command: 'npm run dev -- --port 5174 --strictPort',
		port: 5174,
		reuseExistingServer: false,
		timeout: 120_000,
		env: {
			SONGS_DIR: 'e2e/.tmp-songs',
			SONGBOOKS_DIR: 'e2e/.tmp-songbooks',
			RHYTHM_CACHE_DIR: 'e2e/.tmp-rhythm-cache',
			RECORDINGS_DIR: 'e2e/.tmp-recordings'
		}
	}
});
