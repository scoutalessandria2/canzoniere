# AGENTS.md

Detailed project architecture is described in [ARCHITECTURE.md](ARCHITECTURE.md).

## Repository layout

- `canzoni/<category>/*.cho` — the songs, in ChordPro format. Categories are the directories under `canzoni/`; they are managed from the editor (create/rename/delete) and the historical set is `branco`, `canti_scout`, `chiesa`, `clan`, `reparto`, `varie`. Every song carries a `{tag:...}` directive that mirrors its category label (e.g. `canti_scout` → `{tag:Canti scout}`); the PDF table of contents groups songs by this tag. A song can also carry free-form search tags, one `{x_tag:...}` directive per tag (e.g. `{x_tag:omelia}`), edited from the song metadata form and searchable in the reader as `#omelia`. A song can also carry autoscroll pauses, one `{x_pause:N}` line right after the line the reader's scroll holds on for N seconds (1–60); the PDF tools ignore them.
- `canzonieri/*.txt` — event songbooks: one song per line as a path relative to `canzoni/` (e.g. `chiesa/tu_sei.cho`), `#` lines are comments, order matters.
- `backend/` — Go HTTP service (deployed on Cloud Run, GCP project `canzoniere-506115`) that proxies the public site to the GitHub API without exposing tokens: `POST /api/songs` turns an edited song into a branch + commit + pull request, `POST /api/suggestions` opens an issue. No database; abuse control via in-memory rate limiting and optional Cloudflare Turnstile. Plain `net/http`, no external deps. Run: `cd backend && GITHUB_TOKEN=... go run .`; tests: `go test ./...`. Deploy instructions in `backend/README.md`.
- `printer/` — Go tool that renders an event songbook `.txt` into a lyrics-only PDF (from the repo root: `go run ./printer -input canzonieri/<name>.txt -output canzonieri/<name>.pdf`; `-songs` defaults to `canzoni`).
- `editor/` — SvelteKit web app to manage songs and event songbooks (see below).
- `reader/` — SvelteKit static web app to read songs from a tablet/phone (search — free text and `#tag` tokens can be mixed, typing `#` opens the tag suggestions —, transpose, simplify/hide chords, per-song prefs in localStorage). Songs and songbooks are bundled at build time via `import.meta.glob`; every page is prerendered and a service worker makes it work offline. Deployed by CI to GitHub Pages under `/app/`. Run: `cd reader && npm install && npm run dev`; E2E tests (Playwright, read-only on the real songs, phone viewport): `cd reader && npm test`.
- `shared/` — modules used by both web apps: ChordPro parse/serialize (`chordpro.ts`), chord helpers (`chords.ts`: convert/sanitize/validate/simplify/transpose), category helpers (`categories.ts`), tag normalization (`tags.ts`), autoscroll pauses (`pauses.ts`: pauses keyed by timed-line index, lines fingerprint, URL encoding, device-state validation), guitar chord diagrams (`diagrams.ts` + `chord-definitions.json` + `ChordDiagram.svelte`), design tokens (`tokens.css`, see below). `shared/package.json` makes it the local package `@canzoniere/shared`, which both apps depend on (`file:../shared`) and import by name (e.g. `@canzoniere/shared/chords`).

## Design tokens

Both web apps share one design system: `shared/tokens.css`, imported by each app's root `+layout.svelte` (`import '@canzoniere/shared/tokens.css'`). It defines:

- colours by role — surfaces and text (`--bg`, `--surface`, `--surface-alt`, `--text`, `--muted`, `--faint`, `--border`, `--control-border`, `--link`), brand (`--header-bg`, `--header-text`, `--header-text-hover`, `--brand`, `--active-bg`, `--active-bg-hover`, `--active-text`, `--accent-bg`, `--accent-text`, `--highlight`, `--favorite`), music (`--chord`, `--chorus`, `--directive`, `--directive-x`, `--diagram-*`), feedback (`--danger*`, `--success*`, `--warning`, `--notice-*`) and elevation (`--shadow-sm`, `--shadow`, `--shadow-lg`, `--overlay`);
- a type scale `--text-xs` … `--text-4xl` (12–24px), a spacing scale `--space-1` … `--space-10` (4–32px), both in rem, and radii `--radius-xs` … `--radius-xl` plus `--radius-pill`, in px.

