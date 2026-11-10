<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { online } from '#lib/online.js';
	import { savePending, removePending } from '#lib/pending.svelte.js';
	import { parse, serialize, type Song, type Line } from '@canzoniere/shared/chordpro';
	import { categoryLabel } from '@canzoniere/shared/categories';
	import { PAUSE_MAX, isTimedLine } from '@canzoniere/shared/pauses';
	import { youtubeId, youtubeUrl } from '@canzoniere/shared/youtube';
	import { englishChordToLatin, simplifyChord, transposeChord } from '@canzoniere/shared/chords';
	import { slugify } from '#lib/slug.js';
	import ChordProEditor from './ChordProEditor.svelte';
	import LyricLineEditor from './LyricLineEditor.svelte';
	import LineByLineEditor from './LineByLineEditor.svelte';
	import TagInput from './TagInput.svelte';
	import Icon from './Icon.svelte';
	import ChordDiagram from '@canzoniere/shared/ChordDiagram.svelte';

	interface Props {
		initial: Song;
		categories: string[];
		allTags?: string[];
		mode: 'new' | 'edit';
		category: string;
		file?: string;
		// the content on disk when `initial` already carries unsaved changes
		// (e.g. pauses proposed by the reader), so they show as dirty
		baseline?: string;
	}

	let {
		initial,
		categories,
		allTags = [],
		mode,
		category: initialCategory,
		file,
		baseline
	}: Props = $props();

	let song: Song = $state(initial);
	let category = $state(initialCategory);
	let savedCategory = $state(initialCategory); // category the file currently lives in on disk
	let tab: 'visual' | 'raw' = $state('visual');
	let raw = $state('');
	let status = $state('');
	let saving = $state(false);

	// snapshot of the content as it lives on disk; updated on every successful save
	let savedContent = $state(baseline ?? serialize(initial));

	// the song serialized in its current state, regardless of the active tab
	let currentContent = $derived.by(() => {
		if (tab === 'raw') {
			const parsed = parse(raw);
			return serialize({ meta: parsed.meta, lines: parsed.lines });
		}
		return serialize(song);
	});

	let dirty = $derived(currentContent !== savedContent || category !== savedCategory);

	// --- undo/redo: snapshot history of the whole document ---
	type Snapshot = { content: string; category: string };
	const HISTORY_LIMIT = 50;
	let history: Snapshot[] = $state([{ content: serialize(initial), category: initialCategory }]);
	let histIdx = $state(0);
	// true while restoring a snapshot, so the capture effect ignores the change it causes
	let restoring = false;
	let captureTimer: ReturnType<typeof setTimeout> | null = null;

	let canUndo = $derived(histIdx > 0);
	let canRedo = $derived(histIdx < history.length - 1);

	function pushHistory(snap: Snapshot) {
		const top = history[histIdx];
		if (snap.content === top.content && snap.category === top.category) return;
		// drop any redo branch, then append
		let next = history.slice(0, histIdx + 1);
		next.push(snap);
		if (next.length > HISTORY_LIMIT) next = next.slice(next.length - HISTORY_LIMIT);
		history = next;
		histIdx = history.length - 1;
	}

	// commit any pending debounced capture immediately (used before structural edits/saves)
	function flushCapture() {
		if (!captureTimer) return;
		clearTimeout(captureTimer);
		captureTimer = null;
		pushHistory({ content: currentContent, category });
	}

	// debounced capture: coalesces a burst of keystrokes into a single history entry
	$effect(() => {
		const snapshot = { content: currentContent, category };
		if (restoring) {
			restoring = false;
			return;
		}
		const top = history[histIdx];
		if (snapshot.content === top.content && snapshot.category === top.category) return;
		if (captureTimer) clearTimeout(captureTimer);
		captureTimer = setTimeout(() => {
			captureTimer = null;
			pushHistory(snapshot);
		}, 400);
	});

	function restoreTo(idx: number) {
		if (idx < 0 || idx >= history.length) return;
		if (captureTimer) {
			clearTimeout(captureTimer);
			captureTimer = null;
		}
		restoring = true;
		histIdx = idx;
		const snap = history[idx];
		const parsed = parse(snap.content);
		song = { meta: parsed.meta, lines: parsed.lines };
		category = snap.category;
		if (tab === 'raw') raw = snap.content;
	}

	function undo() {
		if (canUndo) restoreTo(histIdx - 1);
	}
	function redo() {
		if (canRedo) restoreTo(histIdx + 1);
	}

	beforeNavigate(({ cancel, shallow }) => {
		if (shallow) return;

		if (dirty && !confirm('Ci sono modifiche non salvate. Vuoi davvero uscire?')) {
			cancel();
		}
	});

	// The text typed in the YouTube field while it is not a valid link; null
	// when the field shows the song's own link. Any change to the song's link
	// (an undo, a switch of tab) drops it.
	let youtubeDraft: string | null = $state(null);
	$effect(() => {
		song.meta.youtube;
		youtubeDraft = null;
	});

	function setYoutube(input: HTMLInputElement) {
		const text = input.value.trim();
		if (!text) {
			song.meta.youtube = null;
			youtubeDraft = null;
			return;
		}
		const id = youtubeId(text);
		if (id) {
			song.meta.youtube = id;
			youtubeDraft = null;
			input.value = youtubeUrl(id);
		} else {
			youtubeDraft = input.value;
		}
	}

	// The metadata form is collapsible; it starts collapsed on narrow screens
	// to leave the room to the sheet.
	let metaOpen = $state(true);

	// Phones have no hover, so the per-line tools (delete, add) are hidden
	// behind this toggle instead of crowding every line.
	let showLineTools = $state(false);

	// On screens up to an iPhone in landscape the whole-sheet editor is too
	// cramped for chord work, so the visual tab defaults to the line-by-line
	// mode; the toggle lets the user go back to the full sheet.
	let compact = $state(false);
	let lineModePref: boolean | null = $state(null);
	let lineMode = $derived(compact && (lineModePref ?? true));

	onMount(() => {
		const mq = window.matchMedia('(max-width: 950px)');
		compact = mq.matches;
		const onMq = () => compact = mq.matches;
		mq.addEventListener('change', onMq);
		// A new song needs its (required) title typed in, so the form stays open.
		if (mode === 'edit' && window.matchMedia('(max-width: 900px)').matches) metaOpen = false;

		const handler = (e: BeforeUnloadEvent) => {
			if (dirty) {
				e.preventDefault();
				e.returnValue = '';
			}
		};
		window.addEventListener('beforeunload', handler);

		const keyHandler = (e: KeyboardEvent) => {
			if (!(e.metaKey || e.ctrlKey)) return;
			const k = e.key.toLowerCase();
			if (k === 'z' && !e.shiftKey) {
				e.preventDefault();
				undo();
			} else if (k === 'z' && e.shiftKey || k === 'y') {
				e.preventDefault();
				redo();
			}
		};
		window.addEventListener('keydown', keyHandler);

		return () => {
			mq.removeEventListener('change', onMq);
			window.removeEventListener('beforeunload', handler);
			window.removeEventListener('keydown', keyHandler);
		};
	});

	// the {tag:...} directive mirrors the category (the PDF TOC groups songs by tag)
	function syncTagToCategory() {
		song.meta.tags = [categoryLabel(category)];
	}

	function switchTab(next: 'visual' | 'raw') {
		if (next === tab) return;
		if (next === 'raw') {
			syncTagToCategory();
			raw = serialize(song);
		} else {
			const parsed = parse(raw);
			song.meta = parsed.meta;
			song.lines = parsed.lines;
		}
		tab = next;
	}

	// apply a transformation to every chord of the song, in whichever tab is active
	function applyToChords(fn: (chord: string) => string) {
		flushCapture();
		if (tab === 'raw') {
			const parsed = parse(raw);
			song.meta = parsed.meta;
			song.lines = parsed.lines;
		}
		for (const line of song.lines) {
			if (line.type === 'lyric') {
				for (const c of line.chords) c.chord = fn(c.chord);
			}
		}
		if (tab === 'raw') raw = serialize(song);
	}

	// unique chords in order of first appearance, same criterion ChordPro uses
	// for the diagrams in the PDF (diagrams.sorted = false)
	let usedChords = $derived.by(() => {
		const seen = new Set<string>();
		const out: string[] = [];
		for (const line of song.lines) {
			if (line.type !== 'lyric') continue;
			for (const c of line.chords) {
				if (!c.chord || seen.has(c.chord)) continue;
				seen.add(c.chord);
				out.push(c.chord);
			}
		}
		return out;
	});

	// simplification is a display mode: pills and diagrams show the reduced
	// triads, the song (and the saved file) keeps the original chords
	let simplify = $state(false);
	let displayChord = $derived(simplify ? simplifyChord : (c: string) => c);
	let panelChords = $derived(simplify ? [...new Set(usedChords.map(simplifyChord))] : usedChords);

	function addLine(afterIdx: number | null, line: Line) {
		flushCapture();
		if (afterIdx === null) {
			song.lines.push(line);
		} else {
			song.lines.splice(afterIdx + 1, 0, line);
		}
	}

	// a new tab starts as an empty six-string staff
	const TAB_TEMPLATE = ['e|', 'B|', 'G|', 'D|', 'A|', 'E|'].map((s) => s + ('-').repeat(16) + '|').join('\n');

	// the kinds of line the add menu can insert
	const lineTypes: { label: string; testid: string; make: () => Line }[] = [
		{ label: 'Riga di testo', testid: 'add-lyric', make: () => ({ type: 'lyric', text: '', chords: [] }) },
		{ label: 'Riga vuota', testid: 'add-empty', make: () => ({ type: 'empty' }) },
		{ label: 'Commento', testid: 'add-comment', make: () => ({ type: 'comment', text: '' }) },
		{ label: 'Tablatura', testid: 'add-tab', make: () => ({ type: 'tab', text: TAB_TEMPLATE }) },
		{ label: 'Inizio ritornello', testid: 'add-chorus-start', make: () => ({ type: 'chorus_start' }) },
		{ label: 'Fine ritornello', testid: 'add-chorus-end', make: () => ({ type: 'chorus_end' }) },
		{ label: 'Pausa scorrimento', testid: 'add-pause', make: () => ({ type: 'pause', seconds: 4 }) }
	];

	// which add menu is open: a line index (insert below that line), 'top'
	// (insert before the first line) or 'end' (append)
	let openAddMenu: number | 'top' | 'end' | null = $state(null);

	// a pause holds whole seconds, 1..PAUSE_MAX, whatever is typed in the field
	function clampPause(line: Line) {
		if (line.type !== 'pause') return;
		line.seconds = Math.min(PAUSE_MAX, Math.max(1, Math.round(line.seconds) || 1));
	}

	function stepPause(line: Line, delta: number) {
		if (line.type !== 'pause') return;
		line.seconds += delta;
		clampPause(line);
	}

	// the lines between a chorus start and its end (both included) sit on the
	// chorus rail, as the reader draws them
	let inChorus = $derived.by(() => {
		let open = false;
		return song.lines.map((l) => {
			if (l.type === 'chorus_start') open = true;
			const inside = open;
			if (l.type === 'chorus_end') open = false;
			return inside;
		});
	});

	// the lyric line editors, so the line tools can open their text field
	const lyricEditors: (LyricLineEditor | undefined)[] = [];

	function deleteLine(idx: number) {
		flushCapture();
		song.lines.splice(idx, 1);
	}

	async function save() {
		if (tab === 'raw') {
			const parsed = parse(raw);
			song.meta = parsed.meta;
			song.lines = parsed.lines;
		}
		if (!song.meta.title.trim()) {
			status = 'Il titolo è obbligatorio';
			return;
		}
		syncTagToCategory();
		const content = serialize(song);
		saving = true;
		status = '';
		try {
			if (online) {
				saveToDevice(content);
				return;
			}
			if (mode === 'edit' && file) {
				const moved = category !== savedCategory;
				if (moved) {
					const res = await fetch(resolve(`api/songs/${encodeURIComponent(savedCategory)}/${encodeURIComponent(file)}`), {
						method: 'PATCH',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ category })
						}
					);
					if (!res.ok) throw new Error(await res.text());
					savedCategory = category;
				}

				const res = await fetch(resolve(`api/songs/${encodeURIComponent(category)}/${encodeURIComponent(file)}`), {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ content })
					}
				);
				if (!res.ok) throw new Error(await res.text());
				savedContent = content;
				status = 'Salvato ✓';
				if (moved) {
					await goto(resolve(`edit/${encodeURIComponent(category)}/${encodeURIComponent(file)}`));
				}
			} else {
				const newFile = slugify(song.meta.title) + '.cho';
				const res = await fetch(resolve(`api/songs`), {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ category, file: newFile, content })
				});
				if (!res.ok) throw new Error(await res.text());
				savedContent = content;
				status = 'Creato ✓';
				await goto(resolve(`edit/${encodeURIComponent(category)}/${encodeURIComponent(newFile)}`));
			}
		} catch (e) {
			status = `Errore: ${e instanceof Error ? e.message : e}`;
		} finally {
			saving = false;
		}
	}

	// Online mode: the file name of a song created on this device, frozen at
	// the first save so later title changes keep updating the same queue entry.
	let onlineNewFile: string | null = $state(file ?? null);
	// The queue entry written by the last save, so a category change on a new
	// song moves the entry instead of leaving a stale duplicate behind.
	let savedPath: string | null = $state(file ? `canzoni/${initialCategory}/${file}` : null);

	// Online mode: the song goes into the local queue; the "Invia modifiche"
	// page ships the queue to the backend.
	function saveToDevice(content: string) {
		let targetFile: string;
		if (mode === 'edit' && file) {
			targetFile = file;
		} else {
			onlineNewFile ??= slugify(song.meta.title) + '.cho';
			targetFile = onlineNewFile;
		}
		const path = `canzoni/${category}/${targetFile}`;
		if (savedPath && savedPath !== path) removePending(savedPath);
		savePending(path, song.meta.title, content, mode === 'new');
		savedPath = path;
		savedContent = content;
		savedCategory = category;
		status = 'Salvato sul dispositivo ✓ (da «Invia modifiche» arriva al canzoniere)';
	}
