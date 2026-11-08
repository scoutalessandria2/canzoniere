# Backend

Servizio HTTP in Go che fa da proxy fidato verso le API di GitHub: il sito
pubblico può proporre modifiche alle canzoni e inviare suggerimenti senza che
alcun token GitHub raggiunga il browser.

## Endpoint

| Metodo | Path               | Effetto                                                    |
| ------ | ------------------ | ---------------------------------------------------------- |
| `GET`  | `/health`          | Health check                                               |
| `POST` | `/api/songs`       | Crea branch + commit + pull request con la canzone inviata |
| `POST` | `/api/songs/batch` | Come sopra ma per più canzoni in una sola pull request     |
| `POST` | `/api/suggestions` | Apre una issue sul repository con il suggerimento          |
| `GET`  | `/api/editor/ping` | Verifica la password dell'editor (`X-Editor-Key`)          |

### `POST /api/songs`

```json
{
  "path": "canzoni/branco/attorno_alla_rupe.cho",
  "content": "{title:Attorno alla Rupe}\n...",
  "note": "Corretti gli accordi del ritornello",
  "author": "Mario",
  "turnstileToken": "..."
}
```

Risposta `201`: `{"pullRequestUrl": "https://github.com/..."}`.

Il `path` deve corrispondere a `canzoni/<categoria>/<file>.cho` (minuscole,
underscore); il contenuto deve essere UTF-8 valido con la direttiva
`{title:...}`. La modifica non tocca mai `main`: finisce in una pull request
da revisionare.

### `POST /api/suggestions`

```json
{
  "message": "Manca la strofa finale di ...",
  "song": "Attorno alla Rupe",
  "name": "Mario",
  "turnstileToken": "..."
}
```

Risposta `201`: `{"issueUrl": "https://github.com/..."}`.

### `POST /api/songs/batch`

Endpoint dell'editor online: richiede la password condivisa nell'header
`X-Editor-Key` (niente Turnstile). Massimo 50 file, ognuno validato come in
`POST /api/songs`; crea un branch con un commit per file e una pull request
unica.

```json
{
  "files": [
    { "path": "canzoni/branco/attorno_alla_rupe.cho", "content": "..." }
  ],
  "note": "Corretti gli accordi",
  "author": "Mario"
}
```

Risposta `201`: `{"pullRequestUrl": "https://github.com/..."}`. Senza
`EDITOR_KEY` configurata risponde `503`; password sbagliata `401`.

## Configurazione (variabili d'ambiente)

| Variabile            | Default                                     | Uso                                       |
| -------------------- | ------------------------------------------- | ----------------------------------------- |
| `GITHUB_TOKEN`       | (obbligatoria)                              | Fine-grained PAT, solo questo repo        |
| `GITHUB_REPO`        | `scoutalessandria2/canzoniere`              | Repository di destinazione                |
| `GITHUB_BASE_BRANCH` | `main`                                      | Branch base delle pull request            |
| `TURNSTILE_SECRET`   | (vuota = verifica disattiva)                | Secret di Cloudflare Turnstile            |
| `EDITOR_KEY`         | (vuota = batch disattivo)                   | Password condivisa dell'editor online     |
| `ALLOWED_ORIGINS`    | `https://canzoniereal2.alessandriascout.it` | Origin CORS ammessi, separati da virgola  |
| `PORT`               | `8080`                                      | Porta di ascolto (impostata da Cloud Run) |

Il token GitHub va creato come fine-grained PAT limitato al repository
`scoutalessandria2/canzoniere` con i permessi repository
`Contents: Read and write`, `Pull requests: Read and write` e
`Issues: Read and write`.

Anti-abuso: rate limiting in memoria (10 POST al minuto per IP) e, quando
`TURNSTILE_SECRET` è impostata, verifica server-side del token Cloudflare
Turnstile inviato dal client nel campo `turnstileToken`.

## Sviluppo locale

```sh
cd backend
GITHUB_TOKEN=... go run .
go test ./...
```

## Deploy su Cloud Run

Progetto GCP: `canzoniere-506115` (account `lussoluca@gmail.com`).

Prima volta:

```sh
gcloud auth login
gcloud config set project canzoniere-506115
gcloud services enable run.googleapis.com secretmanager.googleapis.com \
  cloudbuild.googleapis.com artifactregistry.googleapis.com

# Token GitHub in Secret Manager (incolla il PAT, poi Ctrl-D)
gcloud secrets create github-token --data-file=-
# Secret di Turnstile (facoltativo ma consigliato in produzione)
gcloud secrets create turnstile-secret --data-file=-
```

Deploy (da `backend/`):

```sh
gcloud run deploy canzoniere-api \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --min-instances 0 --max-instances 1 \
  --memory 128Mi \
  --set-secrets GITHUB_TOKEN=github-token:latest,TURNSTILE_SECRET=turnstile-secret:latest,EDITOR_KEY=editor-key:latest
```

La password dell'editor va creata come secret `editor-key`
(`gcloud secrets create editor-key --data-file=-`). Quando si ruota un
secret serve una nuova revisione del servizio: basta un redeploy.

Con `--min-instances 0` il servizio scala a zero: al volume atteso resta nel
tier gratuito di Cloud Run. Il primo avvio dopo un periodo di inattività
aggiunge circa un secondo di latenza.
