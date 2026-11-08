# Canzoniere Alessandria 2 — Architecture

A web-based song management and PDF songbook generation system for Italian scout songs, featuring a visual chord editor, category management, event-specific songbook creation, and an offline-capable reader web app for browsing songs on tablets.

---

## 1. Top-Level Directory Structure

```
canzoniere/
├── canzoni/                 # Song database: ChordPro .cho files organized by category
│   ├── branco/              # Scout troop songs ("branco" = wolf pack)
│   ├── reparto/             # Scout troop ("reparto" = group)
│   ├── clan/                # Scout clan songs
│   ├── canti_scout/         # General scout songs
│   ├── chiesa/              # Church/spiritual songs
│   └── varie/               # Miscellaneous songs
├── canzonieri/              # Event-specific songbooks (list files + generated PDFs)
│   ├── chiusura_2026.txt    # Example: plaintext list of songs for an event
├── editor/                  # SvelteKit web application for editing songs & managing songbooks
├── reader/                  # SvelteKit static web app for reading songs (offline, tablet-friendly)
├── shared/                  # Library shared by editor and reader (ChordPro, chords, categories, diagrams)
├── printer/                 # Go CLI tool: converts .txt song lists → PDF
├── chordpro.json            # ChordPro PDF rendering configuration
├── Makefile                 # Build & dev scripts (Docker-based ChordPro compilation)
├── README.md                # User-facing quickstart
└── AGENTS.md                # AI agent instructions
```

### Purpose of Each Directory

