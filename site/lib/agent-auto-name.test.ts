// agent-auto-name.test.ts (T-0413): the new agent's suggested name and tagline. The trigger rule, the reply
// parser, the apply rule and the side call's request shape. `fetch` is stubbed: no network, no key.
import { describe, expect, it, vi } from 'vitest'
import { capabilitiesFor, validateModelSettings } from '@agent-ui/a2ui/agent/model-capabilities'
import {
  NAMING_EFFORT,
  NAMING_ENDPOINT,
  NAMING_INPUT_CAP,
  NAMING_MODEL,
  NAMING_MODEL_SETTINGS,
  NAMING_SYSTEM_PROMPT,
  createAutoNameTrigger,
  fieldsToApply,
  parseNameSuggestion,
  requestNameSuggestion,
} from './agent-auto-name.ts'

const MINTED = { name: 'New agent', tagline: 'A freshly minted agent, ready to configure.' }
const SUGGESTION = { name: 'Brush Buddy', tagline: 'Coaches you through two minutes of brushing.' }

describe('createAutoNameTrigger', () => {
  it('fires once for an armed agent whose name and tagline are still the minted ones', () => {
    const trigger = createAutoNameTrigger()
    trigger.arm('new', MINTED)
    expect(trigger.take('new', { ...MINTED })).toEqual(MINTED)
    expect(trigger.take('new', { ...MINTED })).toBeUndefined()
  })

  it('skips an agent it never armed (a preset or an older agent)', () => {
    const trigger = createAutoNameTrigger()
    trigger.arm('new', MINTED)
    expect(trigger.take('concierge', { name: 'Concierge', tagline: 'Hotel help.' })).toBeUndefined()
  })

  it('skips when the person already edited the name or the tagline, and consumes the entry anyway', () => {
    const trigger = createAutoNameTrigger()
    trigger.arm('a', MINTED)
    trigger.arm('b', MINTED)
    expect(trigger.take('a', { ...MINTED, name: 'My Coach' })).toBeUndefined()
    expect(trigger.take('b', { ...MINTED, tagline: 'Mine.' })).toBeUndefined()
    expect(trigger.take('a', { ...MINTED })).toBeUndefined()
    expect(trigger.take('b', { ...MINTED })).toBeUndefined()
  })

  it('compares against the minted values exactly, so a collision-suffixed name still fires', () => {
    const trigger = createAutoNameTrigger()
    const minted = { ...MINTED, name: 'New agent 2' }
    trigger.arm('new-2', minted)
    expect(trigger.take('new-2', { ...minted })).toEqual(minted)
  })
})

describe('parseNameSuggestion', () => {
  it('reads a plain JSON reply', () => {
    expect(parseNameSuggestion(JSON.stringify(SUGGESTION))).toEqual(SUGGESTION)
  })

  it('accepts a fenced reply and prose around the object', () => {
    expect(parseNameSuggestion('```json\n' + JSON.stringify(SUGGESTION) + '\n```')).toEqual(SUGGESTION)
    expect(parseNameSuggestion('Here you go: ' + JSON.stringify(SUGGESTION))).toEqual(SUGGESTION)
  })

  it('normalizes whitespace', () => {
    expect(parseNameSuggestion('{"name":"  Brush   Buddy ","tagline":"  Coaches you.  "}')).toEqual({ name: 'Brush Buddy', tagline: 'Coaches you.' })
  })

  it('rejects malformed JSON, a non-object and a missing or empty field', () => {
    for (const text of ['', 'not json', '{"name": "Brush Buddy",', '["Brush Buddy"]', '"Brush Buddy"', '{"name":"Brush Buddy"}', '{"tagline":"Coaches you."}', '{"name":"","tagline":"Coaches you."}', '{"name":"Brush Buddy","tagline":"   "}', '{"name":7,"tagline":"Coaches you."}']) {
      expect(parseNameSuggestion(text), text).toBeUndefined()
    }
  })

  it('rejects a name over 3 words or 32 characters and a tagline over 120 characters', () => {
    expect(parseNameSuggestion(JSON.stringify({ ...SUGGESTION, name: 'The Very Best Brush' }))).toBeUndefined()
    expect(parseNameSuggestion(JSON.stringify({ ...SUGGESTION, name: 'Toothbrushingcoachextraordinaire' + 'x' }))).toBeUndefined()
    expect(parseNameSuggestion(JSON.stringify({ ...SUGGESTION, tagline: 'x'.repeat(121) }))).toBeUndefined()
    expect(parseNameSuggestion(JSON.stringify({ ...SUGGESTION, tagline: 'x'.repeat(120) }))?.tagline).toHaveLength(120)
  })

  it('rejects a newline or an em or en dash in either field', () => {
    for (const bad of [
      { ...SUGGESTION, name: 'Brush\nBuddy' },
      { ...SUGGESTION, tagline: 'Coaches you.\nTwice a day.' },
      { ...SUGGESTION, name: 'Brush\u2014Buddy' },
      { ...SUGGESTION, tagline: 'Coaches you \u2014 twice a day.' },
      { ...SUGGESTION, tagline: 'Coaches you \u2013 twice a day.' },
    ]) {
      expect(parseNameSuggestion(JSON.stringify(bad)), JSON.stringify(bad)).toBeUndefined()
    }
  })
})

