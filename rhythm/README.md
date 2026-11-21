# Motore del ritmo

Programma Python che ricava dalla registrazione di una canzone (la tua, oppure
il suo video YouTube) il metro, il tempo, la pennata e la durata di ogni
accordo del `.cho`. Scrive una proposta in `rhythm/.cache/`; la si ascolta,
corregge e salva dalla pagina «Ritmo» dell'editor locale, che scrive
`<canzone>.rhythm.json` accanto al `.cho`. Il motore non modifica mai
`canzoni/`.

## Prerequisiti

```bash
brew install python@3.14 yt-dlp ffmpeg
```

`yt-dlp` serve solo per le registrazioni da YouTube.

Serve Python 3.14: per versioni più recenti PyTorch non ha ancora i pacchetti.
Il `Makefile` usa `python3.14`; un altro interprete si sceglie con
`make rhythm RHYTHM_PYTHON=/percorso/python SONG=…`.

Al primo avvio `make rhythm` crea l'ambiente `rhythm/.venv/` e installa le
dipendenze di `requirements.txt` (PyTorch, Demucs, Beat This!, librosa): circa
1–2 GB. Se `requirements.txt` cambia, l'ambiente viene ricreato al lancio
successivo (lo stesso vale per `rhythm/.venv-test/` e `requirements-test.txt`). Alla prima analisi scarica anche i pesi dei modelli (Demucs
`htdemucs_6s` ~80 MB, Beat This! `final0` ~77 MB) nelle cache dell'utente.

## Uso

Dalla radice del repository, con il percorso della canzone relativo a
`canzoni/`:

```bash
make rhythm SONG=canti_scout/la_gioia.cho
make rhythm SONG=canti_scout/la_gioia.cho ARGS=--reanalyze
```

`ARGS` passa al motore le opzioni descritte sotto.

La canzone deve avere degli accordi e una registrazione:

- **la tua**, in `registrazioni/<categoria>/<canzone>.<estensione>` alla radice
  del repository, con lo stesso nome del `.cho` (per esempio
  `registrazioni/canti_scout/la_gioia.m4a`); va bene qualunque formato che
  ffmpeg legge (m4a dei Memo Vocali, mp3, wav…). La cartella è ignorata da git:
  l'audio resta su questo computer e non finisce né nel `.cho` né nel
  `.rhythm.json`, che ne conserva solo l'impronta (SHA-256);
