# Tradeoff e decisioni

## Scelte

- **TypeScript**: era già il linguaggio del progetto Remix; mantiene route, input e UI nello stesso sistema di tipi.
- **Remix 3**: riuso del router/controller già presente, con `Request`/`Response` standard e resource routes. Nessun framework backend aggiunto.
- **Prisma**: rende il modello relazionale esplicito e leggibile, adatto a spiegare cardinalità e persistenza.
- **Ollama via HTTP nativo**: niente SDK proprietari o dipendenze LLM; `OLLAMA_BASE_URL` e `OLLAMA_MODEL` configurano il provider locale dietro `llm.server.ts`.
- **SQLite in-memory per la demo locale**: l'autore ha chiesto di poter provare il flusso senza avviare PostgreSQL. Si sacrifica persistenza/uso multi-processo per una prima esperienza immediata. È un adattamento per sviluppo, non l'architettura raccomandata per una sezione annunci condivisa.
- **Relazione diretta JobOffer → Advertisement**: un annuncio è già una variante indipendente; stessa offerta, più record con canale/formato/luogo diversi. Nessuna tabella Variant finché non esistono campi/comportamenti propri delle varianti.

## Ambiguità interpretate

- La job offer interna è separata dal copy pubblico. Le API job-offer e il prompt escludono `internalNotes`; il generatore invia una whitelist dei campi pertinenti. La descrizione libera resta comunque da controllare per dati riservati.
- “Immagine” è un formato di annuncio. I modelli installati comprendono immagini ma non producono file; la soluzione genera quindi un prompt visuale per un futuro image generator e non finge di aver creato una creatività.
- “Gestire varianti” è interpretato come creazione indipendente, elenco/filtri e modifica/cancellazione degli annunci. Non è stato aggiunto un raggruppamento di esperimenti A/B, perché la consegna non definisce metriche o gruppi.
- Status presenti nello schema sono `DRAFT`, `PUBLISHED`, `ARCHIVED`, ma in questa app non esiste publishing: i record generati partono `DRAFT` e non è esposto un endpoint per cambiare status.

## Cosa è stato sacrificato

- PostgreSQL richiesto inizialmente è stato sostituito temporaneamente con SQLite in-memory per il setup immediato chiesto dall'utente; i dati non persistono tra riavvii e i tipi del DB per enumerazioni/array differiscono dal target originario.
- Nessuna autenticazione: si tratta di un tool interno di demo, non da esporre in rete. La descrizione delle job offer può contenere informazioni sensibili.
- Nessuna immagine binaria, upload o integrazione di publishing.
- UI volutamente essenziale; niente paginazione, ricerca testuale, gestione dell'offerta o modifica di ogni campo.
- Nessun retry/queue: la chiamata LLM è sincrona e ha timeout, e un errore diventa `503`.

## Limiti tecnici

- L'in-memory SQLite vive nel processo/server. Non si condivide tra processi worker e si resetta all'arresto. L'inizializzazione schema è SQL esplicito nel client server e deve restare allineata con Prisma schema/migration.
- Il sistema chiede output JSON e valida struttura e stringhe obbligatorie, ma non prova semanticamente ogni fatto. Un modello può ignorare istruzioni o aggiungere claim; validazione e revisione umana sono necessarie.
- Il prompt è un controllo probabilistico; la whitelist pubblica esclude note interne e metadati dal prompt, mentre non redige automaticamente informazioni sensibili inserite nella descrizione libera.
- Le indicazioni di tono canale sono linee guida sintetiche, non policy aggiornabili per ogni piattaforma. I limiti di caratteri, hashtag e requisiti legali non sono verificati.
- Nessuna immagine viene generata da Ollama in Windows nella configurazione documentata; `imagePrompt` deve essere usato manualmente con un image generator compatibile, fuori dal perimetro attuale.

## Con un giorno in più (ordine)

1. Tornare a PostgreSQL richiesto dalla consegna (oppure mantenere SQLite su file per sviluppo) e usare davvero migrazioni/seed come unica origine dello schema, rimuovendo SQL runtime parallelo.
2. Aggiungere test del servizio Ollama con `fetch` mockato: output valido, JSON malformato, campo mancante, timeout e status provider.
3. Aggiungere test API per creazione/filtri/PATCH/DELETE, con database isolato e reset per test.
4. Migliorare factuality/safety con separazione strutturata dei requisiti pubblici, validazione semantica assistita e workflow di approvazione editoriale.
5. Aggiungere status transition esplicite, audit delle modifiche e paginazione, senza introdurre publishing automatico.
6. Integrare un generatore immagini solo dopo aver scelto/validato il runtime hardware supportato e il formato di storage; quindi salvare il riferimento in `imageUrl`.
7. Aggiungere un test browser per il flusso completo dashboard → generazione mockata → modifica → filtri.
