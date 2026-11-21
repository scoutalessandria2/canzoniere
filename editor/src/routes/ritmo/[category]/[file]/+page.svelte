<script lang="ts">
	// The review of the rhythm engine's analysis of a song (local only): listen
	// to the engine's reading on the recording and to the version to learn,
	// correct meter, tempo, pattern and chord durations, and save the song's
	// .rhythm.json.
	import { untrack } from 'svelte';
	import { resolve } from '$app/paths';
	import { parse, type Song } from '@canzoniere/shared/chordpro';
	import { categoryLabel } from '@canzoniere/shared/categories';
	import { transposeChord } from '@canzoniere/shared/chords';
	import {
		recordingSource,
		sameSource,
		songChords,
		type RhythmDisagreement,
		type RhythmStatus
	} from '@canzoniere/shared/rhythm';
	import { youtubeUrl } from '@canzoniere/shared/youtube';
	import {
		confirmDuration,
		initialState,
		recordingEvents,
		selectReading,
		setDuration,
		teachingBars,
		teachingEvents,
		toRhythmFile,
		type AnalysisReading,
		type ReviewState
	} from '#lib/rhythm-model.js';
	import { createPlayer } from '#lib/rhythm-player.js';
	import PatternEditor from '#lib/components/PatternEditor.svelte';
	import ChordDurations from '#lib/components/ChordDurations.svelte';

	let { data } = $props();

	const MAX_BEATS = 64; // the longest chord duration the page accepts
	const MIN_BPM = 20;
	const MAX_BPM = 300;

	const song = $derived(parse(data.content));
	const title = $derived(song.meta.title || data.file);
	const editUrl = $derived(
		resolve(`edit/${encodeURIComponent(data.category)}/${encodeURIComponent(data.file)}`)
	);

	// an analysis without readings has nothing to review
	const analysis = $derived(data.analysis && data.analysis.readings.length > 0 ? data.analysis : null);
	// the recording the engine would analyse now: the maintainer's own, else the video
	const source = $derived(recordingSource(song, data.recording?.hash ?? null));
	const otherRecording = $derived(analysis !== null && !sameSource(analysis.source, source));
	const oldSong = $derived(analysis !== null && analysis.fingerprint !== data.fingerprint);

	// What is sung from each chord, in songChords' order: the lyric up to the
	// next chord of the line, with the start of a word the chord splits
	// ("pen-sieri").
	function chordLyrics(s: Song): string[] {
		const out: string[] = [];
		for (const line of s.lines) {
			if (line.type !== 'lyric') continue;
			const sorted = [...line.chords].sort((a, b) => a.pos - b.pos);
			sorted.forEach((c, k) => {
				const end = k + 1 < sorted.length ? sorted[k + 1].pos : line.text.length;
				const before = line.text.slice(0, c.pos);
				const sung = line.text.slice(c.pos, end).trim();
				const splits = /\S$/.test(before) && /^\S/.test(line.text.slice(c.pos));
				out.push(splits && sung ? `${before.match(/\S+$/)?.[0]}-${sung}` : sung);
			});
		}
		return out;
	}

	// The chords the analysis refers to by index: the song's own, with their
	// lyrics, while the song has the layout that was analysed; otherwise the
	// analysis' names alone.
	const chords = $derived.by(() => {
		if (!analysis) return [];
		if (oldSong) return analysis.chords.map((name) => ({ name, lyric: '', chorus: false }));
		const lyrics = chordLyrics(song);
		return songChords(song).map((c, i) => ({ name: c.chord, lyric: lyrics[i] ?? '', chorus: c.chorus }));
	});
	const chorus = $derived(chords.map((c) => c.chorus));

	// The teaching being reviewed, in the analysis' chord layout: saved data made
	// for another layout is not used. Edits replace it.
	let review = $derived(analysis ? initialState(analysis, data.saved, analysis.fingerprint) : null);
	const reading = $derived(analysis && review ? analysis.readings[review.reading] : null);
	const bars = $derived(review && reading ? teachingBars(review.durations, reading.beatsPerBar) : []);

	let saveStatus = $state('');
	let saveFailed = $state(false);
	let saving = $state(false);

	function update(next: ReviewState) {
		review = next;
		saveStatus = '';
	}

	function chooseReading(index: number) {
		if (!analysis || !review) return;
		update(selectReading(analysis, index, review.status));
	}

	function changeBpm(input: HTMLInputElement) {
		if (!review) return;
		const value = Math.round(Number(input.value));
		const bpm = input.value.trim() === '' || !Number.isFinite(value)
			? review.bpm
			: Math.min(MAX_BPM, Math.max(MIN_BPM, value));
		input.value = String(bpm);
		if (bpm !== review.bpm) update({ ...review, bpm });
	}

	function changeStatus(status: RhythmStatus) {
		if (review) update({ ...review, status });
	}

	function changePattern(pattern: string) {
		if (review) update({ ...review, pattern });
	}

	function changeChorusPattern(chorusPattern: string) {
		if (review) update({ ...review, chorusPattern });
	}

	function changeDuration(chord: number, beats: number) {
		if (review) update(setDuration(review, chord, Math.min(MAX_BEATS, beats)));
	}

	function confirm(chord: number) {
		if (review) update(confirmDuration(review, chord));
	}

	// A meter's name, with its subdivision when two readings share the meter.
	function readingLabel(r: AnalysisReading): string {
		const twins = analysis?.readings.filter((o) => o.meter === r.meter).length ?? 0;
		return twins > 1 ? `${r.meter} (${r.slotsPerBeat} colpi per tempo)` : r.meter;
	}

	// --- listening ---

	type Mode = 'recording' | 'teaching';
	let mode = $state<Mode>('recording');
	let click = $state(true);
	let strum = $state(true);
	let playing = $state(false);
	let position = $state(0); // seconds into what is played: the recording, or the version to learn
	let audio = $state<'idle' | 'loading' | 'ready' | 'failed'>('idle');
	let audioError = $state('');
	const player = createPlayer();
	let frame = 0;
	let alive = true; // false once the page is left
	let playRequest = 0; // the latest press of play; a mode switch cancels it

	// semitones from the song's key to the recording's
	const shift = $derived(analysis ? ((analysis.transpose % 12) + 12) % 12 : 0);
	const shiftText = $derived.by(() => {
		if (shift === 0) return '';
		const steps = shift <= 6 ? shift : 12 - shift;
		const where = shift <= 6 ? 'sopra' : 'sotto';
		return `, che suona ${steps} ${steps === 1 ? 'semitono' : 'semitoni'} ${where} la canzone`;
	});
	const playChords = $derived(
		chords.map((c) => (mode === 'recording' && shift ? transposeChord(c.name, shift) : c.name))
	);

	const events = $derived.by(() => {
		if (!review || !reading) return [];
		return mode === 'recording'
			? recordingEvents(reading, review.pattern, review.chorusPattern, chorus)
			: teachingEvents(review, reading, chorus);
	});
	const beatClicks = $derived(events.filter((e) => e.kind === 'click'));

	// the chord of the beat sounding at `t`, -1 before the first beat or on a beat without one
	function chordAt(t: number): number {
		let lo = 0;
		let hi = beatClicks.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (beatClicks[mid].at <= t + 0.001) lo = mid + 1;
			else hi = mid;
		}
		return lo > 0 ? beatClicks[lo - 1].chord : -1;
	}
	const current = $derived(playing || position > 0 ? chordAt(position) : -1);

	function tick() {
		if (!player.playing()) {
			// the end of the recording or of the version to learn: back to the start
			playing = false;
			position = 0;
			return;
		}
		position = player.position();
		frame = requestAnimationFrame(tick);
	}

	function start(from: number) {
		player.play(events, {
			from,
			recording: mode === 'recording',
			click,
			strum,
			chords: playChords
		});
		playing = player.playing();
		position = from;
		cancelAnimationFrame(frame);
		if (playing) frame = requestAnimationFrame(tick);
	}

	function stop() {
		player.stop();
		cancelAnimationFrame(frame);
		playing = false;
		position = player.position();
	}

	// The recording is fetched on the first press, which also opens the
	// browser's audio: browsers only allow it inside a user gesture. Once it has
	// loaded, playback starts only if the page is still open and the mode has
	// not changed in the meantime.
	async function togglePlay() {
		if (playing) {
			stop();
			return;
		}
		const request = ++playRequest;
		if (mode === 'recording' && audio !== 'ready') {
			audio = 'loading';
			try {
				await player.load(
					resolve(
						`api/rhythm/${encodeURIComponent(data.category)}/${encodeURIComponent(data.file)}/audio`
					)
				);
				audio = 'ready';
			} catch (e) {
				audio = 'failed';
				// the player's own messages are in Italian; the browser's are not
				audioError =
					e instanceof Error && e.name === 'Error'
						? e.message
						: 'Impossibile caricare la registrazione.';
				return;
			}
			if (!alive || request !== playRequest) return;
		}
		start(position);
	}

	function setMode(next: Mode) {
		if (next === mode) return;
		stop();
		playRequest++;
		mode = next;
		position = 0;
	}

	// Moves to a time of the recording, playing on from there when it plays.
	function seek(time: number) {
		setMode('recording');
		position = time;
		if (playing) start(time);
	}

	function seekChord(chord: number) {
		const time = reading?.chordStarts[chord];
		if (time != null) seek(time);
	}

	// changes heard at once: playback restarts from where it is with the new sounds
	$effect(() => {
		void [events, click, strum, playChords];
		untrack(() => {
			if (playing) start(player.position());
		});
	});

	$effect(() => () => {
		alive = false;
		player.stop();
		cancelAnimationFrame(frame);
	});

	function clock(seconds: number): string {
		const s = Math.max(0, Math.floor(seconds));
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	}

	// "0:22 · «pen-sieri» · nel .cho Sol, nella registrazione Fa"
	function disagreement(d: RhythmDisagreement): string {
		const lyric = chords[d.chord]?.lyric;
		const where = lyric ? ` · «${lyric}»` : '';
		return `${clock(d.time)}${where} · nel .cho ${d.expected}, nella registrazione ${d.heard}`;
	}

	function date(iso: string): string {
		const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
		return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
	}

	// --- saving ---

	async function save() {
		if (!analysis || !review) return;
		saving = true;
		saveStatus = '';
		try {
			const res = await fetch(
				resolve(`api/rhythm/${encodeURIComponent(data.category)}/${encodeURIComponent(data.file)}`),
				{
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify(toRhythmFile(review, analysis))
				}
			);
			if (!res.ok) {
				throw new Error((await res.json().catch(() => null))?.message ?? res.statusText);
			}
			saveFailed = false;
			saveStatus = 'Salvato.';
		} catch (e) {
			saveFailed = true;
			saveStatus = e instanceof Error ? e.message : String(e);
		} finally {
			saving = false;
		}
	}
