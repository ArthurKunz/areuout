// Ein Claude-Aufruf pro Kategorie mit Websuche und Seitenabruf (Vault: Party Agent Spike,
// Entscheidung 2026-11-11: Claude Haiku 5.5, effort medium, Streaming mit max_tokens
// 64000, bis zu 8 Suchen und 10 Abrufe pro Kategorie). Uebernommen aus run.mjs.
//
// Unterschiede zum Spike:
// - Die Obergrenze gilt ueber die ganze pause_turn-Schleife, nicht nur pro Anfrage. Ist sie
//   erreicht, kommt eine letzte Anfrage ohne Werkzeuge, die nur noch antwortet.
// - Kein `fallbacks`: Haiku 5.5 hat keinen serverseitigen Ausweich-Lauf. Eine Ablehnung
//   (stop_reason refusal) wird zum Fehler des Laufs.

import Anthropic from 'npm:@anthropic-ai/sdk@1.8.0'

export const MODEL = 'claude-haiku-5-5'
const MAX_SEARCHES = 8
const MAX_FETCHES = 10
const MAX_TURNS = 6

// USD pro Million Tokens. Ueber 100K Eingabe-Tokens in einer Anfrage gilt der hoehere Preis.
const PRICE = { in: 0.1, out: 0.5 }
const PRICE_LONG = { in: 0.5, out: 2.5 }
const LONG_FROM = 100_000
const SEARCH_USD = 0.01

// Wird waehrend des Laufs gefuellt, damit auch ein Fehler die verbrauchten Tokens kennt.
export type Usage = {
  inputTokens: number
  outputTokens: number
  searches: number
  fetches: number
  costUsd: number
}

export const emptyUsage = (): Usage => ({ inputTokens: 0, outputTokens: 0, searches: 0, fetches: 0, costUsd: 0 })

// Gibt den Antworttext zurueck; `total` traegt die Verbrauchszahlen.
export async function runClaude(prompt: string, total: Usage): Promise<string> {
  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [{ role: 'user', content: prompt }]

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const searchesLeft = MAX_SEARCHES - total.searches
    const fetchesLeft = MAX_FETCHES - total.fetches
    const capReached = searchesLeft <= 0 || fetchesLeft <= 0 || turn === MAX_TURNS - 1
    if (capReached && turn > 0) {
      messages.push({ role: 'user', content: 'Stop searching now. Answer with the JSON code block for the events you have.' })
    }

    const res = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 64000,
        output_config: { effort: 'medium' },
        tools: [
          {
            type: 'web_search_20260209',
            name: 'web_search',
            max_uses: Math.max(1, searchesLeft),
            user_location: { type: 'approximate', city: 'Leipzig', country: 'DE', timezone: 'Europe/Berlin' },
          },
          { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: Math.max(1, fetchesLeft) },
        ],
        tool_choice: capReached && turn > 0 ? { type: 'none' } : { type: 'auto' },
        messages,
      })
      .finalMessage()

    const input = res.usage.input_tokens ?? 0
    const output = res.usage.output_tokens ?? 0
    const searches = res.usage.server_tool_use?.web_search_requests ?? 0
    const p = input > LONG_FROM ? PRICE_LONG : PRICE
    total.inputTokens += input
    total.outputTokens += output
    total.searches += searches
    total.fetches += res.usage.server_tool_use?.web_fetch_requests ?? 0
    total.costUsd += (input * p.in + output * p.out) / 1e6 + searches * SEARCH_USD

    if (res.stop_reason === 'refusal') {
      throw new Error(`Claude hat abgelehnt (${res.stop_details?.category ?? 'ohne Kategorie'})`)
    }
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content })
      continue
    }
    if (res.stop_reason === 'max_tokens') throw new Error('Antwort bei max_tokens abgeschnitten')
    return res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n')
  }
  throw new Error('Keine Antwort nach der letzten Runde')
}
