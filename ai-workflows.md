# AI workflows

## Flusso implementato nel prodotto

La generazione è sincrona e parte dal `POST /api/advertisements`; non è previsto un job asincrono perché la consegna è un nucleo minimo senza code o servizi aggiuntivi:

```text
Dashboard submit
  -> Remix controller: validate request + find JobOffer
  -> LLM provider: select public fields + prompt by channel/format
  -> Ollama local /api/generate (JSON mode)
  -> parse + required-field validation
  -> Prisma persist (generatedContent + current editable fields)
  -> JSON 201 -> dashboard list/editor
```

Il contenuto generato resta una bozza. L'editing manuale passa da un `PATCH` separato, così l'LLM non viene richiamato per salvare una modifica e il draft originale rimane tracciabile.

Per formati immagine, il workflow termina producendo anche una descrizione visuale. Non c'è generazione binaria: i modelli disponibili all'autore (Qwen3.5, Qwen2.5-VL, Llama 3.2, Gemma 3) sono LLM/vision e non modelli text-to-image. Il supporto image-generation sperimentale di Ollama è documentato solo per macOS; l'ambiente dell'esercizio è Windows. Non viene simulata una generazione riuscita.

## Processo di sviluppo assistito

L'assistente di coding ha seguito passaggi espliciti e verificabili:

1. Ispezione del package esistente, route map, controller, guide Remix installate e test starter per mantenere Remix 3 invece di sostituire lo scaffold.
2. Modellazione Prisma e route REST, poi isolamento del provider Ollama e del client Prisma.
3. Verifica TypeScript/Prisma e aggiunta della UI minima solo dopo la parte backend.
4. Dopo la richiesta di usare database in-memory, revisione dell'inizializzazione: schema e dati demo vengono caricati nel processo server, perché un database SQLite in memoria non sopravvive tra i processi CLI di migrate e seed.
5. Dopo il chiarimento sui modelli Ollama, aggiornamento del modello predefinito a `qwen3.5:latest` e del prompt per generare un `imagePrompt` testuale (non immagine) nei formati visuali.
6. Confronto finale con la traccia italiana, verifica della semantica reale dei campi e scrittura di questa documentazione in base a quanto implementato.

Strumenti effettivamente usati: skill Remix caricata per consultare la documentazione locale installata; lettura/search delle route e API; CLI `npm run typecheck`, `npm test`, Prisma `validate`/`generate` e `remix doctor`. Per chiarire la capacità image-generation sono state consultate le pagine ufficiali Ollama per modelli vision e image-generation. Non sono stati aggiunti MCP, subagent, script esterni o servizi LLM cloud. La generazione di testo in esecuzione resta Ollama locale.

## Cosa manca nel workflow AI

- Nessun test end-to-end che chiami un modello: richiederebbe Ollama, un modello e tempo di inferenza; i test correnti verificano avvio DB/demo, API job offer e shell HTML.
- Nessun mock test unitario del parser con output malformato o campi assenti (utile da aggiungere).
- Nessun punteggio automatico di factuality, schema di tool calling o controllo privacy semantico. La whitelist di `publicSource` esclude le note interne esplicite prima del prompt; la descrizione può ancora contenere dettagli riservati e il resto richiede revisione.
- Nessun retry: su errore provider la route ritorna `503`, evitando duplicati e contenuti inventati.