describe('fieldsToApply', () => {
  it('writes both fields while both are still the minted ones', () => {
    expect(fieldsToApply(MINTED, { ...MINTED }, SUGGESTION, new Set())).toEqual(SUGGESTION)
  })

  it('skips a field the person edited while the call was in flight', () => {
    expect(fieldsToApply(MINTED, { ...MINTED, name: 'My Coach' }, SUGGESTION, new Set())).toEqual({ tagline: SUGGESTION.tagline })
    expect(fieldsToApply(MINTED, { ...MINTED, tagline: 'Mine.' }, SUGGESTION, new Set())).toEqual({ name: SUGGESTION.name })
  })

  it('skips a name another agent already has, and keeps the tagline', () => {
    expect(fieldsToApply(MINTED, { ...MINTED }, SUGGESTION, new Set(['Concierge', 'Brush Buddy']))).toEqual({ tagline: SUGGESTION.tagline })
  })
})

describe('requestNameSuggestion', () => {
  const ok = (text: string): Response => new Response(JSON.stringify({ text }), { status: 200, headers: { 'content-type': 'application/json' } })

  it('posts the fixed prompt to the labelled chat endpoint with the Haiku row and a capped message', async () => {
    const fetchStub = vi.fn(async () => ok(JSON.stringify(SUGGESTION)))
    const long = 'make a toothbrushing coach agent ' + 'x'.repeat(NAMING_INPUT_CAP)
    expect(await requestNameSuggestion(long, { fetch: fetchStub as unknown as typeof fetch })).toEqual(SUGGESTION)
    expect(fetchStub).toHaveBeenCalledTimes(1)
    const [url, init] = fetchStub.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/__a2ui/agent/chat?purpose=name')
    expect(url).toBe(NAMING_ENDPOINT)
    expect(init.method).toBe('POST')
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const body = JSON.parse(init.body as string) as Record<string, unknown>
    expect(body).toEqual({
      system: NAMING_SYSTEM_PROMPT,
      model: 'claude-haiku-5-5',
      messages: [{ role: 'user', content: long.slice(0, NAMING_INPUT_CAP) }],
      effort: 'low',
      modelSettings: { thinking: 'disabled', maxTokens: 200 },
    })
  })

  it('returns undefined on a non-ok answer, a rejected fetch, a malformed body or an unusable reply', async () => {
    const cases: (() => Promise<Response>)[] = [
      async () => new Response(JSON.stringify({ error: 'no-key' }), { status: 503 }),
      async () => {
        throw new TypeError('network down')
      },
      async () => new Response('not json', { status: 200 }),
      async () => new Response(JSON.stringify({ reply: 'x' }), { status: 200 }),
      async () => ok('I would call it Brush Buddy.'),
    ]
    for (const impl of cases) {
      await expect(requestNameSuggestion('make a coach', { fetch: vi.fn(impl) as unknown as typeof fetch })).resolves.toBeUndefined()
    }
  })

  it('gives up silently when the reply outlasts the timeout', async () => {
    const hang = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
        }),
    )
    await expect(requestNameSuggestion('make a coach', { fetch: hang as unknown as typeof fetch, timeoutMs: 10 })).resolves.toBeUndefined()
  })

  it('makes no call for an empty message', async () => {
    const fetchStub = vi.fn(async () => ok(JSON.stringify(SUGGESTION)))
    expect(await requestNameSuggestion('   ', { fetch: fetchStub as unknown as typeof fetch })).toBeUndefined()
    expect(fetchStub).not.toHaveBeenCalled()
  })
})

describe('the naming call settings', () => {
  it('names a model with a capability row that takes thinking off at low effort', () => {
    expect(NAMING_MODEL).toBe('claude-haiku-5-5')
    expect(capabilitiesFor(NAMING_MODEL)).toBeDefined()
    expect(validateModelSettings(NAMING_MODEL, NAMING_MODEL_SETTINGS, NAMING_EFFORT)).toEqual([])
  })

  it('keeps the prompt short and free of em dashes', () => {
    expect(NAMING_SYSTEM_PROMPT.length).toBeLessThan(500)
    expect(NAMING_SYSTEM_PROMPT).not.toMatch(/[\u2014\u2013]/)
  })
})