- **canzoni/**: The core data store. Each song is a `.cho` file in ChordPro format (see §2). Filenames are slugified titles; directory structure mirrors song categories (which appear in the PDF table of contents).
- **canzonieri/**: Event songbooks. `.txt` files list song paths (relative to `canzoni/`) one per line. The Go tool (`printer/`) reads these lists and generates PDF files with selected songs, chord annotations stripped.
- **editor/**: Interactive web app (SvelteKit) for creating, editing, and organizing songs and event songbooks.
- **reader/**: Read-only web app (SvelteKit, fully prerendered) for browsing songs and songbooks with transposition, chord simplification, and search. Deployed to GitHub Pages under `/app/`; works offline via a service worker (see §7).
- **shared/**: Modules used by both editor and reader: ChordPro parse/serialize, chord helpers, category helpers, guitar chord diagrams (see §6).
- **printer/**: Standalone Go program that reads a `.txt` manifest and a ChordPro song directory, then renders a text-only PDF.

---

## 2. The `.cho` File Format (ChordPro)

The `.cho` format is a text-based markup for songs with chord annotations. It combines metadata directives, lyric text, and inline chord notation.

### Format Overview

**Metadata** (at the start, in curly braces):

```
{title:Song Title}
{artist:Artist Name}
{tag:Categoria}                      # Mirrors the directory (branco, chiesa, etc.)
{x_tag:omelia}                       # Optional: free-form search tag, one directive per tag
{columns:2}                          # Optional: layout columns in PDF
```

**Song Body**:

- Lyrics with chords inline, anchored to specific character positions.
- Chords are **Latin notation** (Do, Re, Mi, Fa, Sol, La, Si instead of C, D, E, F, G, A, B).
- Accidentals use `#` or `b` (e.g., `Do#`, `Mib`).

**Special Directives**:

```
{start_of_chorus} / {soc}            # Mark chorus start
{end_of_chorus} / {eoc}              # Mark chorus end
{comment:Some note}                  # Comment (rendered in PDF)
{other_directive:value}              # Preserved verbatim (e.g., {transpose:2})
```

### Example Files Analyzed

**File 1: `branco/cucciolo_d_uomo.cho` (67 lines)**

- Title: "Cucciolo d'uomo" (The Jungle Book — Mowgli theme)
- Artist: "La compagnia dei Carpiscout"
- Columns: 2
- Structure: Verse–chorus–verse–chorus pattern, with `{start_of_chorus}` and `{end_of_chorus}` markers.
- Chord syntax: Chords like `[Do]`, `[Lam]`, `[Sol]` appear inline before the syllable they attach to.
- Example line: `[Do] Alla Rupe del Con[Lam]siglio` → Do at the start, Lam partway through.

**File 2: `chiesa/alleluia_chiama_e_io.cho` (29 lines)**

- Title: "Alleluia, chiama ed io"
- Tag: "Chiesa"
- No explicit columns directive (defaults to single column).
- Chord progression: Do–Sol–Lam–Mim–Fa–Do–Re–Sol pattern.
- Multiple chorus blocks marked with `{start_of_chorus}` / `{end_of_chorus}`.

**File 3: `varie/50_special.cho` (78 lines)**

- Title: "50 special" (Lunapop)
- Tag: "Varie", columns: 2
- Intro with chord-only lines: `[Sol] [Do] [Mim] [Re]` (no lyric text, just chords for instrumental).
- Demonstrates complex chord sequences and mixing of lyric + chord-only lines.

### Key Parser/Serializer Details

**Parser** (`shared/chordpro.ts`, `parse()` function, lines 50–102; both apps import it as `@canzoniere/shared/chordpro`):

- Splits input by newlines and matches directives with regex: `^\{\s*([\w-]+)\s*(?::\s*(.*?)\s*)?\}`.
- Extracts metadata: `{title}`, `{artist}`, `{tag}`, `{columns}`.
- Converts lyric lines: calls `parseLyricLine()` to separate text from chord anchors.
- Preserves unknown directives verbatim (type: `directive`).
- Trims leading/trailing empty lines from the metadata block.

**Lyric Line Parser** (`parseLyricLine()`, lines 31–48):

- Iterates character by character.
- When it encounters `[`, finds the matching `]` and extracts the chord, recording its position (`pos`) as the character index in the lyric text up to that point.
- Strips bracket pairs from the lyric text.
- Result: `{ text: string (without brackets), chords: Chord[] }` where `Chord = { pos: number, chord: string }`.

**Serializer** (`serialize()`, lines 117–149):

- Reverses the process: inserts chord brackets at their recorded positions before serializing.
- Maintains metadata directives in order (title, artist, tags, columns).
- Joins with newlines and ensures a trailing newline.

---

## 3. The Editor Web Application (SvelteKit + Svelte 5)

### Tech Stack

**Framework & Build**:

- **SvelteKit 2.63.0**: Full-stack meta-framework for Svelte, with file-based routing.
- **Svelte 5.56.1**: Reactive UI framework with runes (instead of v4 stores).
- **Vite 8.0.16**: Build tool & dev server.
- **TypeScript 6.0.3**: Strict type checking enabled.
- **@sveltejs/adapter-auto**: SvelteKit adapter (auto-detects deployment target).

**Configuration**:

- **tsconfig.json** (lines 1–20):
  - Extends `.svelte-kit/tsconfig.json` (auto-generated by SvelteKit).
  - `strict: true`, `esModuleInterop`, `skipLibCheck`, `sourceMap: true`.
  - `moduleResolution: "bundler"` for modern import resolution.
- **vite.config.ts** (lines 1–20):
  - SvelteKit Vite plugin with Svelte 5 runes mode forced.
  - `adapter: adapter()` for auto-detection.

**Testing**: Playwright (see README: `npm test` runs e2e tests in isolated temp directories).

### Directory Structure Under `editor/src/`

```
editor/src/
├── app.d.ts                                    # App type definitions (HydrationData, etc.)
├── lib/
│   ├── index.ts                                # Re-export barrel
│   ├── slug.ts                                 # Title → filename slug converter
│   ├── directives.ts                           # ChordPro directive catalog, autocomplete and checks
│   ├── components/
│   │   ├── LyricLineEditor.svelte             # Visual chord editor (see §3.3 detailed analysis)
│   │   ├── ChordProEditor.svelte              # Highlighted textarea, directive autocomplete, problems list
│   │   └── SongEditor.svelte                  # Parent component: tabs, metadata form, save logic
│   ├── server/
│   │   ├── songs.ts                            # CRUD & file I/O for .cho files
│   │   └── songbooks.ts                        # CRUD for event songbooks (.txt lists)
│   ├── assets/
│   │   └── favicon.svg
│   └── app.d.ts (implied)
└── routes/
    ├── +layout.svelte                          # Global layout: header, nav, styles
    ├── +page.svelte                            # Home: category folder grid
    ├── +page.server.ts                         # Load categories summary
    ├── c/[category]/                           # Category browser
    │   ├── +page.svelte                        # Song list with search/delete/move
    │   └── +page.server.ts                     # Load songs for category
    ├── edit/[category]/[file]/                 # Edit existing song
    │   ├── +page.svelte                        # Wrapper: calls SongEditor
    │   └── +page.server.ts                     # Load song content
    ├── new/                                    # Create new song
    │   ├── +page.svelte                        # Wrapper: calls SongEditor
    │   └── +page.server.ts                     # Load categories
    ├── songbooks/                              # Songbook list & creation
    │   ├── +page.svelte
    │   ├── +page.server.ts                     # Load songbooks
    │   ├── [name]/                             # Edit specific songbook
    │   │   ├── +page.svelte                    # Two-panel UI: entries + song picker
    │   │   └── +page.server.ts                 # Load songbook entries & all songs
    │   └── [name]/+server.ts                   # (implied, see API section)
    └── api/
        ├── songs/+server.ts                    # GET categories, POST new song
        ├── songs/[category]/[file]/+server.ts  # GET/PUT/PATCH/DELETE song
        ├── songbooks/+server.ts                # GET songbooks, POST new songbook
        └── songbooks/[name]/+server.ts         # GET/PUT/DELETE songbook
```

### Key Components & Their Responsibilities

#### 3.1 `shared/chords.ts` — Chord Transformations

**Functions**:

- `englishChordToLatin(chord)` (lines 30–40): Converts English note names (A, B, C, D, E, F, G) to Latin (La, Si, Do, Re, Mi, Fa, Sol). Handles chords with slashes (bass notes): `Am → Lam`, `C/G → Do/Sol`. Preserves suffixes (m, 7, maj7, sus4, etc.).
- `sanitizeChord(chord)` (lines 78–92): Normalizes user input from the visual editor. Handles case-insensitive matching, converts English to Latin, fixes capitalization (e.g., `em → Mim`), and handles bass note notation. Returns canonicalized Latin notation or unchanged text if unparseable.
- `transposeChord(chord, delta)` (lines 95–106): Shifts a Latin chord by `delta` semitones (e.g., `+1` or `-1`). Normalizes accidentals to sharps. Uses a 12-note scale lookup (`LATIN_SCALE`, line 3).

**Data**:

- `LATIN_SCALE` (line 3): `['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si']`.
- `NOTE_SEMITONE` (lines 5–13): Maps note names to semitone indices (Do=0, Re=2, …, Si=11).
- `EN_TO_LATIN` (lines 15–23): English↔Latin note mapping.

#### 3.2 `editor/src/lib/components/LyricLineEditor.svelte` — Visual Chord Editor (Detailed)

**Component Purpose**: Provides an interactive, character-level editor for adding, moving, and modifying chords on a lyric line. Central UI element of the app.

**Input & Reactive State**:

```typescript
let { line = $bindable() }: Props = $props();
// line.type === 'lyric', line.text, line.chords
```

- Line is bindable (two-way: parent receives edits).
- Chord model: `{ pos: number, chord: string }` where `pos` is character index in `line.text`.

**State Variables** (lines 12–22):

- `editingPos`: Currently open popover position (null = closed).
- `editingIdx`: Index of chord being edited (null = adding new).
- `chordInput`: User input in the popover.
- `inputEl`: Reference to popover input for focus.
- `editingText`: Whether in lyric text edit mode.
- `textDraft`: Draft of lyric text (if editing).
- `textRowEl`: Reference to text row container (for character width measurement).
- `drag`: Active drag state for repositioning pills.

**UI Layout** (lines 138–204):

1. **Chord Row** (lines 139–173): Absolute-positioned pills (buttons) anchored at chord positions. Popover appears when editing.
   - Pills are positioned with `left: ${c.left}ch` (character units).
   - Pills are nudged right if they would overlap the previous one (lines 126–135, `sortedChords` derived state).
   - Pointer events: drag detection (lines 80–98).
2. **Text Row** (lines 186–203): Grid of single-character buttons. Clicking opens the popover at that position. Edit button (✎) appears on hover.

**Chord Management**:

- `openNewChord(pos)` (lines 30–35): Opens popover at position, clears input, focuses input.
- `openEditChord(idx)` (lines 37–42): Opens popover with existing chord's text, selects input.
- `commitChord()` (lines 44–57): Sanitizes input, adds/updates/deletes chord in the line's array.
- `removeChord()` (lines 59–62): Deletes the chord at `editingIdx`.
- `closePopover()` (lines 64–68): Resets all popover state.
- Keyboard handling (lines 70–77): Enter = commit, Escape = cancel.

**Lyric Text Editing**:

- `startTextEdit()` (lines 101–105): Enters text edit mode, focuses input.
- `commitTextEdit()` (lines 107–114): Saves text edits and clamps chord positions (if text shortened).
- Keyboard handling (lines 116–122): Enter = commit, Escape = discard.

**Drag Repositioning** (lines 80–98):

- `onPillPointerDown()`: Initiates drag capture.
- `onPillPointerMove()`: Calculates delta in characters using `charWidth()`.
- `onPillPointerUp()`: Ends drag; if not moved, opens edit popover (click detection).

**Styling** (lines 207–312):

- Values from the shared design tokens (`shared/tokens.css`), so the light and dark themes both work.
- Monospace font (`SF Mono`), `--text-lg` (15px), 1.25 line-height.
- Chord pills: `--active-bg` background, `--active-text` text, `--radius-xs` radius.
- Popover: `--surface` background, box shadow, flex layout for input + buttons.
- Text row: `white-space: nowrap`, character buttons are 1ch wide, hover effects.

#### 3.3 `editor/src/lib/components/SongEditor.svelte` — Parent Editor Component

**Props** (lines 10–16):

- `initial`: Parsed Song object.
- `categories`: Available categories (used in dropdown).
- `mode`: "new" (create) or "edit" (update).
- `category`: Current category.
- `file`: Filename (edit mode only).

**State** (lines 20–26):

- `song`: Reactive song object (edited in both visual & raw tabs).
- `category`: Mutable category (for moves).
- `savedCategory`: Category as it exists on disk (tracks moves).
- `tab`: "visual" (LyricLineEditor) or "raw" (ChordProEditor).
- `raw`: Raw ChordPro text (synced when switching tabs).
- `status`: Message displayed to user (save status, errors).
- `saving`: Busy flag.

**Tab Switching** (lines 33–44):

- When switching to "raw": serializes song to text, syncs tag to category.
- When switching to "visual": parses raw text back to song object.
- Ensures bidirectional consistency.

**Chord Transformations** (lines 46–59):

- `applyToChords(fn)`: Applies a function (e.g., English→Latin, transpose) to all chords in all lyric lines.
- Parses raw tab if active, applies transformation, re-serializes if needed.

**Line Management** (lines 61–71):

- `addLine()`, `deleteLine()`: Mutate the song's line array.

**Save Logic** (lines 73–131):

- Validates title (required).
- Syncs tag to category.
- For edit mode: optionally moves file (PATCH), then updates (PUT).
- For new mode: generates filename from title slug, POSTs to create.
- Updates `status` and navigates to the saved song's URL on success.
- Error handling: catches and displays error messages.

#### 3.4 `editor/src/lib/server/songs.ts` — Song CRUD & I/O

**Environment**: `SONGS_DIR` (default `../canzoni` relative to cwd).

**Functions**:

- `listCategories()` (lines 29–36): Reads SONGS_DIR, filters to known CATEGORIES, returns in order.
- `listCategorySummaries()` (lines 38–45): For each category, counts `.cho` files.
- `listSongsByCategory(category)` (lines 47–63): Lists all songs in a category, sorts by title (Italian locale).
- `listAllSongs()` (lines 65–72): Flattens all categories, sorted by title.
- `readSong(category, file)` (lines 74–76): Reads file content as UTF-8.
- `writeSong(category, file, content)` (lines 78–81): Writes file; validates `.cho` extension.
- `moveSong(category, file, newCategory)` (lines 83–99): Moves file to new category, updates tag to match, deletes old.
- `deleteSong(category, file)` (lines 101–103): Deletes file.
- `songExists(category, file)` (lines 105–112): Checks if song is accessible.

**Security**: `safeJoin()` (lines 21–27) prevents path traversal by verifying the resolved path stays within SONGS_DIR.

#### 3.5 `editor/src/lib/server/songbooks.ts` — Songbook CRUD

**Environment**: `SONGBOOKS_DIR` (default `../canzonieri`).

**Songbook Format**: Plain text file (`.txt`), one song path per line (relative to `canzoni/`, e.g., `chiesa/alleluia_servire_e.cho`). Lines starting with `#` and empty lines are ignored.

**Functions**:

- `listSongbooks()` (lines 22–31): Reads all `.txt` files, counts non-comment entries, sorts by name.
- `parseEntries(content)` (lines 33–38): Splits by newline, trims, filters empty & comments.
- `songbookExists(name)` (lines 40–47): Checks if file exists.
- `readSongbook(name)` (lines 49–51): Returns parsed entries array.
- `writeSongbook(name, entries)` (lines 53–55): Writes entries as newline-delimited text (no trailing entries, but adds final newline).
- `deleteSongbook(name)` (lines 57–59): Deletes file.

**Validation**: `fileFor(name)` (lines 17–20) validates name with regex `^[\w-]+$` (alphanumerics, hyphens, underscores).

#### 3.6 `editor/src/lib/components/ChordProEditor.svelte` — Raw Text Editor

**Concept**: Overlay a transparent textarea on top of a `<pre>` element with syntax highlighting.

**Directive catalog** (`editor/src/lib/directives.ts`): every directive the editor knows, with its kind (meta, `x_` custom, chorus, comment, other), the value it takes (none, optional, text, whole number in a range) and an Italian description. `analyze(source)` splits each directive line into name and value and flags the wrong ones: unknown name (with the closest known one as a hint), missing or invalid value, missing `}`, text after `}`, spaces before `{` (the parser then reads the line as lyrics), a pause before the first timed line. `completions(query)` lists the directives offered for what follows `{`.

**Syntax Highlighting**:

- Directive lines take a class per kind (`hl-meta`, `hl-custom`, `hl-chorus`, `hl-comment`, `hl-directive`), with the value in its own span.
- Errors are underlined (`hl-error`, `hl-warning`) on the part they are about, or on the whole line.
- Chord brackets `[...]` (`hl-chord`); tab blocks verbatim.
- HTML-escaped for safety.

**Autocomplete**: typing `{` at the start of a line opens a listbox placed at the caret, measured on the `<pre>`'s text nodes (it lays the text out exactly like the textarea). Arrows move, Enter/Tab or a click accepts, Esc closes. The accepted directive replaces the typed name and is closed with `}`; when it takes a value the caret lands on it, with the default (e.g. `4` for `x_pause`) selected.

**Problems list**: below the editor, one row per flagged line; a click moves the caret to that line and scrolls to it.

**Scroll Sync**: When textarea scrolls, pre-element scrolls in sync (both positioned absolutely); scrolling closes the autocomplete.

### SvelteKit Routes Overview

#### Routes Structure

- **`/`**: Home, category browser (grid of folders). GET: `+page.server.ts` loads `listCategorySummaries()`.
- **`/c/[category]`**: Category detail, song list with search & actions (delete, move). GET: `+page.server.ts` loads `listSongsByCategory()`.
- **`/edit/[category]/[file]`**: Edit song. GET: loads song content via `readSong()`.
- **`/new`**: Create song. GET: loads categories.
- **`/songbooks`**: Songbook list & creation form. GET: `+page.server.ts` loads `listSongbooks()`.
- **`/songbooks/[name]`**: Edit songbook. GET: loads songbook entries & `listAllSongs()` for picker.

#### API Endpoints

- **`GET /api/songs`**: Returns `{ categories: CategorySummary[] }`.
- **`POST /api/songs`**: Create new song. Body: `{ category, file, content }`. Returns 201 on success.
- **`GET /api/songs/[category]/[file]`**: Fetch song. Returns `{ category, file, content }`.
- **`PUT /api/songs/[category]/[file]`**: Update song. Body: `{ content }`.
- **`PATCH /api/songs/[category]/[file]`**: Move song to new category. Body: `{ category }`.
- **`DELETE /api/songs/[category]/[file]`**: Delete song.
- **`GET /api/songbooks`**: Returns `{ songbooks: SongbookListItem[] }`.
- **`POST /api/songbooks`**: Create songbook. Body: `{ name, entries }`. Returns 201.
- **`GET /api/songbooks/[name]`**: (Implied) Fetch songbook entries.
- **`PUT /api/songbooks/[name]`**: Update songbook. Body: `{ entries: string[] }`.
- **`DELETE /api/songbooks/[name]`**: Delete songbook.

### Running the Editor

```bash
cd editor
npm install
npm run dev
```

Dev server runs at http://localhost:5173 (or next available port). Files are read/written directly to `../canzoni` and `../canzonieri`.

**Environment Variables**:

- `SONGS_DIR`: Override default `../canzoni`.
- `SONGBOOKS_DIR`: Override default `../canzonieri`.

---

## 4. Event Songbook Management

### Workflow

Event songbooks are `.txt` files in `canzonieri/` that define a static list of songs for a specific event (e.g., "apertura_2026", "chiusura_2026").

**Example: `chiusura_2026.txt`** (9 lines):

```
clan/e_la_strada_si_apre.cho
chiesa/alleluia_servire_e.cho
chiesa/servo_per_amore.cho
chiesa/santo_zaire.cho
chiesa/pace_sia_pace_a_voi.cho
chiesa/te_al_centro_del_mio_cuore.cho
chiesa/tu_sei.cho
chiesa/danza_la_vita.cho
```

Each line is a path relative to `canzoni/`.

### Editor UI for Songbooks

**`/songbooks`**: List of all event songbooks (`.txt` files) with song counts. Create new songbook form.

**`/songbooks/[name]`**: Two-panel interface:

1. **Left**: Ordered list of current songs (with move up/down, remove buttons).
2. **Right**: Available songs searchable by title (click `+` to add).

When saved, the file is written with one path per line, sorted in the order shown.

### PDF Generation via `printer/` Go Tool

The `printer` directory contains a standalone Go program that converts a `.txt` songbook manifest to a PDF.

---

## 5. The `printer/` Go Tool — PDF Rendering

### Purpose

Reads a `.txt` file listing song paths (or titles) and generates a clean, text-only PDF (chords removed) suitable for printing.

### Build & Invocation

```bash
cd printer
go build -o printer .
cd ..
./printer/printer -input=canzonieri/my_event.txt -output=canzonieri/my_event.pdf
```

**Flags**:

- `-input` (required): `.txt` manifest file.
- `-output` (default: `songbook.pdf`): Output PDF path.
- `-songs` (default: `canzoni`): Directory containing `.cho` files.
- `-dedup-chorus` (default: false): Replace repeated identical choruses with "Rit.".

### Key Components (main.go, 1–359 lines)

#### Song Parsing (`parseSong()`, lines 53–107)

- Opens `.cho` file and scans line by line.
- Extracts title from `{title:...}` directive.
- Tracks chorus state with `{start_of_chorus}` / `{end_of_chorus}`.
- Strips chords from lyric lines using regex: `chordRe = regexp.MustCompile(\`\[[^\]]+\]\`)` (line 31).
- Builds a `Song` struct with `Title` and `Lines[]` (each line has `Text` and `Kind`).

#### Line Types (lines 33–41)

```go
type LineKind int
const (
    KindTitle     // Song title (bold, 11pt)
    KindBody      // Regular lyric line (9pt)
    KindChorus    // Chorus line (italic, 9pt, indented)
    KindChorusRef // "Rit." placeholder (if -dedup-chorus)
    KindEmpty     // Blank line
)
```

#### Chorus Deduplication (`deduplicateChorus()`, lines 226–265)

If `-dedup-chorus` flag is set, identifies identical chorus blocks and replaces subsequent occurrences with a single "Rit." line. Compares chorus text (KindChorus lines joined).

#### PDF Layout (`Layout` struct, lines 127–195)

Uses `gofpdf` library for PDF generation. Manages two-column layout.

**Page Constants** (lines 15–29):

- A4: 210mm × 297mm.
- Margins: 12mm left/right, 15mm top/bottom.
- Column width: `(210 - 12 - 12 - 8) / 2 ≈ 89mm` (8mm gap between columns).
- Font sizes: 11pt for titles, 9pt for body.
- Line heights: 6pt title, 4.5pt body.

**Layout Methods**:

- `nextCol()`: Switch to next column or add new page (resets Y).
- `ensureSpace(h)`: Check if content fits; if not, next column.
- `writeLine()`: Render a line at the current X,Y, wrapping text if needed, advancing Y.
- `writeSong()`: Layout an entire song (title + lines), ensuring title stays with body.

**PDF Output** (lines 343–356):

- Creates a new `gofpdf.Fpdf("P", "mm", "A4", "")`.
- For each song in order, calls `layout.writeSong()`.
- Outputs to file with `pdf.OutputFileAndClose()`.

### Data Flow in `printer/`

1. Load all `.cho` files (if manifest uses titles instead of paths): `loadAllSongs()` builds a title→Song map.
2. For each entry in manifest:
   - If path ends with `.cho`: parse the file directly.
   - Otherwise: look up by title in the pre-loaded map.
3. Apply deduplication (if flag set).
4. Render to PDF with two-column layout.

---

## 6. The `shared/` Library — Common Song Logic

Modules consumed by both web apps: framework-free TypeScript plus one Svelte component. Both apps depend on it as the local package `@canzoniere/shared` (`file:../shared`, exports declared in `shared/package.json`) and import it by name.

| File                            | Lines | Purpose                                                                                                                       |
| ------------------------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------- |
| `shared/chordpro.ts`            | 1–149 | ChordPro parse/serialize: `parse()`, `serialize()`, `parseLyricLine()`, `serializeLyricLine()`; `Song`, `Line`, `Chord` types |
| `shared/chords.ts`              | 1–153 | Chord helpers: `englishChordToLatin()`, `sanitizeChord()`, `isValidChord()`, `simplifyChord()`, `transposeChord()`            |
| `shared/categories.ts`          | 1–18  | Category helpers: `categoryLabel()`, `sortCategories()`, `isValidCategoryName()`                                              |
| `shared/diagrams.ts`            | 1–73  | Guitar chord diagram lookup: `getChordDefinition()`, `latinChordToEnglish()`                                                  |
| `shared/chord-definitions.json` |       | ChordPro's built-in guitar diagram data (guitar.json from the chordpro Docker image)                                          |
| `shared/ChordDiagram.svelte`    | 1–208 | SVG chord diagram component; geometry mirrors ChordPro's PDF renderer                                                         |

Notable behaviors:

- `simplifyChord()` reduces a chord to its basic triad: extensions dropped, diminished/half-diminished become minor, augmented becomes major, bass note after `/` removed (`Lam7` → `Lam`, `Sol/Si` → `Sol`).
- `transposeChord()` works on Latin notes and normalizes accidentals to sharps.
- `isValidChord()` validates chords token by token (quality words, extensions, accidentals on extensions) to reject typos like `sdg` before saving.

---

## 7. The Reader Web Application (SvelteKit, static)

### Purpose

Read-only companion app for browsing the songbook from a tablet or phone (music-stand use). Published on GitHub Pages at `/app/`; installable from Safari via "Add to Home Screen" and fully functional offline.

### Tech Stack

Same SvelteKit 2 + Svelte 5 (runes) + Vite + TypeScript stack as the editor, with two key differences:

- **`@sveltejs/adapter-static`** with `prerender = true` and `trailingSlash = 'always'` (`reader/src/routes/+layout.ts`): every page is prerendered at build time; no backend.
- **Build-time data bundling** (`reader/src/lib/data.ts`): `import.meta.glob` with `eager: true` inlines every `canzoni/*/*.cho` and `canzonieri/*.txt` into the JS bundle. The app ships with its data; publishing new songs means rebuilding.

`BASE_PATH` (set by CI to `/app`) configures `paths.base` for the GitHub Pages sub-path deployment.

### Directory Structure Under `reader/src/`

```
reader/src/
├── lib/
│   ├── data.ts                     # Build-time song/songbook database (import.meta.glob)
│   ├── prefs.ts                    # localStorage persistence: per-song prefs + global font size
│   └── components/
│       └── SongSheet.svelte        # Song renderer: chord row above lyrics, chorus styling
├── routes/
│   ├── +layout.svelte              # App shell (header, layout)
│   ├── +layout.ts                  # prerender = true, trailingSlash = 'always'
│   ├── +page.svelte                # Home: search + category & songbook lists
│   ├── c/[category]/               # Songs in a category
│   ├── k/[name]/                   # Songbook detail (song list in book order)
│   └── s/[category]/[slug]/        # Song page (reading view with controls)
└── service-worker/index.ts         # Offline precache of the whole app
```

### Key Behaviors

**Data layer** (`reader/src/lib/data.ts`):

- Builds `allSongs` (sorted with `localeCompare(..., 'it')`), `categories` (ordered by `canzoni/.categories.json`, extras appended alphabetically), and `songbooks` (from `canzonieri/*.txt`, `#` lines skipped; entries whose `.cho` no longer exists are collected in `missing`).

**Song page** (`reader/src/routes/s/[category]/[slug]/+page.svelte`):

- Per-song controls: transpose (±semitones), simplify chords, hide chords, font size (12–26px) — applied on the fly via `simplifyChord()`/`transposeChord()` from `shared/chords.ts`.
- Preferences persisted per song in `localStorage` (`reader:song:<category>/<slug>`); defaults are not stored. Font size is global (`reader:fontSize`).
- Songbook reading context: opened with `?from=<songbook>` the page shows prev/next navigation following the book order (query string handled client-side because pages are prerendered).
- Screen wake lock (`navigator.wakeLock`) keeps the display on while a song is open.
- "Diagrammi" toggle: a bottom sheet lists the guitar diagrams (`shared/ChordDiagram.svelte`) of the song's unique chords in order of first appearance, computed after simplify/transpose so they match what is displayed.

**Rendering** (`SongSheet.svelte`):

- Monospace layout: for each lyric line a chord row is composed by placing each chord at its character position (pushed right on overlap), then rendered above the text. Chorus lines get a left border and italics; directives are hidden.

**Offline** (`reader/src/service-worker/index.ts`):

- On install, precaches the entire build (bundle + static assets + prerendered pages) in a versioned cache; on activate, drops old caches. Fetches are cache-first, falling back to the app shell for navigations when offline.

### Running the Reader

```bash
cd reader
npm install
npm run dev        # dev server with HMR
npm run build      # static build in build/
```

The Vite dev server allows access outside the app root (`fs: { allow: ['..'] }`) because songs, songbooks, and `shared/` live in the repository root.

---

## 8. ChordPro PDF Generation (`Makefile` & `chordpro.json`)

### ChordPro Tool

The project also uses the external **ChordPro** command-line tool (Docker-based) for generating the main comprehensive canzoniere PDF.

**Makefile** (lines 1–10):

```makefile
build:
    docker run -v ${PWD}:/data -w /data chordpro/chordpro:latest \
        chordpro canzoni/**/*.cho \
        --output=canzoniere.pdf \
        --config=modern3 \
        --transcode=latin \
        --config=chordpro.json \
        --front-matter=front.pdf \
        --back-matter=back.pdf