</script>

<svelte:head>
	<title>Ritmo — {title} · Canzoniere</title>
</svelte:head>

<div class="head">
	<nav class="crumbs">
		<a href={resolve('/')}>Categorie</a>
		/
		<a href={resolve(`c/${encodeURIComponent(data.category)}`)}>{categoryLabel(data.category)}</a>
		/
		<a href={editUrl}>{title}</a>
		/ Ritmo
	</nav>
	<a href={editUrl} class="btn" data-testid="rhythm-edit-link">Modifica la canzone</a>
</div>

<h2>Ritmo — {title}</h2>

{#if analysis}
	<p class="source">
		Analisi del {date(analysis.analyzed)}
		{#if analysis.source.kind === 'youtube'}
			su <a href={youtubeUrl(analysis.source.id)} target="_blank" rel="noopener noreferrer"
				>questa registrazione</a
			>{shiftText}.
		{:else}
			sulla tua registrazione{#if data.recording && !otherRecording}
				{' '}(<code data-testid="rhythm-own-file">registrazioni/{data.recording.path}</code>){/if}{shiftText}.
		{/if}
	</p>
{:else}
	<p>Nessuna analisi per questa canzone.</p>
{/if}

{#if otherRecording}
	<p class="notice" data-testid="rhythm-other-recording">
		L'analisi è di un'altra registrazione: rilancia il motore.
	</p>
{/if}
{#if oldSong}
	<p class="notice" data-testid="rhythm-old-song">
		L'analisi è di una versione precedente della canzone: rilancia il motore.
	</p>
{/if}
{#if !analysis || otherRecording || oldSong}
	{#if !source}
		<p data-testid="rhythm-no-recording">
			Prima metti la tua registrazione in
			<code>registrazioni/{data.category}/{data.file.replace(/\.cho$/, '')}.m4a</code> (va bene anche
			mp3 o wav), oppure aggiungi il link YouTube nei metadati.
		</p>
	{/if}
	<p><code class="command" data-testid="rhythm-command">make rhythm SONG={data.category}/{data.file}</code></p>
{/if}

{#if analysis && review && reading}
	<section class="card listen" data-testid="rhythm-listen">
		<div class="modes" role="group" aria-label="Cosa ascoltare" data-testid="rhythm-mode">
			<button
				type="button"
				class:active={mode === 'recording'}
				aria-pressed={mode === 'recording'}
				onclick={() => setMode('recording')}
				title="La registrazione con click e chitarra sui tempi trovati dal motore"
			>
				Sulla registrazione
			</button>
			<button
				type="button"
				class:active={mode === 'teaching'}
				aria-pressed={mode === 'teaching'}
				onclick={() => setMode('teaching')}
				title="Click e chitarra al tempo e con le durate da salvare, senza registrazione"
			>
				Versione da imparare
			</button>
		</div>
		<button
			type="button"
			class="btn primary play"
			onclick={togglePlay}
			disabled={mode === 'recording' && (audio === 'loading' || audio === 'failed')}
			data-testid="rhythm-play"
		>
			{playing ? '■ Ferma' : '▶ Ascolta'}
		</button>
		<span class="clock" data-testid="rhythm-position">{clock(position)}</span>
		<label class="switch">
			<input type="checkbox" bind:checked={click} data-testid="rhythm-click" />
			Click
		</label>
		<label class="switch">
			<input type="checkbox" bind:checked={strum} data-testid="rhythm-strum" />
			Chitarra
		</label>
		{#if mode === 'recording' && audio === 'loading'}
			<span class="hint">Carico la registrazione…</span>
		{/if}
		{#if audio === 'failed'}
			<p class="error" role="alert" data-testid="rhythm-audio-error">{audioError}</p>
		{/if}
	</section>

	<section class="card">
		<div class="fields">
			<label>
				Metro
				<select
					value={review.reading}
					onchange={(e) => chooseReading(Number(e.currentTarget.value))}
					data-testid="rhythm-meter"
				>
					{#each analysis.readings as r, i (i)}
						<option value={i}>{readingLabel(r)}</option>
					{/each}
				</select>
			</label>
			<label>
				Tempo (bpm)
				<input
					type="number"
					min={MIN_BPM}
					max={MAX_BPM}
					value={review.bpm}
					onchange={(e) => changeBpm(e.currentTarget)}
					data-testid="rhythm-bpm"
				/>
			</label>
			<label>
				Stato
				<select
					value={review.status}
					onchange={(e) => changeStatus(e.currentTarget.value as RhythmStatus)}
					data-testid="rhythm-status"
				>
					<option value="heard">Ascoltato dalla registrazione</option>
					<option value="proposed">Proposto</option>
				</select>
			</label>
		</div>
		<PatternEditor
			pattern={review.pattern}
			beatsPerBar={reading.beatsPerBar}
			slotsPerBeat={reading.slotsPerBeat}
			label={review.chorusPattern === null ? 'Pennata' : 'Strofa'}
			onchange={changePattern}
		/>
		{#if review.chorusPattern !== null}
			<PatternEditor
				pattern={review.chorusPattern}
				beatsPerBar={reading.beatsPerBar}
				slotsPerBeat={reading.slotsPerBeat}
				label="Ritornello"
				testid="chorus-pattern"
				onchange={changeChorusPattern}
			/>
		{/if}
	</section>

	<section class="card">
		<h3>Accordi</h3>
		<ChordDurations
			{bars}
			{chords}
			durations={review.durations}
			estimated={review.estimated}
			max={MAX_BEATS}
			{current}
			seekable={(chord) => mode === 'recording' && reading?.chordStarts[chord] != null}
			onseek={seekChord}
			onduration={changeDuration}
			onconfirm={confirm}
		/>
	</section>

	<section class="card">
		<h3>Differenze con la registrazione</h3>
		{#if reading.disagreements.length > 0}
			<ul class="disagreements" data-testid="disagreements">
				{#each reading.disagreements as d, i (i)}
					<li>
						<button type="button" onclick={() => seek(d.time)} title="Ascolta da qui sulla registrazione">
							{disagreement(d)}
						</button>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="hint">La registrazione suona gli accordi del .cho.</p>
		{/if}
	</section>

	<div class="save">
		<button
			type="button"
			class="btn primary"
			onclick={save}
			disabled={saving || otherRecording || oldSong}
			data-testid="rhythm-save"
		>
			Salva
		</button>
		<span class="status" class:error={saveFailed} role="status" data-testid="rhythm-save-status">
			{saveStatus}
		</span>
	</div>
{/if}

<style>
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
	h2 {
		margin: 0 0 var(--space-3);
	}
	h3 {
		margin: 0 0 var(--space-4);
		font-size: var(--text-md);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--muted);
	}
	.source,
	.hint {
		color: var(--muted);
		font-size: var(--text-md);
	}
	.source a {
		color: var(--link);
	}
	.notice {
		padding: var(--space-3) var(--space-5);
		border-radius: var(--radius-sm);
		border: 1px solid var(--notice-border);
		background: var(--notice-bg);
		color: var(--notice-text);
	}
	.command {
		display: inline-block;
		padding: var(--space-2) var(--space-4);
		border-radius: var(--radius-sm);
		background: var(--surface-alt);
		font-size: var(--text-md);
		user-select: all;
	}
	.card {
		background: var(--surface);
		border-radius: var(--radius-md);
		padding: var(--space-5);
		box-shadow: 0 1px 3px var(--shadow-sm);
		margin-bottom: var(--space-5);
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
	}
	/* stays in view below the header while the page scrolls, to stop and restart anywhere */
	.listen {
		position: sticky;
		top: calc(var(--topbar-height, 0px) + var(--space-3));
		z-index: 5;
		flex-direction: row;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-4);
	}
	.modes {
		display: inline-flex;
		border: 1px solid var(--control-border);
		border-radius: var(--radius-sm);
		overflow: hidden;
	}
	.modes button {
		border: none;
		background: var(--surface);
		color: var(--text);
		padding: var(--space-2) var(--space-5);
		font-size: var(--text-md);
		cursor: pointer;
	}
	.modes button + button {
		border-left: 1px solid var(--control-border);
	}
	.modes button.active {
		background: var(--active-bg);
		color: var(--active-text);
	}
	.play {
		min-width: 7.5rem;
	}
	.play:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.clock {
		font-variant-numeric: tabular-nums;
		color: var(--muted);
		min-width: 3em;
	}
	.switch {
		display: inline-flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--text-md);
	}
	.error {
		flex-basis: 100%;
		margin: 0;
		color: var(--danger);
	}
	.fields {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-4);
	}
	.fields label {
		display: flex;
		flex-direction: column;
		gap: var(--space-1);
		font-size: var(--text-xs);
		color: var(--muted);
	}
	.fields input,
	.fields select {
		font-size: var(--text-lg);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--control-border);
		border-radius: var(--radius-sm);
	}
	.fields input {
		width: 6rem;
	}
	.disagreements {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.disagreements button {
		border: none;
		background: none;
		padding: 0;
		color: var(--link);
		font-size: var(--text-md);
		text-align: left;
		cursor: pointer;
	}
	.disagreements button:hover {
		text-decoration: underline;
	}
	.save {
		display: flex;
		align-items: center;
		gap: var(--space-4);
	}
	.save .btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.status {
		color: var(--success);
	}
	.status.error {
		color: var(--danger);
	}
</style>