Light is the default theme. Dark is defined twice, once under `prefers-color-scheme` and once under `[data-theme='dark']` (the reader's explicit toggle; the editor follows the system only), and the two blocks must stay in sync. Styles stay local to each component and take colours, font sizes, spacings and radii from these variables only, never hardcoded, so both apps and both themes stay consistent. Exceptions: hairlines (≤ 3px), `em` sizes relative to their parent, the song sheet's dynamic font size, the camera overlay in `QrScanner` and the white quiet zone around the QR code in `QrSheet` (it must stay white to scan). A new role gets a new variable in `tokens.css`, in all three blocks.

## Web editor

The `editor/` directory contains a SvelteKit (Svelte 5) app:

- Home lists the categories as folders; each category page lists its songs with search, delete, and "move to another category" (moving rewrites the `{tag:...}` to match).
- Categories section: create, rename, reorder and delete categories (the changes hit the filesystem). Renaming a category renames its directory and rewrites the `{tag:...}` of every song inside; deleting one asks for an existing target category and moves all its songs there before removing the empty directory. The order is persisted in `canzoni/.categories.json` (categories not listed there are appended alphabetically).
- Song editor: metadata form (title, artist, columns, category — the tag is derived from the category on save, never edited directly — and free-form search tags with autocomplete on the tags already used across the repertoire) plus two synced tabs:
  - visual editor — chords as pills above the lyrics: click a character to add a chord, click a pill to edit/remove it, drag a pill to move it; line tools at the end of each row, shown on hover or focus (icons from `Icon.svelte`): edit text (Enter commits, Esc discards), pause after the line, add a line below (text, empty, comment, tab, chorus start/end, pause), delete; "Aggiungi in cima" above the first line opens the same menu. The chorus is drawn on the reader's `--chorus` rail between its "Ritornello" and "Fine ritornello" labels; an autoscroll pause is a "pausa N s" chip with −/+ (seconds also typeable, 1–60);
  - ChordPro tab — raw source with syntax highlighting (metadata, `x_` directives, chords, chorus markers, comments). Typing `{` at the start of a line opens the list of the directives (`{x` narrows it to the `x_` ones; arrows, Enter/Tab, Esc, or a click), and the choice is written already closed, with the caret on its value. Directives written wrong (unknown name, missing or invalid value, missing `}`, text after `}`, leading spaces) are underlined and listed below the text with their line, a click on it moves the caret there. The catalog and the checks live in `editor/src/lib/directives.ts`.
- Chord tools, available in both tabs: convert english chord names to latin (`Am` → `Lam`) and transpose all chords ±1 semitone.
- Canzonieri section: list/create/delete the event songbooks in `canzonieri/` and edit each one (add/remove/reorder songs, resolved to titles; saving writes the `.txt` in the format consumed by the Go tool).

Online mode (`VITE_ONLINE=1` at build time): the same app builds statically with `adapter-static` — every page is prerendered, the server loads read `../canzoni` at build time — and is deployed by CI to GitHub Pages under `/editor/`. Saving queues the song in localStorage (`#lib/pending.svelte.ts`) instead of calling the local `/api` routes; the "Invia modifiche" page (`/invia`) ships the queue to the backend's `POST /api/songs/batch` with the shared editor password (`X-Editor-Key`) and links the resulting pull request. Reopening a queued song shows the local version. The edit page also takes the pauses proposed by the reader (`?pauses=<line>:<seconds>,…&fp=<lines fingerprint>`): they replace the song's `{x_pause}` lines only when the fingerprint matches the version being edited, otherwise a notice asks to learn them again; nothing is queued until save. Management operations (categories, songbooks, move/delete) are local-only and hidden online.

Commands:

- Run: `cd editor && npm install && npm run dev` (or `make dev` from the repo root)
- E2E tests (Playwright, isolated in `editor/e2e/.tmp-songs` and `editor/e2e/.tmp-songbooks`, never touch real data): `cd editor && npm test`
- Online build: `cd editor && VITE_ONLINE=1 BASE_PATH=/editor npm run build`
- Env overrides: `SONGS_DIR` (default `../canzoni`), `SONGBOOKS_DIR` (default `../canzonieri`), `VITE_API_BASE` (backend URL in online mode).

## Web reader

Map of `reader/src/`, so the layout does not have to be rediscovered on every task. Keep it in sync when routes or lib modules are added or renamed.

Routes (`src/routes/`, every page prerendered, `trailingSlash: 'always'` from `+layout.ts`):

- `+layout.svelte` — header with the brand, `HeaderMenu`, the service-worker registration and update banner, the theme toggle (`data-theme` on `<html>`) and the import of the shared design tokens (see "Design tokens").
- `+page.svelte` — home: search box and the category list.
- `c/[category]/` — songs of one category.
- `s/[category]/[slug]/` — the song sheet (transpose, chord display, per-song prefs). The sticky bar is one row of fixed height: stopped it holds transpose, "▶ Scorri" and two bottom-panel menus, "Aa" (chords full/simple/none, text size, diagrams, copilot) and "⋯" (note, study, pause reset/proposal); scrolling it holds only stop, speed, the key shift (when not zero, read-only) and "⏱ Impara". With student mode on it also shows the tappable chords (`SongSheet`'s `onchord`) and the "Studia" entry in "⋯", which says how many chords are still to learn and opens the "Studia" panel (whose first step also offers the key shift that leaves none). The autoscroll holds on the song's pauses (`{x_pause:N}`, or the ones learned on the device); "⏱ Impara" (shown while scrolling) turns the corrections made while it scrolls (dragging back or forward, holding the page) into pauses on the line at the reading point (just below the sticky controls), "Azzera tempi" drops them and "Proponi questi tempi" (both in the "⋯" menu) opens the song in the online editor with them (`VITE_EDITOR_BASE`, default `/editor`).
- `k/[name]/` — an event songbook from `canzonieri/`, shared by link or QR (the page address itself).
- `raccolta/` — build a set list ("scaletta") in the browser and share it by link or QR.
- `accordi/` — "Cosa posso suonare": pick the chords you know, get the playable songs.
- `impara/` — "Impara la chitarra": guitar primer with diagrams, chord builder, playable fretboard map, string reference tones, chord-change explainer, capo finder and strumming metronome. The sounds are synthesized in the browser by `audio.ts`, so the page also works offline.
- `impostazioni/` — device settings; today the only one is student mode (`student.ts`).
- `crediti/` — credits and rights notice.

Modules (`src/lib/`): `data.ts` (songs and songbooks bundled via `import.meta.glob`, plus `allSongs`/`categories`/`findSong`), `search.ts`, `prefs.ts`, `favorites.ts`, `theme.ts`, `feedback.ts` (`mailto:` builder for `canzoniere@alessandriascout.it`), `share.ts` (system share sheet with clipboard fallback), `collection.ts` (set lists encoded into the URL) and `saved-collections.ts` (the sets kept on the device, both the ones built in-app and the ones received by link/QR, listed in the menu under "Scalette temporanee"), `known-chords.ts` (the chords the reader can play, plus `readiness()` and `chordChanges()` for one song), `student.ts` (the student-mode flag), `study.ts` (the step reached in the study panel, per song), `pauses.ts` (autoscroll pauses learned on the device, per song, dropped when the song's lines or official pauses change), `chord-tutorial.ts`, `chord-listener.ts` (microphone in), `audio.ts` (synthesized notes, strums and metronome click out, on a shared lazy `AudioContext`), `harmony.ts` (notes and MIDI of a chord shape, plus the string-by-string comparison of two shapes), `notes.ts`, `chroma.ts`.

Components (`src/lib/components/`): `HeaderMenu.svelte` (the `items` array is the single source of the menu entries, rendered both inline and in the drawer), `SearchBox`, `SongSheet`, `ChordBuilder`, `ChordChange`, `ChordChecker`, `ChordTutorialCard`, `ChordHelp` (the bottom sheet of a single chord, opened from a chord tapped in a song), `StudyPanel` (the three-step study path of one song), `CapoFinder`, `FretboardMap` (`interactive` makes its cells playable), `StringTuner`, `StrumTrainer`, `QrScanner` (the in-app camera that receives a set list or a songbook), `QrSheet` (the bottom sheet with the QR code of a link).

Student mode is opt-in from `impostazioni/` and off by default: every part of it is behind `loadStudentMode()`, so the reader looks unchanged until it is switched on. `ChordChange` and `StrumTrainer` take an optional `chords` list, which is how the study panel points the primer's tools at one song's chords instead of the fixed handful.

Conventions for a static page: `<svelte:head><title>… — Canzoniere Alessandria 2</title></svelte:head>`, then `<nav><a href={resolve('/')}>← Canzoniere</a></nav>`, an `<h1>`, a `<p class="intro">` and uppercase `<h2>` section headings; links always built with `resolve(...)` and static files with `asset(...)` (`$app/paths`). Styles stay local to the component and take their values from the design tokens only (see "Design tokens"). All user-facing text is in Italian.

## Build the final PDF

The final PDF is built with `make build` and is available at `canzoniere.pdf`. It is generated from the ChordPro files in the repository using the ChordPro parser with the configuration in `chordpro.json`. The PDF is formatted for A4 paper size.

The build uses ChordPro with `--transcode=latin` and the configuration in `chordpro.json`.

## CI

Everything lives under `.github/`:

- `actions/test-stack/action.yml` — composite action with the whole test suite, so the workflows below share one definition: `npm ci` plus `npm run check` on `editor` and `reader`, the editor and reader Playwright E2E tests, the reader production build, `go vet` and `go build` on `printer`, then a render of every `canzonieri/*.txt` to a throwaway PDF. Add a new check here, not in a single workflow.
- `workflows/build.yml` — on push to `main`: builds `canzoniere.pdf`, the reader and the event songbooks, generates `index.html` with `site/generate.py` and deploys `public/` to GitHub Pages.
- `workflows/ci.yml` — runs `test-stack` on every pull request against `main`.
- `workflows/update-stack.yml` — daily at 04:00 UTC (and on demand): bumps the npm dependencies of `editor` and `reader` and the Go modules of `printer`, pushes the fixed branch `chore/aggiorna-stack`, opens or updates its pull request, runs `test-stack` on that branch and squash-merges only if the suite is green. The npm bump goes through `npm-check-updates -u --peer` so the target versions stay inside the peer ranges declared by the installed packages: without it TypeScript jumps to a major that `@sveltejs/kit` and `svelte-check` reject, and `npm install` dies on ERESOLVE. The tests run inside this workflow rather than as pull request checks because a pull request opened with `GITHUB_TOKEN` does not trigger the `pull_request` event, so an auto-merge would wait forever for checks that never start.
- `dependabot.yml` — weekly bumps of the action versions, which `update-stack.yml` does not touch. The `github-actions` ecosystem only scans `.github/workflows` from `/`, so `actions/test-stack` is listed as a second directory.

The scheduled workflow needs "Allow GitHub Actions to create and approve pull requests" enabled in Settings → Actions → General, otherwise `gh pr create` fails.

## ChordPro Parser Notes

- Note names are in Latin format (`Do`, `Re`, `Mi`, `Fa`, `Sol`, `La`, `Si`).
- This setup rejects several slash chords such as `Do/Mi`, `Fa/Sol`, `Mi/Sol#`, `Sol/Si`, `Re/Fa#`, and `Fa/Do`.
- This setup also rejects some suffixes or chord variants that are not directly supported, for example `Re7sus2` and `Mi5`.
- When a chord is rejected by the current parser, the safest fix is to simplify it to a compatible base chord unless there is an explicit musical reason not to.
- If you need a non-musical text label, use ChordPro markup such as `{comment:...}` instead of square brackets.
