# Gyver — Annunci per offerte di lavoro

Applicazione minimale per creare, visualizzare e modificare annunci destinati a Indeed, Instagram, TikTok e WhatsApp a partire da offerte interne per tecnici. Un'offerta può avere più annunci, anche per canali, formati e luoghi diversi. Non vengono pubblicati annunci sulle piattaforme esterne.

## Avvio rapido (Windows)

> Nota per la valutazione: la traccia iniziale indicava PostgreSQL. Per poter provare tutto senza un server DB locale, la configurazione attuale usa SQLite in-memory come scelta di sviluppo esplicita. Schema e API Prisma mantengono l'organizzazione relazionale, ma i dati demo creati durante il flusso non vengono conservati dopo lo stop dell'app.

### Prerequisiti

- Node.js **24.3 o superiore** e npm.
- Ollama installato ([ollama.com/download](https://ollama.com/download)) e avviato.
- Modello gemma3 già disponibile localmente. Per scaricarlo una volta sola:

```powershell
ollama pull gemma3:latest
ollama list
```

Non servono chiavi API a pagamento: il progetto chiama l'API locale di Ollama. Se Ollama è su un altro indirizzo o si vuole usare un altro modello, cambiare le variabili seguenti.

### Installazione e configurazione

Dalla cartella del progetto:

```powershell
npm install
Copy-Item .env.example .env
```

`.env` contiene:

```dotenv
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="qwen3.5:latest"
```

`OLLAMA_BASE_URL` è l'indirizzo dell'API locale di Ollama; `OLLAMA_MODEL` deve corrispondere a un modello mostrato da `ollama list`. Riavviare il server dopo aver modificato `.env`.

### Generazione Prisma e avvio

```powershell
npm run db:generate
npm run dev
```

Aprire **http://localhost:44100/**. Al primo accesso l'app crea lo schema SQLite in memoria e carica tre offerte di esempio. Non eseguire `db:migrate` o `db:seed`: in questo profilo il database viene inizializzato dall'app e tutto il contenuto (annunci compresi) si azzera alla chiusura del server. La directory `prisma/` contiene lo schema e la migration iniziale come riferimento per il profilo SQLite persistente. Se `db:generate` fallisce su Windows con `EPERM`/rename del query engine, fermare eventuali processi `npm run dev` e riprovare: il file nativo potrebbe essere ancora bloccato dal server.

### Percorso per provare il flusso completo

1. Aprire `/` e scegliere un'offerta, ad esempio **Capo cantiere fotovoltaico**.
2. Scegliere un canale e un formato, ad esempio `INSTAGRAM` e `TEXT`, poi indicare il luogo e selezionare **Generate**.
3. Il backend carica l'offerta, seleziona i campi previsti per il prompt (esclude note interne e metadati), invia a Ollama una richiesta JSON, controlla la risposta e salva la bozza. Revisionare sempre la descrizione sorgente e il copy.
4. L'annuncio compare nella lista. Modificare il contenuto nel campo e selezionare **Save content**: il testo generato originale resta in `generatedContent`, il testo attivo aggiornato in `content`.
5. Ripetere con la stessa offerta ma un canale, formato o luogo diverso per creare un'altra variante indipendente.
6. Usare i filtri per offerta/canale per ritrovare le varianti.

Per `IMAGE` e `IMAGE_TEXT`, Ollama crea anche un **prompt testuale per un generatore d'immagini** (`generatedContent.imagePrompt`); non crea né salva un file immagine. I modelli Qwen multimodali installati comprendono immagini, ma non sono generatori text-to-image. La funzione sperimentale di generazione immagini di Ollama non è documentata come disponibile su Windows. L'uso di un generatore d'immagini è quindi opzionale e fuori dal flusso implementato.

## API

Le route sono definite in `app/routes.ts` e implementate nel controller Remix. Le risposte sono JSON, salvo il `204` della cancellazione.

| Metodo | Endpoint | Funzione |
|---|---|---|
| GET | `/api/job-offers` | Elenca offerte (campi pubblicabili, esclusi note interne e dettagli tecnici) |
| GET | `/api/job-offers/:id` | Legge i campi pubblicabili di un'offerta |
| GET | `/api/advertisements` | Elenca annunci; supporta `jobOfferId` e `channel` |
| GET | `/api/advertisements/:id` | Legge un annuncio |
| POST | `/api/advertisements` | Genera e salva una bozza tramite Ollama |
| PATCH | `/api/advertisements/:id` | Modifica `content`, `title` e/o `callToAction` |
| DELETE | `/api/advertisements/:id` | Elimina un annuncio |

Canali ammessi: `INDEED`, `INSTAGRAM`, `TIKTOK`, `WHATSAPP`. Formati ammessi: `TEXT`, `IMAGE`, `IMAGE_TEXT`. Gli annunci appena creati hanno stato `DRAFT`.

Esempi (PowerShell):

```powershell
Invoke-RestMethod http://localhost:44100/api/job-offers
Invoke-RestMethod 'http://localhost:44100/api/advertisements?jobOfferId=job-fotovoltaico&channel=INSTAGRAM'

$body = @{
  jobOfferId = 'job-fotovoltaico'
  channel = 'INSTAGRAM'
  format = 'IMAGE_TEXT'
  location = 'Brescia'
} | ConvertTo-Json
Invoke-RestMethod http://localhost:44100/api/advertisements -Method Post -ContentType 'application/json' -Body $body
```

Il POST restituisce l'annuncio creato (`201`). Una richiesta non valida restituisce `400`, un'offerta/annuncio inesistente `404`, Ollama non disponibile o una risposta non valida `503`. La UI mostra l'errore restituito e non crea contenuto fittizio.

## Struttura del progetto

```text
app/
  actions/controller.tsx                       # pagina iniziale e handler API
  actions/public/advertisement-dashboard.tsx   # UI interattiva
  lib/prisma.server.ts                         # Prisma, schema SQLite in-memory e dati demo
  services/llm.server.ts                       # prompt, chiamata Ollama e validazione JSON
  services/llm.server.test.ts                  # test di prompt e allowlist
  routes.ts                                    # contratto URL/metodi
  router.ts                                    # router Remix
prisma/
  schema.prisma                                # modelli Prisma
  migrations/                                  # migration SQLite iniziale
  seed-data.ts                                 # offerte demo per l'inizializzazione runtime
  seed.ts                                      # seed CLI per un eventuale DB su file
README.md
architecture.md
prompts.md
ai-workflows.md
tradeoffs.md
```

## Verifiche

```powershell
npm run typecheck
npm test
npx prisma validate
```

Il repository non definisce uno script `build`: Remix esegue i sorgenti TypeScript attraverso `remix/node-tsx` durante lo sviluppo/avvio.

## Limiti principali

Il database in-memory è scelto per rendere immediata la prova senza installare un servizio PostgreSQL: non è adatto a conservare dati tra riavvii o a più istanze. La traccia originale menziona PostgreSQL; per un ambiente persistente va sostituito il datasource e vanno usate migrazioni/seed standard. La validazione del modello controlla struttura e campi obbligatori, non garantisce che ogni frase sia fattualmente corretta o priva di dati sensibili: revisione umana prima della pubblicazione obbligatoria. Ulteriori decisioni e semplificazioni sono in [architecture.md](architecture.md) e [tradeoffs.md](tradeoffs.md).
