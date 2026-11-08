# Canzoniere Alessandria 2

## 📥 Download

L'ultima versione del canzoniere è disponibile qui:
**[https://canzoniereal2.alessandriascout.it/](https://canzoniereal2.alessandriascout.it/)**

## 📱 Reader (web app installabile)

Per sfogliare i canti (con trasposizione, semplificazione degli accordi e ricerca) c'è una web app statica in [`reader/`](reader/), pubblicata su
**[https://canzoniereal2.alessandriascout.it/app/](https://canzoniereal2.alessandriascout.it/app/)**.

È una PWA: si apre in qualsiasi browser (telefono, tablet o computer) e si può installare sulla schermata Home per usarla anche offline.

- **iPhone / iPad (Safari):** _Condividi → Aggiungi a schermata Home_.
- **Android (Chrome):** menu ⋮ → _Installa app_ (o _Aggiungi a schermata Home_).
- **Computer (Chrome / Edge):** icona di installazione nella barra degli indirizzi.

Dopo un aggiornamento l'app avvisa con «Nuova versione pronta»: basta un tocco, senza reinstallarla.

```bash
cd reader && npm install && npm run dev
```

## ✏️ Editor web

Per aggiungere, modificare ed eliminare le canzoni (con un editor visuale degli accordi) e per gestire i canzonieri per eventi è disponibile un'applicazione web in [`editor/`](editor/README.md).

```bash
cd editor && npm install && npm run dev
```

Dettagli e funzionalità: [`editor/README.md`](editor/README.md).

## 🎵 Creare un canzoniere personalizzato

Per generare un canzoniere PDF (solo testo) da una lista di canzoni c'è il tool Go in [`printer/`](printer/README.md).

```bash
cd printer && go build -o printer . && cd ..
./printer/printer -input=canzonieri/mio_evento.txt -output=canzonieri/mio_evento.pdf
```

Formato della lista, opzioni e dettagli: [`printer/README.md`](printer/README.md).
