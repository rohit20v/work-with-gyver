# Architettura

## Confini dei moduli

- `app/routes.ts` dichiara il contratto HTTP e i metodi supportati; `app/router.ts` lo collega al controller Remix 3.
- `app/actions/controller.tsx` è il confine backend: valida input, interroga Prisma, orchestra generazione, gestisce persistenza e status HTTP. La UI server-rendered è servita da `/`.
- `app/actions/public/advertisement-dashboard.tsx` è una piccola isola client Remix UI: chiama le API, mostra risultati/filtri e invia le modifiche. Non contiene la logica LLM o database.
- `app/services/llm.server.ts` è l'astrazione provider: definisce il draft, compone il prompt, chiama la REST API Ollama via `fetch` e valida il JSON. Il controller non gestisce dettagli di protocollo del provider.
- `app/lib/prisma.server.ts` possiede il client Prisma e l'inizializzazione SQLite in-memory. `prisma/schema.prisma` definisce il modello; `prisma/seed-data.ts` condivide i dati demo tra l'inizializzazione runtime e `prisma/seed.ts`.

La divisione mantiene semplici i confini della soluzione: HTTP/orchestrazione, provider LLM, storage, rendering. Non introduce un container DI o un servizio separato.

## Modello dati

```text
JobOffer 1 ─────────── * Advertisement
```

`JobOffer` conserva l'origine interna: titolo, azienda, descrizione densa, luogo, competenze, esperienza, note interne e date. `Advertisement` è una singola bozza destinata a un canale/luogo/formato. Contiene `jobOfferId`, `channel`, `format`, `status`, `location`, titolo/call-to-action, contenuto attivo, `generatedContent` JSON, eventuale `imageUrl` e date.

Una variante non ha una tabella autonoma: è un altro record `Advertisement` con lo stesso `jobOfferId`. Per esempio, un'offerta può avere contemporaneamente Instagram/TEXT/Brescia e WhatsApp/TEXT/Brescia. Questa scelta evita un'astrazione che oggi non aggiunge comportamento. Gli indici su `jobOfferId` e `channel` sostengono i filtri richiesti; l'eliminazione dell'offerta elimina le relative bozze.

Per tenere compatibile SQLite, canale/formato/stato sono stringhe a livello DB, non enum DB. Gli endpoint validano i valori ammessi (`INDEED`, `INSTAGRAM`, `TIKTOK`, `WHATSAPP`; `TEXT`, `IMAGE`, `IMAGE_TEXT`; stati creati come `DRAFT`). `requiredSkills` è JSON perché Prisma SQLite non supporta gli array nativi come PostgreSQL.

`generatedContent` conserva il draft prodotto dall'LLM (title, content, callToAction e, quando richiesto, imagePrompt); i campi top-level sono la versione corrente. Il PATCH modifica solo la versione corrente: la generazione di partenza resta leggibile e non viene sovrascritta.

## Flusso dati

1. `POST /api/advertisements` valida JSON, canale, formato, luogo e ID offerta.
2. Carica il `JobOffer`. Il percorso generativo usa il record interno completo, ma lo passa al provider attraverso un DTO esplicito.
3. `buildAdvertisementPrompt` costruisce `publicSource` con whitelist di titolo, azienda, descrizione, luogo, competenze ed esperienza. `internalNotes`, ID e date non vengono passati al provider né serializzati nel prompt. La descrizione e gli altri campi ammessi possono comunque contenere informazioni non pubblicabili: il modello riceve inoltre istruzioni di non divulgarle. La whitelist limita l'esposizione delle note, non è un redattore automatico del contenuto sorgente.
4. La richiesta HTTP locale va a `OLLAMA_BASE_URL/api/generate` con `OLLAMA_MODEL`, `stream: false` e `format: "json"`. Il prompt distingue i quattro canali e chiede una struttura diversa solo per i formati immagine (aggiunge `imagePrompt`).
5. Il servizio fa parsing JSON esplicito, controlla le stringhe obbligatorie e restituisce errore tipizzato in caso di provider down, JSON malformato o campo mancante. Nessun record viene creato quando la generazione fallisce.
6. Il controller persiste draft originale e campi attivi e restituisce `201`. La UI mostra titolo, canale, formato, luogo, contenuto e prompt visivo opzionale.
7. L'editor invia `PATCH` con il testo rivisto. Il backend rifiuta contenuti vuoti e aggiorna il campo corrente senza cambiare `generatedContent`.

## Endpoint e risposta

La tabella completa degli endpoint e gli esempi PowerShell sono nel [README](README.md#api). I filtri combinabili sono `jobOfferId` e `channel`. Gli errori attesi usano `400` per input invalido, `404` per record assente e `503` per indisponibilità/risposta invalida Ollama. Errori inattesi restano errori server.

## Semplificazioni da tenere presenti

- Lo schema applicativo crea tabelle e demo al primo accesso perché la configurazione attuale è in-memory. La migration SQL presente documenta lo schema SQLite, ma l'avvio rapido non esegue `migrate` né un processo seed esterno.
- La memoria condivisa SQLite vive nel processo del server; alla chiusura vengono persi offerte e annunci. Non usare per più processi, ambienti condivisi o dati da conservare.
- La whitelist del prompt esclude le note interne e i metadati; la descrizione densa resta input e può comunque contenere informazioni riservate, quindi va revisionata e il copy va controllato da una persona.
- `IMAGE` / `IMAGE_TEXT` non producono immagini: il campo `imagePrompt` è testo suggerito. `imageUrl` è previsto per un flusso futuro, ma ora non viene compilato.
- Il modello può comunque allucinare o ignorare le istruzioni. La validazione strutturale non è un controllo semantico/deterministico; è richiesta revisione umana.
- Mancano auth, paginazione, editing delle Job Offer, audit/version history e pubblicazione verso piattaforme.