</script>

<svelte:window onclick={() => openAddMenu = null}></svelte:window>

<div class="meta" data-testid="meta-form">
	<button
		type="button"
		class="meta-toggle"
		onclick={() => metaOpen = !metaOpen}
		aria-expanded={metaOpen}
		data-testid="meta-toggle"
	>
		<span class="chevron" class:open={metaOpen}>▸</span>
		{#if metaOpen}
			Dettagli canzone
		{:else}
			<strong>{song.meta.title || 'Senza titolo'}</strong>
			{#if song.meta.artist}<span class="meta-summary">{song.meta.artist}</span>{/if}
		{/if}
	</button>
	{#if metaOpen}
	<label>
		Titolo
		<input bind:value={song.meta.title} data-testid="meta-title" />
	</label>
	<label>
		Artista
		<input bind:value={song.meta.artist} data-testid="meta-artist" />
	</label>
	<label>
		Colonne
		<input
			type="number"
			min="1"
			max="4"
			value={song.meta.columns ?? ''}
			oninput={(e) => {
				const v = parseInt(e.currentTarget.value, 10);
				song.meta.columns = Number.isNaN(v) ? null : v;
			}}
			data-testid="meta-columns"
		/>
	</label>
	<label title="Velocità iniziale dello scorrimento automatico nel reader (1–10). Vuoto = predefinito.">
		Scorrimento
		<input
			type="number"
			min="1"
			max="10"
			placeholder="auto"
			value={song.meta.scroll ?? ''}
			oninput={(e) => {
				const v = parseInt(e.currentTarget.value, 10);
				song.meta.scroll = Number.isNaN(v) ? null : Math.min(10, Math.max(1, v));
			}}
			data-testid="meta-scroll"
		/>
	</label>
	<label
		title={online && mode === 'edit'
			? 'Lo spostamento di categoria è disponibile solo in locale'
			: undefined}
	>
		Categoria
		<select bind:value={category} disabled={online && mode === 'edit'} data-testid="meta-category">
			{#each categories as c (c)}
				<option value={c}>{categoryLabel(c)}</option>
			{/each}
		</select>
	</label>
	<label
		class="youtube-field"
		title="Link della registrazione su YouTube (anche in forma breve o con parametri). Nel file resta solo l'id del video."
	>
		Registrazione (YouTube)
		<input
			type="url"
			placeholder="Incolla il link del video"
			value={youtubeDraft ?? (song.meta.youtube ? youtubeUrl(song.meta.youtube) : '')}
			onchange={(e) => setYoutube(e.currentTarget)}
			aria-invalid={youtubeDraft !== null}
			data-testid="meta-youtube"
		/>
		{#if youtubeDraft !== null}
			<span class="field-error" data-testid="meta-youtube-error">Link YouTube non valido</span>
		{/if}
	</label>
	<label
		class="tags-field"
		title="Tag liberi per la ricerca nel reader (es. #omelia). Suggerisce quelli già usati."
	>
		Tag
		<TagInput bind:tags={song.meta.labels} suggestions={allTags} />
	</label>
	{/if}
</div>

<div class="tabs">
	<button class:active={tab === 'visual'} onclick={() => switchTab('visual')} data-testid="tab-visual">
		Editor visuale
	</button>
	<button class:active={tab === 'raw'} onclick={() => switchTab('raw')} data-testid="tab-raw">
		ChordPro
	</button>
	<span class="history-tools">
		<button
			class="btn"
			onclick={undo}
			disabled={!canUndo}
			title="Annulla (Ctrl+Z)"
			data-testid="undo"
		>
			↶
		</button>
		<button
			class="btn"
			onclick={redo}
			disabled={!canRedo}
			title="Ripeti (Ctrl+Shift+Z)"
			data-testid="redo"
		>
			↷
		</button>
	</span>
	<span class="spacer"></span>
	<span class="chord-tools">
		Accordi:
		<button
			class="btn"
			class:toggled={simplify}
			onclick={() => simplify = !simplify}
			aria-pressed={simplify}
			title="Mostra gli accordi semplificati (triadi di base). Non modifica la canzone."
			data-testid="simplify-toggle"
		>
			Semplifica
		</button>
		<button
			class="btn"
			onclick={() => applyToChords(englishChordToLatin)}
			title="Converti gli accordi da notazione inglese (A, B, C) a latina (La, Si, Do)"
			data-testid="convert-latin"
		>
			A→La
		</button>
		<button
			class="btn"
			onclick={() => applyToChords((c) => transposeChord(c, -1))}
			title="Trasponi tutti gli accordi di un semitono in giù"
			data-testid="transpose-down"
		>
			−1
		</button>
		<button
			class="btn"
			onclick={() => applyToChords((c) => transposeChord(c, 1))}
			title="Trasponi tutti gli accordi di un semitono in su"
			data-testid="transpose-up"
		>
			+1
		</button>
	</span>
	{#if compact && tab === 'visual'}
		<button
			class="btn line-mode-toggle"
			class:toggled={lineMode}
			onclick={() => lineModePref = !lineMode}
			aria-pressed={lineMode}
			title="Inserisci gli accordi una riga alla volta"
			data-testid="line-mode-toggle"
		>
			≡ Riga per riga
		</button>
	{/if}
	<button
		class="btn line-tools-toggle"
		class:toggled={showLineTools}
		onclick={() => showLineTools = !showLineTools}
		aria-pressed={showLineTools}
		title="Mostra gli strumenti di riga (elimina, aggiungi)"
		data-testid="line-tools-toggle"
	>
		✎ Righe
	</button>
	<span class="save-tools">
		{#if dirty}
			<span class="dirty" data-testid="dirty-indicator" title="Ci sono modifiche non salvate">
				● Modifiche non salvate
			</span>
		{/if}
		<span class="status" data-testid="save-status">{status}</span>
		<button class="btn primary" onclick={save} disabled={saving || !dirty} data-testid="save">
			{mode === 'new' ? 'Crea' : 'Salva'}
		</button>
	</span>
</div>

{#snippet addMenu(afterIdx: number | null, key: number | 'top' | 'end')}
	<span class="add-menu">
		{#if key === 'top'}
			<button
				class="add-top-btn"
				onclick={(e) => {
					e.stopPropagation();
					openAddMenu = openAddMenu === key ? null : key;
				}}
				aria-expanded={openAddMenu === key}
				data-testid="add-line-top"
			>
				<Icon name="plus" /> Aggiungi in cima
			</button>
		{:else if key === 'end'}
			<button
				class="btn add-end"
				onclick={(e) => {
					e.stopPropagation();
					openAddMenu = openAddMenu === key ? null : key;
				}}
				aria-expanded={openAddMenu === key}
				data-testid="add-line-end"
			>
				<Icon name="plus" /> Aggiungi riga
			</button>
		{:else}
			<button
				class="icon-btn"
				onclick={(e) => {
					e.stopPropagation();
					openAddMenu = openAddMenu === key ? null : key;
				}}
				title="Aggiungi riga sotto"
				aria-label="Aggiungi riga sotto"
				aria-expanded={openAddMenu === key}
				data-testid="add-line-below"
			>
				<Icon name="plus" />
			</button>
		{/if}
		{#if openAddMenu === key}
			<div class="menu" class:left={typeof key !== 'number'} data-testid="add-line-menu">
				{#each lineTypes as t (t.testid)}
					<button
						onclick={() => {
							addLine(afterIdx, t.make());
							openAddMenu = null;
						}}
						data-testid={t.testid}
					>
						{t.label}
					</button>
				{/each}
			</div>
		{/if}
	</span>
{/snippet}

{#if tab === 'visual' && lineMode}
	<LineByLineEditor
		bind:song
		usedChords={usedChords}
		displayChord={displayChord}
	/>
{:else if tab === 'visual'}
	<div class="visual-layout">
		<div class="sheet" class:show-tools={showLineTools} data-testid="visual-editor">
			{#if song.lines.length === 0}
				<p class="hint">
					Nessun testo. Aggiungi righe qui sotto oppure incolla il testo nella scheda «ChordPro».
				</p>
			{/if}
			{#if song.lines.length > 0}
				<div class="add-top" class:open={openAddMenu === 'top'}>{@render addMenu(-1, 'top')}</div>
			{/if}
			{#each song.lines as line, idx (line)}
				<div class="line-wrap" class:in-chorus={inChorus[idx]}>
					<div class="line-row" class:open={openAddMenu === idx} data-testid="line-row">
						<div class="line-body">
							{#if line.type === 'lyric'}
								<LyricLineEditor
									bind:this={lyricEditors[idx]}
									bind:line={song.lines[idx] as typeof line}
									usedChords={usedChords}
									displayChord={displayChord}
								/>
							{:else if line.type === 'empty'}
								<div class="empty-line"></div>
							{:else if line.type === 'chorus_start'}
								<div class="marker">Ritornello</div>
							{:else if line.type === 'chorus_end'}
								<div class="marker">Fine ritornello</div>
							{:else if line.type === 'comment'}
								<label class="comment">
									<Icon name="comment" />
									<input bind:value={line.text} placeholder="Commento…" aria-label="Commento" />
								</label>
							{:else if line.type === 'tab'}
								<textarea
									class="tab"
									bind:value={line.text}
									rows={line.text.split('\n').length + 1}
									spellcheck="false"
									placeholder="e|-----|"
									data-testid="tab-editor"
								></textarea>
							{:else if line.type === 'pause'}
								<span
									class="pause"
									data-testid="pause-line"
									title="Lo scorrimento del reader si ferma qui"
								>
									<Icon name="pause" />
									<label>
										pausa
										<input
											type="number"
											min="1"
											max={PAUSE_MAX}
											bind:value={line.seconds}
											onchange={() => clampPause(line)}
											aria-label="Secondi di pausa"
											data-testid="pause-seconds"
										/>
										s
									</label>
									<button
										class="step"
										onclick={() => stepPause(line, -1)}
										disabled={line.seconds <= 1}
										title="Un secondo in meno"
										aria-label="Un secondo in meno"
										data-testid="pause-less"
									>
										<Icon name="minus" />
									</button>
									<button
										class="step"
										onclick={() => stepPause(line, 1)}
										disabled={line.seconds >= PAUSE_MAX}
										title="Un secondo in più"
										aria-label="Un secondo in più"
										data-testid="pause-more"
									>
										<Icon name="plus" />
									</button>
								</span>
							{:else if line.type === 'directive'}
								<code class="directive">{line.raw}</code>
							{/if}
						</div>
						<div class="line-tools">
							{#if line.type === 'lyric'}
								<button
									class="icon-btn"
									onclick={() => lyricEditors[idx]?.startTextEdit()}
									title="Modifica testo"
									aria-label="Modifica testo"
									data-testid="edit-lyric-text"
								>
									<Icon name="pencil" />
								</button>
							{/if}
							{#if isTimedLine(line) && song.lines[idx + 1]?.type !== 'pause'}
								<button
									class="icon-btn"
									onclick={() => addLine(idx, { type: 'pause', seconds: 4 })}
									title="Pausa dopo questa riga"
									aria-label="Pausa dopo questa riga"
									data-testid="add-pause-after"
								>
									<Icon name="pause" />
								</button>
							{/if}
							{@render addMenu(idx, idx)}
							<button
								class="icon-btn danger"
								onclick={() => deleteLine(idx)}
								title="Elimina riga"
								aria-label="Elimina riga"
								data-testid="delete-line"
							>
								<Icon name="trash" />
							</button>
						</div>
					</div>
				</div>
			{/each}

			<div class="add-bar">{@render addMenu(null, 'end')}</div>
		</div>

	<aside class="chords-panel" data-testid="chord-diagrams">
		<h3>Accordi</h3>
		{#if panelChords.length === 0}
			<p class="no-chords">Nessun accordo</p>
		{:else}
			{#each panelChords as chord (chord)}
				<ChordDiagram name={chord} />
			{/each}
		{/if}
	</aside>
	</div>
{:else}
	<ChordProEditor bind:value={raw} />
{/if}

<style>
	.meta {
		display: grid;
		grid-template-columns: 2.3fr 2.3fr 0.8fr 1fr 1.4fr;
		gap: var(--space-4);
		background: var(--surface);
		border-radius: var(--radius-md);
		padding: var(--space-5);
		box-shadow: 0 1px 3px var(--shadow-sm);
		margin-bottom: var(--space-5);
	}
	.meta label {
		display: flex;
		flex-direction: column;
		font-size: var(--text-xs);
		color: var(--muted);
		gap: var(--space-1);
	}
	.meta-toggle {
		grid-column: 1 / -1;
		display: flex;
		align-items: center;
		gap: var(--space-3);
		border: none;
		background: none;
		padding: 0;
		cursor: pointer;
		text-align: left;
		font-size: var(--text-sm);
		color: var(--muted);
		min-height: 1.4rem;
	}
	.meta-toggle strong {
		color: var(--text);
		font-size: var(--text-lg);
	}
	.meta-summary {
		color: var(--faint);
		font-size: var(--text-md);
	}
	.chevron {
		display: inline-block;
		transition: transform 0.15s;
		font-size: var(--text-sm);
	}
	.chevron.open {
		transform: rotate(90deg);
	}
	.tags-field,
	.youtube-field {
		grid-column: 1 / -1;
	}
	.field-error {
		color: var(--danger);
	}
	.meta input,
	.meta select {
		font-size: var(--text-lg);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-sm);
		background: var(--surface);
		color: var(--text);
	}
	.tabs {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-3);
		row-gap: var(--space-3);
		margin-bottom: var(--space-4);
	}
	.tabs > button:not(.btn) {
		border: none;
		background: none;
		padding: var(--space-3) var(--space-5);
		cursor: pointer;
		border-bottom: 2px solid transparent;
		color: var(--muted);
	}
	.tabs > button.active {
		color: var(--active-bg);
		font-weight: 600;
		border-bottom-color: var(--active-bg);
	}
	.spacer {
		flex: 1;
	}
	.history-tools {
		display: flex;
		gap: var(--space-1);
		margin-left: var(--space-3);
	}
	.history-tools button {
		font-size: var(--text-xl);
		line-height: 1;
		padding: var(--space-2) var(--space-3);
	}
	.chord-tools {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-sm);
		color: var(--muted);
		margin-right: var(--space-4);
	}
	.chord-tools .toggled {
		background: var(--active-bg);
		color: var(--active-text);
	}
	.save-tools {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		margin-left: auto;
	}
	.line-mode-toggle.toggled {
		background: var(--active-bg);
		color: var(--active-text);
	}
	/* The «Righe» toggle exists only where hover does not. */
	.line-tools-toggle {
		display: none;
	}
	@media (max-width: 600px) {
		.line-tools-toggle {
			display: inline-block;
		}
		.line-tools-toggle.toggled {
			background: var(--active-bg);
			color: var(--active-text);
		}
	}
	.status {
		font-size: var(--text-md);
		color: var(--success);
	}
	.dirty {
		font-size: var(--text-sm);
		color: var(--warning);
		font-weight: 600;
		white-space: nowrap;
	}
	.visual-layout {
		display: flex;
		gap: var(--space-5);
		align-items: flex-start;
	}
	.sheet {
		flex: 1;
		min-width: 0;
		background: var(--surface);
		border-radius: var(--radius-md);
		padding: var(--space-7) var(--space-8);
		box-shadow: 0 1px 3px var(--shadow-sm);
		overflow-x: auto;
	}
	.chords-panel {
		position: sticky;
		top: 0.5rem;
		flex-shrink: 0;
		width: 140px;
		max-height: calc(100vh - 1rem);
		overflow-y: auto;
		background: var(--surface);
		border-radius: var(--radius-md);
		padding: var(--space-5) var(--space-4);
		box-shadow: 0 1px 3px var(--shadow-sm);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--space-3);
	}
	.chords-panel h3 {
		margin: 0;
		font-size: var(--text-xs);
		color: var(--muted);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.no-chords {
		color: var(--faint);
		font-size: var(--text-sm);
		margin: 0;
	}
	.hint {
		color: var(--faint);
	}
	/* the chorus rail, as the reader draws it */
	.line-wrap.in-chorus {
		border-left: 3px solid var(--chorus);
		margin-left: var(--space-3);
		padding-left: var(--space-4);
	}
	.line-row {
		display: flex;
		align-items: flex-end;
		gap: var(--space-3);
		padding: 0 var(--space-1) 2px var(--space-3);
		border-radius: var(--radius-sm);
	}
	.line-row:hover,
	.line-row:focus-within,
	.line-row.open {
		background: var(--surface-alt);
	}
	.line-tools {
		display: flex;
		align-items: center;
		gap: 2px;
		flex-shrink: 0;
		visibility: hidden;
	}
	.line-row:hover .line-tools,
	.line-row:focus-within .line-tools,
	.line-row.open .line-tools {
		visibility: visible;
	}
	.icon-btn {
		width: 2rem;
		height: 2rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted);
		font-size: var(--text-xl);
		padding: 0;
		cursor: pointer;
	}
	.icon-btn:hover,
	.icon-btn[aria-expanded='true'] {
		background: var(--surface);
		color: var(--text);
		box-shadow: 0 1px 3px var(--shadow-sm);
	}
	.icon-btn.danger {
		color: var(--danger);
	}
	.icon-btn.danger:hover {
		background: var(--danger-bg);
	}
	.add-menu {
		position: relative;
		display: inline-flex;
	}
	/* insert before the first line: shown with the line tools */
	.add-top {
		visibility: hidden;
		margin-bottom: var(--space-2);
	}
	.sheet:hover .add-top,
	.sheet:focus-within .add-top,
	.add-top.open {
		visibility: visible;
	}
	.add-top-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		border: none;
		border-radius: var(--radius-sm);
		background: transparent;
		color: var(--muted);
		font-size: var(--text-sm);
		padding: var(--space-1) var(--space-3);
		cursor: pointer;
	}
	.add-top-btn:hover,
	.add-top-btn[aria-expanded='true'] {
		background: var(--surface-alt);
		color: var(--text);
	}
	.add-end {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
	}
	.menu {
		position: absolute;
		top: 100%;
		right: 0;
		margin-top: 2px;
		z-index: 10;
		display: flex;
		flex-direction: column;
		min-width: 9.5rem;
		padding: var(--space-1);
		background: var(--surface);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-sm);
		box-shadow: 0 2px 8px var(--shadow);
	}
	.menu button {
		border: none;
		background: none;
		border-radius: var(--radius-xs);
		cursor: pointer;
		text-align: left;
		white-space: nowrap;
		padding: var(--space-2) var(--space-4);
		font-size: var(--text-md);
		color: var(--text);
	}
	.menu.left {
		right: auto;
		left: 0;
	}
	.menu button:hover {
		background: var(--surface-alt);
	}
	.line-body {
		flex: 1;
		min-width: 0;
	}
	.empty-line {
		height: 1.2em;
	}
	.marker {
		color: var(--muted);
		font-size: var(--text-xs);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		padding: var(--space-2) 0;
	}
	.comment {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		color: var(--muted);
		font-size: var(--text-lg);
	}
	.comment input {
		flex: 1;
		min-width: 0;
		font: inherit;
		font-style: italic;
		color: inherit;
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-xs);
		padding: 0.15rem var(--space-2);
	}
	.comment input:hover,
	.comment input:focus {
		border-color: var(--control-border);
		background: var(--surface);
		outline: none;
	}
	.directive {
		color: var(--faint);
		font-size: var(--text-md);
	}
	.pause {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin: var(--space-1) 0;
		padding: 2px var(--space-1) 2px var(--space-4);
		border-radius: var(--radius-pill);
		background: var(--accent-bg);
		color: var(--accent-text);
		font-size: var(--text-sm);
		font-weight: 600;
	}
	.pause label {
		display: inline-flex;
		align-items: center;
		gap: var(--space-1);
		margin-left: var(--space-1);
	}
	.pause input {
		width: 2.6em;
		font: inherit;
		text-align: center;
		color: var(--text);
		background: transparent;
		border: 1px solid transparent;
		border-radius: var(--radius-xs);
		padding: 0;
		appearance: textfield;
		-moz-appearance: textfield;
	}
	.pause input::-webkit-inner-spin-button,
	.pause input::-webkit-outer-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
	.pause input:hover,
	.pause input:focus {
		border-color: var(--control-border);
		background: var(--surface);
		outline: none;
	}
	.pause .step {
		width: 1.5rem;
		height: 1.5rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: none;
		border-radius: var(--radius-pill);
		background: transparent;
		color: inherit;
		font-size: var(--text-md);
		padding: 0;
		cursor: pointer;
	}
	.pause .step:hover:not(:disabled) {
		background: var(--surface);
	}
	.pause .step:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.tab {
		width: 100%;
		font-family: 'SF Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
		font-size: var(--text-md);
		line-height: 1.35;
		color: var(--text);
		background: var(--surface);
		border: 1px dashed var(--control-border);
		border-radius: var(--radius-xs);
		padding: var(--space-2) var(--space-3);
		resize: vertical;
		white-space: pre;
		overflow-x: auto;
	}
	.add-bar {
		margin-top: var(--space-7);
		padding-top: var(--space-5);
		border-top: 1px solid var(--border);
		display: flex;
		align-items: center;
	}

	/* Narrow screens (tablet portrait and phones): the metadata grid collapses
	   to two columns and the chord diagrams panel disappears, leaving the room
	   to the sheet. */
	@media (max-width: 900px) {
		.meta {
			grid-template-columns: 1fr 1fr;
		}
		.chords-panel {
			display: none;
		}
	}

	/* Phones: single-column metadata; the per-line tools have no hover, so
	   they stay off until the «Righe» toggle turns them on. */
	@media (max-width: 600px) {
		.meta {
			grid-template-columns: 1fr;
		}
		.line-tools,
		.add-top {
			display: none;
		}
		.sheet.show-tools .line-tools {
			display: flex;
			visibility: visible;
		}
		.sheet.show-tools .add-top {
			display: block;
			visibility: visible;
		}
	}
</style>