```

**Invocation**: `make build` compiles all `.cho` files into a single PDF with chord diagrams, formatted layout, and tables of contents.

**Configuration** (`chordpro.json`):

- Latin note system (lines 2–4).
- PDF page layout: no page alignment per song, even/odd pages disabled.
- Fonts: Times-Roman (body, 10pt), sans italic (chords, 9pt blue).
- Chorus styling: "Rit." tag for recalls.
- Two tables of contents:
  1. Alphabetical by title.
  2. Grouped by `{tag:...}` (category).

---

## 9. Build & Deployment

### Dev Server

```bash
cd editor
npm install
npm run dev
```

Runs SvelteKit dev server on localhost:5173 (HMR enabled). Same commands in `reader/` for the reader app.

### Production Build

```bash
cd editor
npm run build
npm run preview   # test the build locally
```

Outputs optimized bundle to `build/` (adapter-specific).

### CI / GitHub Pages (`.github/workflows/build.yml`)

On every push to `main` the workflow:

1. Builds `canzoniere.pdf` via `make build` (Docker + ChordPro).
2. Builds the `printer` Go tool and one PDF per `canzonieri/*.txt` (with `-dedup-chorus`).
3. Builds the reader with `BASE_PATH=/app` and copies it to `public/app/`.
4. Generates a landing `index.html` linking the full PDF, the reader, and the event PDFs, then deploys `public/` to GitHub Pages.

The editor is not deployed: it needs filesystem write access and runs locally only.

### PDF Builds

**Event Songbooks**:

```bash
./printer/printer -input=canzonieri/chiusura_2026.txt -output=canzonieri/chiusura_2026.pdf
```

**Full Canzoniere**:

```bash
make build   # Uses Docker + ChordPro
```

---

## 10. Data Flow: From `.cho` Files to Rendered Output

### In the Editor

1. **User opens `/edit/[category]/[file]`**:
   - Server loads `.cho` file from disk via `readSong()`.
   - `SongEditor` component calls `parse()` to convert raw text → `Song` object.
   - Visual tab renders `LyricLineEditor` for each lyric line.

2. **User edits (visual tab)**:
   - Clicks character to add chord → `LyricLineEditor` opens popover.
   - Types chord name (e.g., "am") → `sanitizeChord()` normalizes to "Lam".
   - Commits → chord added to line's array.

3. **User edits (raw tab)**:
   - `SongEditor` serializes song to ChordPro text.
   - `ChordProEditor` renders with syntax highlighting.
   - User can hand-edit text directly.

4. **User saves**:
   - If in raw tab: parses text back to `Song`.
   - Syncs tag to category.
   - Serializes song back to ChordPro text.
   - POSTs/PUTs to `/api/songs/[category]/[file]`.
   - Server writes `.cho` file to disk.

### For Event Songbooks

1. **User creates songbook on `/songbooks`**:
   - POST creates empty `.txt` file.

2. **User edits on `/songbooks/[name]`**:
   - Left panel: drag/drop or buttons to reorder songs from current list.
   - Right panel: search all songs, click `+` to add.
   - Saves: PUT writes `.txt` with one `category/file.cho` per line.

3. **External tool generates PDF**:
   - Run `./printer/printer -input=canzonieri/event.txt -output=canzonieri/event.pdf`.
   - Tool reads `.txt`, resolves each path to a `.cho` file, parses songs.
   - Strips chords, renders text-only 2-column PDF.

### In the Reader

1. **Build time**: `import.meta.glob` inlines every `.cho` and `.txt`; `data.ts` parses them into `allSongs`, `categories`, `songbooks`.
2. **User browses**: home search or category/songbook lists → `/s/[category]/[slug]` renders the song with `SongSheet`.
3. **User adjusts**: transpose/simplify/hide-chords/font-size are applied client-side and persisted in `localStorage`.

---

## 11. Key Files & Line References

### Core Libraries

| File                                 | Lines | Purpose                                                                                                         |
| ------------------------------------ | ----- | --------------------------------------------------------------------------------------------------------------- |
| `shared/chordpro.ts`                 | 1–149 | Parse/serialize ChordPro format (imported as `@canzoniere/shared/chordpro` by both apps) |
| `shared/chords.ts`                   | 1–153 | Chord notation, validation, simplification & transposition                                                      |
| `shared/categories.ts`               | 1–18  | Category labels, sorting & name validation                                                                      |
| `editor/src/lib/slug.ts`             | 1–10  | Title → filename conversion                                                                                     |
| `editor/src/lib/server/songs.ts`     | 1–113 | Song CRUD & file I/O                                                                                            |
| `editor/src/lib/server/songbooks.ts` | 1–60  | Songbook CRUD                                                                                                   |
| `reader/src/lib/data.ts`             | 1–100 | Build-time song/songbook database                                                                               |
| `reader/src/lib/prefs.ts`            | 1–57  | localStorage persistence of reading prefs                                                                       |

### Components

| File                                               | Lines | Purpose                                           |
| -------------------------------------------------- | ----- | ------------------------------------------------- |
| `editor/src/lib/components/LyricLineEditor.svelte` | 1–312 | Visual chord editor (character-level)             |
| `editor/src/lib/components/ChordProEditor.svelte`  | 1–406 | Highlighted textarea, directive autocomplete      |
| `editor/src/lib/components/SongEditor.svelte`      | 1–405 | Parent: tabs, metadata, save logic                |
| `reader/src/lib/components/SongSheet.svelte`       | 1–114 | Read-only song renderer (chord rows above lyrics) |

### Routes & API

| File                                                       | Purpose                                     |
| ---------------------------------------------------------- | ------------------------------------------- |
| `editor/src/routes/+page.svelte`                           | Home (category grid)                        |
| `editor/src/routes/c/[category]/+page.svelte`              | Category detail (song list)                 |
| `editor/src/routes/edit/[category]/[file]/+page.svelte`    | Song editor                                 |
| `editor/src/routes/new/+page.svelte`                       | New song form                               |
| `editor/src/routes/songbooks/+page.svelte`                 | Songbook list                               |
| `editor/src/routes/songbooks/[name]/+page.svelte`          | Songbook editor (two-panel)                 |
| `editor/src/routes/api/songs/[category]/[file]/+server.ts` | Song CRUD endpoints                         |
| `editor/src/routes/api/songbooks/[name]/+server.ts`        | Songbook CRUD endpoints                     |
| `reader/src/routes/+page.svelte`                           | Reader home (search, categories, songbooks) |
| `reader/src/routes/c/[category]/+page.svelte`              | Reader category page                        |
| `reader/src/routes/k/[name]/+page.svelte`                  | Reader songbook page                        |
| `reader/src/routes/s/[category]/[slug]/+page.svelte`       | Reader song page (reading controls)         |

### External Tools

| File              | Language | Purpose                                         |
| ----------------- | -------- | ----------------------------------------------- |
| `printer/main.go` | Go       | Convert song lists → PDF (text-only, no chords) |
| `Makefile`        | Make     | Docker-based ChordPro build (full canzoniere)   |
| `chordpro.json`   | JSON     | ChordPro configuration (layout, TOC, fonts)     |

---

## 12. Summary: System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Web Browser (SvelteKit)                  │
│                      editor/ (Node.js + Svelte 5)               │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Routes:                                                   │   │
│  │ / → Home (categories)                                    │   │
│  │ /c/[cat] → Songs in category                             │   │
│  │ /edit/[cat]/[file] → Editor (visual + raw)               │   │
│  │ /songbooks → Event songbooks                             │   │
│  │ /api/songs/* → CRUD operations                           │   │
│  │ /api/songbooks/* → Songbook CRUD                         │   │
│  └──────────────────────────────────────────────────────────┘   │
│  Shares shared/ (chordpro, chords, categories) with reader/     │
└─────────────────────────────────────────────────────────────────┘
                    ↓ Read/Write
         ┌──────────────────────────┐
         │ Filesystem (Node.js fs)  │
         │                          │
         │ ├─ canzoni/              │
         │ │  ├─ branco/*.cho       │
         │ │  ├─ chiesa/*.cho       │
         │ │  ├─ clan/*.cho         │
         │ │  ├─ reparto/*.cho      │
         │ │  ├─ canti_scout/*.cho  │
         │ │  └─ varie/*.cho        │
         │ │                        │
         │ └─ canzonieri/           │
         │    ├─ event_1.txt        │
         │    ├─ event_2.txt        │
         │    ├─ event_1.pdf (built)│
         │    └─ event_2.pdf (built)│
         └──────────────────────────┘
                    ↑
         ┌──────────────────────────┐
         │  External Tools          │
         │                          │
         │ · printer/ (Go)          │
         │   Input: .txt manifest   │
         │   Output: PDF (no chords)│
         │                          │
         │ · chordpro (Docker)      │
         │   Input: all .cho files  │
         │   Output: canzoniere.pdf │
         └──────────────────────────┘

         ┌──────────────────────────────────────────┐
         │  reader/ (SvelteKit static, GitHub Pages)│
         │                                          │
         │  Build time: bundles canzoni/ +          │
         │  canzonieri/ via import.meta.glob        │
         │                                          │
         │  / → search + categories + songbooks     │
         │  /c/[cat] → songs in category            │
         │  /k/[name] → songbook detail             │
         │  /s/[cat]/[slug] → reading view          │
         │    (transpose, simplify, hide chords,    │
         │     font size; prefs in localStorage)    │
         │                                          │
         │  Offline: service worker precaches all   │
         └──────────────────────────────────────────┘
```

---

## 13. Categories & Tags

The system uses a fixed set of six categories (also called "tags" in ChordPro metadata):

| Directory     | Label       | Use                           |
| ------------- | ----------- | ----------------------------- |
| `branco`      | Branco      | Scout troop (wolf pack) songs |
| `reparto`     | Reparto     | Scout group songs             |
| `clan`        | Clan        | Scout clan songs              |
| `canti_scout` | Canti scout | General scout songs           |
| `chiesa`      | Chiesa      | Religious/spiritual songs     |
| `varie`       | Varie       | Miscellaneous songs           |

Each `.cho` file's `{tag:...}` directive should match its directory (enforced during save).

---

## 14. Conclusion

The Canzoniere system is a complete song management platform designed for Italian scout groups:

- **Editor** (`SvelteKit`): Full-featured web UI for creating, editing, and organizing songs with a visual chord editor.
- **Reader** (`SvelteKit`, static): Offline-capable web app for browsing songs and songbooks on tablets, with transposition and chord simplification.
- **Shared library** (`shared/`): Framework-agnostic ChordPro and chord logic used by both apps.
- **Storage** (filesystem): `.cho` files in ChordPro format, organized by category.
- **Rendering** (Go + Docker): Two paths: event-specific PDFs via the `printer/` tool (text-only), or a comprehensive annotated canzoniere via the ChordPro CLI.
- **Extensibility**: All data is text-based; integrations can easily read `.cho` files or `.txt` manifests and generate custom outputs.
