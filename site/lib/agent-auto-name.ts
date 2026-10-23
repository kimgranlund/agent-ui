// site/lib/agent-auto-name.ts (T-0413): a freshly created agent's suggested name and tagline. On the person's
// first Builder message the page fires one small Haiku call beside the Builder turn and writes the reply into
// the fields the person has not touched. The call rides the existing `/__a2ui/agent/chat` arm, so the key and
// the provider stay on the server (ADR-0073); `?purpose=name` changes no routing and only labels the call for
// the keyless e2e harness. Every failure keeps the agent's current values, silently.
import type { ModelSettings } from '@agent-ui/a2ui/agent/model-capabilities'

export const NAMING_MODEL = 'claude-haiku-5-5'
export const NAMING_EFFORT = 'low' as const
export const NAMING_MODEL_SETTINGS: ModelSettings = { thinking: 'disabled', maxTokens: 200 }
export const NAMING_TIMEOUT_MS = 8_000
export const NAMING_ENDPOINT = '/__a2ui/agent/chat?purpose=name'
export const NAMING_INPUT_CAP = 2_000
export const NAMING_SYSTEM_PROMPT =
  'You name AI agents. The user describes an agent they want. Reply with only a JSON object and nothing else: ' +
  '{"name": "...", "tagline": "..."}. name: 1 to 3 words in Title Case, no quotes or emoji. ' +
  'tagline: one plain sentence under 100 characters saying what the agent does. Never use an em dash.'

const NAME_MAX_WORDS = 3
const NAME_MAX_CHARS = 32
const TAGLINE_MAX_CHARS = 120

export interface NameSuggestion {
  name: string
  tagline: string
}

/** The name and tagline an agent was minted with. */
export type AgentIdentity = NameSuggestion

/** One field of a reply, trimmed with inner whitespace collapsed; `undefined` when it is not a usable
 *  single line (empty, a newline, an em or en dash). */
function cleanField(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\r\n\u2013\u2014]/.test(value)) return undefined
  const clean = value.trim().replace(/\s+/g, ' ')
  return clean === '' ? undefined : clean
}

/** Read the model's reply. All or nothing: a reply that breaks any rule yields `undefined`. */
export function parseNameSuggestion(text: string): NameSuggestion | undefined {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) return undefined
  let raw: unknown
  try {
    raw = JSON.parse(text.slice(start, end + 1))
  } catch {
    return undefined
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const { name: rawName, tagline: rawTagline } = raw as { name?: unknown; tagline?: unknown }
  const name = cleanField(rawName)
  const tagline = cleanField(rawTagline)
  if (name === undefined || tagline === undefined) return undefined
  if (name.split(' ').length > NAME_MAX_WORDS || name.length > NAME_MAX_CHARS) return undefined
  if (tagline.length > TAGLINE_MAX_CHARS) return undefined
  return { name, tagline }
}

export interface AutoNameTrigger {
  /** Remember an agent's minted identity; its first Builder message may name it. */
  arm(id: string, minted: AgentIdentity): void
  /** Consume the agent's entry (so it fires once) and return the minted identity when the current name
   *  and tagline still equal it, else `undefined`. */
  take(id: string, current: { name: unknown; tagline: unknown }): AgentIdentity | undefined
}

/** The once-per-agent trigger. In memory on purpose: the Builder only runs over an agent the page has just
 *  minted, and the interview never survives a reload. */
export function createAutoNameTrigger(): AutoNameTrigger {
  const armed = new Map<string, AgentIdentity>()
  return {
    arm(id, minted) {
      armed.set(id, { ...minted })
    },
    take(id, current) {
      const minted = armed.get(id)
      armed.delete(id)
      if (minted === undefined || current.name !== minted.name || current.tagline !== minted.tagline) return undefined
      return minted
    },
  }
}

/** The fields a landed suggestion may write: only a field still equal to its minted value, and never a name
 *  another agent already has (`takenLabels` holds the other agents' labels). */
export function fieldsToApply(
  minted: AgentIdentity,
  current: { name: unknown; tagline: unknown },
  suggestion: NameSuggestion,
  takenLabels: ReadonlySet<string>,
): Partial<NameSuggestion> {
  const out: Partial<NameSuggestion> = {}
  if (current.name === minted.name && suggestion.name !== minted.name && !takenLabels.has(suggestion.name)) out.name = suggestion.name
  if (current.tagline === minted.tagline && suggestion.tagline !== minted.tagline) out.tagline = suggestion.tagline
  return out
}

/** Ask the server's chat arm for a name and tagline. Never throws: a non-ok answer, a network error, the
 *  timeout or an unusable reply all resolve `undefined`. */
export async function requestNameSuggestion(
  text: string,
  opts: { fetch?: typeof fetch; timeoutMs?: number } = {},
): Promise<NameSuggestion | undefined> {
  const message = text.trim().slice(0, NAMING_INPUT_CAP)
  if (message === '') return undefined
  const send = opts.fetch ?? fetch
  try {
    const res = await send(NAMING_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system: NAMING_SYSTEM_PROMPT,
        model: NAMING_MODEL,
        messages: [{ role: 'user', content: message }],
        effort: NAMING_EFFORT,
        modelSettings: NAMING_MODEL_SETTINGS,
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? NAMING_TIMEOUT_MS),
    })
    if (!res.ok) return undefined
    const body = (await res.json()) as { text?: unknown }
    return typeof body.text === 'string' ? parseNameSuggestion(body.text) : undefined
  } catch {
    return undefined
  }
}
