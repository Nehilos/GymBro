# Thalys — correzione v0.10.1: caricamento database ripristinato

Questa versione mantiene struttura HTML, login, Google Drive e funzioni nello stesso ordine della versione verificata dopo la separazione del CSS.

## Modifiche già eseguite

- Gli stili prima incorporati in `index.html` sono ora nel file `css/thalys.css`.
- `index.html` carica il nuovo foglio di stile con `<link rel="stylesheet" href="./css/thalys.css">`.
- Quattro blocchi JavaScript autonomi sono ora nella cartella `js`:
  - `tailwind-config.js`: configurazione dei colori e del tema Tailwind;
  - `theme-bootstrap.js`: applica subito il tema salvato evitando il lampeggio iniziale;
  - `ui-foundation.js`: gestisce viewport mobile e funzioni UI di base;
  - `pwa-register.js`: registra il service worker già previsto dall'app.
- La parte Google è stata estratta dal file HTML e divisa in:
  - `google-auth.js`: configurazione Google, token, login, logout e stato condiviso della connessione;
  - `drive.js`: cartelle, database JSON, sincronizzazione, backup, importazione e cestino di Google Drive.
- Il nuovo `media-tools.js` contiene il blocco dedicato a:
  - caricamento e gestione delle foto progresso;
  - apertura e chiusura della fotocamera;
  - scansione dei codici a barre;
  - ricerca dei prodotti alimentari scansionati;
  - riconoscimento nutrizionale da immagine e salvataggio della proposta.
- Il nuovo `app-core.js` contiene il nucleo applicativo precedentemente incorporato nell'HTML, tra cui:
  - struttura iniziale di `appState` e valori predefiniti;
  - salvataggio locale e compatibilità dei dati;
  - funzioni condivise di rendering e navigazione;
  - logica principale di Home, allenamenti, nutrizione, corpo, benessere e meditazione;
  - gestione delle lingue e dei consulti AI collegata allo stato dell'app.
- `app-core.js` viene caricato nello stesso punto occupato dal blocco originale, senza trasformarlo in modulo ES e senza cambiare la visibilità delle funzioni usate dall'HTML.
- Il nuovo `app-enhancements.js` contiene l'ultimo grande blocco di evoluzioni dell'app, inclusi aggiornamenti successivi a stato, Drive, foto, profilo, avatar, target nutrizionali, grafici e interfaccia.
- Il nuovo `oauth-ui.js` contiene esclusivamente l'apertura e la chiusura dell'avviso relativo a eventuali blocchi OAuth.
- `index.html` non contiene più logica JavaScript incorporata: conserva i collegamenti agli script esterni nello stesso ordine della versione originale.
- I cinque dizionari sono ora raccolti nella cartella `lang`:
  - `lang/lang_it.json`;
  - `lang/lang_en.json`;
  - `lang/lang_es.json`;
  - `lang/lang_pt.json`;
  - `lang/lang_ro.json`.
- È stato aggiornato soltanto il percorso di caricamento dei dizionari distribuiti con il sito.
- I nomi dei dizionari sincronizzati nel database di Google Drive restano invariati, così i dati già presenti continuano a essere riconosciuti.
- La divisione interna sperimentale tra `app-state.js`, `i18n.js` e `app-core.js` è stata annullata dopo aver rilevato una regressione nel cambio lingua.
- Il motore delle lingue è nuovamente dentro `app-core.js`, nella stessa configurazione funzionante della versione precedente.
- I dizionari restano correttamente organizzati nella cartella `lang`.
- Al collegamento di `app-core.js` è stato aggiunto un identificatore di versione per evitare che il browser riutilizzi una copia precedente dalla cache.
- La divisione sperimentale tra `app-base.js`, `workout.js` e `app-core.js` è stata annullata dopo la regressione nel caricamento dei database.
- `app-core.js` è stato ripristinato byte per byte dalla versione `v0.9.1`, che caricava correttamente database e lingue.
- Tutti gli asset CSS e JavaScript usano il nuovo identificatore `v=0101` per impedire il riutilizzo della versione problematica dalla cache.
- I file `app-base.js` e `workout.js` non devono più essere presenti nel repository.
- I nuovi file vengono caricati nello stesso punto e nello stesso ordine dei blocchi originali.
- Non sono stati rinominati o spostati logo, avatar, file MP3 o file lingua, perché tali asset non erano inclusi nello ZIP ricevuto.
- I blocchi più grandi relativi allo stato dell'app e alle singole sezioni non sono ancora stati spostati: verranno affrontati gradualmente dopo il test di questa versione.

## Come provarla sul computer

1. Estrai tutto lo ZIP in una cartella, senza spostare singoli file.
2. Apri un terminale dentro la cartella estratta.
3. Avvia un piccolo server locale con `python -m http.server 8000`.
4. Apri `http://localhost:8000` nel browser.
5. Controlla soprattutto modalità chiara/scura, Home, Dieta, Palestra, Corpo e Meditazione.

Il server locale è preferibile al doppio clic su `index.html`, perché login, richieste `fetch` e service worker richiedono un vero indirizzo web.

## Come pubblicarla

1. Conserva una copia o una versione GitHub dell'attuale progetto funzionante.
2. Copia nella cartella del repository il nuovo `index.html` e le cartelle `css` e `js`.
3. Lascia invariati tutti gli altri file già presenti su GitHub, compresi logo, avatar e MP3.
4. Carica entrambe le modifiche su GitHub nello stesso aggiornamento.
5. Attendi il deploy automatico di Vercel.
6. Apri il sito e ripeti i controlli indicati sotto.

## Collaudo rapido dopo il deploy

- La schermata iniziale e il logo si vedono correttamente.
- Il passaggio light/dark mantiene colori e impaginazione.
- I pulsanti e i menu rispondono.
- Il login Google funziona.
- Dopo il login, compare lo stato `Drive pronto` o `Sincronizzato`.
- I dati Drive vengono caricati e salvati.
- Il pulsante di sincronizzazione manuale completa l'operazione senza errori.
- I grafici di Dieta e Corpo sono visibili.
- Una meditazione audio parte correttamente.
- La fotocamera e lo scanner si aprono e si chiudono correttamente.
- La ricerca manuale di un codice a barre restituisce il prodotto o un messaggio comprensibile.
- Inserimento e modifica di acqua, alimento, allenamento e misurazione corpo continuano a funzionare.
- Il cambio lingua aggiorna correttamente le schermate.
- Dopo un nuovo deploy, prova almeno italiano, inglese e una terza lingua per verificare il caricamento dalla nuova cartella.
- Le sessioni di meditazione e i relativi progressi vengono registrati.
- Il calcolatore dei target nutrizionali si apre, calcola e salva correttamente.
- Avatar, foto profilo e foto progresso vengono visualizzati correttamente dopo un nuovo caricamento.
- Da smartphone non compaiono elementi fuori schermo.

Se uno di questi controlli fallisce, torna alla versione GitHub precedente e annota la schermata e l'azione che hanno prodotto il problema.