- oppure **il video YouTube** della canzone (`{x_youtube:…}`, dal modulo dei
  metadati dell'editor).

Se ci sono entrambe vince la tua; due file per la stessa canzone sono un
errore. Il motore prepara l'audio (lo scarica, se viene da YouTube), separa gli
strumenti, trova battiti e accordi e stampa un riassunto con l'indirizzo della
pagina di revisione:

```
Metro: 6/8 (alternative: 3/4)
Tempo: 103 BPM
Pennata: D.UDDU
Differenze con il .cho: 12
Stato: ascoltato dalla registrazione
Controlla e salva: http://localhost:5173/ritmo/canti_scout/la_gioia.cho
```

Direttamente, da `rhythm/`:

```bash
.venv/bin/python -m engine canti_scout/la_gioia.cho [--songs-dir DIR] [--recordings-dir DIR] [--cache-dir DIR] [--reanalyze]
```

- `--songs-dir`: cartella delle canzoni (predefinita `../canzoni`); il
  percorso della canzone può anche essere assoluto.
- `--recordings-dir`: cartella delle tue registrazioni (predefinita
  `../registrazioni`).
- `--cache-dir`: cartella della cache (predefinita `rhythm/.cache`).
- `--reanalyze`: rifà solo l'analisi con le caratteristiche audio già estratte
  (`features.json`), senza modelli: utile dopo aver cambiato gli accordi del
  `.cho` o il codice dell'analisi.

## Cache

Una cartella per canzone, `rhythm/.cache/<categoria>/<canzone>/`, ignorata da
git e cancellabile in qualsiasi momento:

| File              | Contenuto                                                       |
| ----------------- | --------------------------------------------------------------- |
| `recording.txt`   | la registrazione da cui viene tutto il resto: `youtube:<id>` o `file:<sha256>` |
| `source.*`        | l'audio scaricato da YouTube (solo per i video)                 |
| `stereo.wav`      | l'audio a 44,1 kHz stereo (le tracce 5.1 vengono ridotte)       |
| `audio.m4a`       | la copia AAC che la pagina di revisione riproduce               |
| `stems/*.wav`     | gli strumenti separati da Demucs                                |
| `features.json`   | battiti, colpi, cromagramma, quota della chitarra               |
| `analysis.json`   | la proposta che legge la pagina di revisione                    |

Rilanciando il motore sulla stessa registrazione audio e strumenti si riusano;
se la registrazione cambia (un altro link, la tua aggiunta, sostituita o tolta)
la cartella viene svuotata e si riparte.

## Come legge la registrazione

- **Metro**: i battiti di Beat This! vengono divisi in 2, 3 o 4 parti secondo
  dove cadono i colpi della chitarra; i metri con quel numero di suddivisioni
  per battuta (6/8 e 3/4, 12/8 e 3/4…) si ordinano per quanto gli accenti
  cadono sui loro movimenti. Beat This! può sbagliare la battuta di un livello,
  quindi una battuta di 4/4 viene proposta anche come due di 2/4 e due battute
  di 2/4 anche come una di 4/4: gli accenti cadono sugli stessi movimenti, e a
  pari punteggio viene prima la battuta di Beat This!. L'analisi tiene tutte le
  letture, ognuna con le sue battute, la migliore per prima.
- **Accordi**: la sequenza di accordi del `.cho` viene allineata alla
  registrazione battito per battito; introduzioni, intermezzi, strofe saltate
  e ritornelli ripetuti sono tollerati. Le durate da insegnare sono in movimenti
  interi, le battute restano complete e le righe con gli stessi accordi prendono
  la stessa lettura. Dove la registrazione suona un altro accordo per almeno
  una battuta il motore lo segnala, ma il `.cho` resta com'è.
- **Pennata**: una suddivisione della battuta fa parte della pennata quando la
  forza media dei colpi che cadono lì supera quella a metà strada tra una
  suddivisione e l'altra, dove la mano è in aria (`STROKE_RATIO`). Il confronto
  è con quel silenzio e non con la suddivisione più forte: il primo colpo della
  battuta è accentato e cade sul cambio d'accordo, e può valere dieci volte le
  pennate leggere (soprattutto quelle in su) che pure fanno parte della
  pennata. La media si fa sulle battute della strofa per la pennata e su
  quelle del ritornello per la pennata del ritornello, tenuta solo se
  diversa.
- **Senza chitarra**: se la chitarra pesa meno del 30% degli strumenti, i
  colpi si leggono su tutti gli strumenti tranne la voce, batteria compresa, e
  gli accordi su quelli senza batteria: metro, tempo e durate vengono calcolati
  lo stesso, ma la pennata è quella tipica del metro, con stato «proposto».

### Direzione della pennata

La direzione non si sente in modo affidabile: viene da una regola, modificabile
colpo per colpo nella pagina di revisione. Con 2 o 4 suddivisioni per
movimento la mano oscilla sulla griglia, giù sulle suddivisioni pari e su sulle
dispari (in 4/4 a crome: giù su 1-2-3-4, su sugli «e»); nei tempi composti
(6/8, 9/8, 12/8) ogni movimento si suona giù-giù-su. Le suddivisioni senza
colpo sono `.`.

## Se il download non riesce

YouTube cambia spesso e `yt-dlp` smette di funzionare finché non viene
aggiornato:

```bash
brew upgrade yt-dlp
```

Se anche dopo l'aggiornamento non scarica, controllare che il video esista e
sia pubblico.

## Test

Le parti pure del motore (lettura del `.cho`, metro, pennata, allineamento,
durate, formato dell'analisi) dipendono solo da numpy e girano anche in CI:

```bash
make rhythm-test
```

`tests/test_la_gioia.py` ripete l'analisi su caratteristiche registrate di «La
gioia» (`tests/fixtures/la_gioia_features.json`), senza modelli né rete.
