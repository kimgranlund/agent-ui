// genui-exclusive.test.ts — regression coverage for the real GH bug: prompting `gen-ui-live.ts` ("make a
// card game") produced genuine agent activity + a genuine note, but the render pane stayed empty. Root
// cause (traced statically — no live provider key was available in the build environment; see the
// handback): the shared system prompt ALWAYS composed the full A2UI catalog inventory + `genui-teaching.md`'s
// own "A2UI stays your default... reach for genui only when the catalog genuinely cannot express the
// shape" framing (SPEC-R10) — correct for a COEXISTENCE consumer (agent-admin, PRD §6) that can render
// both modalities, but actively misleading for `gen-ui-live.ts`, a GenUI-ONLY consumer (its own file banner:
// "deliberately NOT an A2UI page") with no A2UI rendering path at all. A model reasonably following that
// framing for a catalog-expressible request (buttons/text/score readouts) ships real, VALID A2UI JSONL —
// which a genui-only client's `readGenuiLine`-then-drop loop (SPEC-R1's own "reject whole, silently") never
// renders, never errors, and never distinguishes from "the agent said nothing." `genuiLines.length === 0`
// while `note` is defined is EXACTLY the observed symptom (the note showed; the fallback "Rendered N
// surface(s)" text did not, because it never runs when `note !== undefined`).
//
// The fix: `GenuiSurfaceConfig.exclusive` (genui-surface-config.ts) — a new, additive, default-false
// per-turn signal naming the consumer fact. `gen-ui-live.ts` now sets it; `genuiBlock` (system-prompt.ts)
// composes an explicit override paragraph when it's set. This can't be proven to change a LIVE model's
// choice deterministically (no key in this environment — see the handback) — what IS deterministically
// provable, and asserted below: (1) the mechanism reproduces exactly, with a stub provider, no live model;
// (2) the override paragraph composes into the system prompt precisely when `exclusive` is set, and (3) the
// whole config chain (site transport → chat-validation.ts boundary guard → system-prompt.ts) degrades
// byte-identically when `exclusive` is absent — every existing coexistence caller (agent-admin) unaffected.

import { describe, it, expect } from 'vitest'
import { produce } from '../agent/produce.ts'
import type { ProduceDeps } from '../agent/produce.ts'
import type { AgentProvider, TurnInput } from '../agent/agent-transport.ts'
import { readMetaLine } from '../agent/meta-line.ts'
import { readGenuiLine } from '../agent/genui-line.ts'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { validateGenuiSurface } from '../../tools/agent/dev-proxy-plugin.ts'

const intent: TurnInput = { kind: 'intent', text: 'make a card game', session: { turns: [] } }

// A stub provider that behaves EXACTLY like the reported live symptom: a note describing what it built,
// plus real, catalog-expressible A2UI (no genui line at all) — the shape a model composes when it follows
// the base teaching's "A2UI stays your default" framing literally.
const CARD_GAME_NOTE =
  "Here's a Blackjack table with dealer and player zones, card hands, scores, and action buttons. Note: " +
  "real card-flip animation, face art, and drag-to-reorder aren't available, so hands are shown as glyph tiles."
const CARD_GAME_A2UI =
  '{"version":"v1.0","createSurface":{"surfaceId":"blackjack","catalogId":"agent-ui"}}\n' +
  '{"version":"v1.0","updateComponents":{"surfaceId":"blackjack","components":[{"id":"root","component":"Button","label":"Hit","action":{"action":"submit"}}]}}'

function stubProvider(output: string): AgentProvider {
  return {
    async *stream() {
      yield output
    },
  }
}

/** The EXACT client-side shape `gen-ui-live.ts`'s `runTurn` loop uses (site/pages/gen-ui-live.ts ~L296-311):
 *  a meta-line captures `note`/`progress`; anything else is checked ONLY against `readGenuiLine` — a line
 *  that is neither is silently dropped (SPEC-R1). Reproduced inline (no site import — package-only test)
 *  so this proves the MECHANISM, not a copy that could itself drift from the real page. */
function consumeAsGenuiOnlyClient(lines: readonly string[]): { note: string | undefined; genuiLines: string[] } {
  let note: string | undefined
  const genuiLines: string[] = []
  for (const line of lines) {
    const meta = readMetaLine(line)
    if (meta) {
      if (meta.a2uiMeta.note !== undefined) note = meta.a2uiMeta.note
      continue
    }
    const envelope = readGenuiLine(line)
    if (envelope === undefined) continue // SPEC-R1 whole-line drop — real A2UI content lands here
    genuiLines.push(line)
  }
  return { note, genuiLines }
}

describe('the reported bug, reproduced deterministically: a genui-only client silently drops a real A2UI reply', () => {
  it('a model that answers "make a card game" with prose + real A2UI (no genui line) ships lines a genui-only client renders as EMPTY, despite a real note', async () => {
    const raw = `{"a2uiMeta":{"note":${JSON.stringify(CARD_GAME_NOTE)}}}\n${CARD_GAME_A2UI}`
    const deps: ProduceDeps = { provider: stubProvider(raw), retrieve: () => [], catalog: defaultCatalog }
    const lines: string[] = []
    // genuiSurface enabled (NOT exclusive) — the pre-fix `gen-ui-live.ts` call shape.
    for await (const line of produce(intent, deps, { maxRounds: 3, genuiSurface: { enabled: true } })) lines.push(line)

    const { note, genuiLines } = consumeAsGenuiOnlyClient(lines)
    expect(note).toBe(CARD_GAME_NOTE) // the chat pane DOES show a real note — matches the screenshot
    expect(genuiLines).toHaveLength(0) // the render pane gets NOTHING — matches the screenshot exactly
  })

  it('the SAME model output composes byte-identical produce() behavior whether or not exclusive is set — exclusive only changes the PROMPT the model sees on the NEXT turn, never the peel/heal/validate/stream mechanics', async () => {
    const raw = `{"a2uiMeta":{"note":${JSON.stringify(CARD_GAME_NOTE)}}}\n${CARD_GAME_A2UI}`
    const runWith = async (exclusive: boolean): Promise<string[]> => {
      const deps: ProduceDeps = { provider: stubProvider(raw), retrieve: () => [], catalog: defaultCatalog }
      const lines: string[] = []
      for await (const line of produce(intent, deps, { maxRounds: 3, genuiSurface: { enabled: true, exclusive } })) lines.push(line)
      return lines
    }
    expect(await runWith(false)).toEqual(await runWith(true))
  })
})

describe('the fix: GenuiSurfaceConfig.exclusive steers the PROMPT (system-prompt.ts genuiBlock)', () => {
  it('exclusive:true composes an explicit override naming the consumer fact — absent/false does not', () => {
    const withExclusive = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true, exclusive: true })
    const withoutExclusive = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true })
    const explicitFalse = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true, exclusive: false })

    expect(withExclusive).toContain('NO A2UI catalog renderer at all')
    // GH #425 — post-#424 the client refuses with a visible notice, not silence; wording stays truthful.
    expect(withExclusive).toContain('refuses it with a visible notice')
    expect(withoutExclusive).not.toContain('NO A2UI catalog renderer at all')
    // The degradation law (the `sourceBody`-absent precedent): exclusive:false is byte-identical to absent.
    expect(explicitFalse).toBe(withoutExclusive)
  })

  it('exclusive composes AFTER the base GENUI_TEACHING block and BEFORE a picked source body', () => {
    const sourceBody = 'A bespoke idiom: render playing cards as CSS-drawn rectangles with suit glyphs.'
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: true, exclusive: true, sourceBody })
    const teachingIdx = prompt.indexOf('## GenUI')
    const overrideIdx = prompt.indexOf('NO A2UI catalog renderer at all')
    const sourceIdx = prompt.indexOf(sourceBody)
    expect(teachingIdx).toBeGreaterThan(-1)
    expect(overrideIdx).toBeGreaterThan(teachingIdx)
    expect(sourceIdx).toBeGreaterThan(overrideIdx)
  })

  it('exclusive:true still degrades to zero genui bytes when the modality itself is off (enabled:false wins)', () => {
    const prompt = buildSystemPrompt(defaultCatalog, [], undefined, undefined, undefined, { enabled: false, exclusive: true })
    const base = buildSystemPrompt(defaultCatalog, [])
    expect(prompt).toBe(base)
  })
})

describe('validateGenuiSurface threads `exclusive` through the SAME fail-closed boundary guard both HTTP transports share', () => {
  it('accepts {enabled:true, exclusive:true}', () => {
    expect(validateGenuiSurface({ enabled: true, exclusive: true })).toEqual({ enabled: true, exclusive: true })
  })

  it('drops a non-boolean exclusive but keeps enabled/sourceBody (a per-field degrade, never the whole object)', () => {
    expect(validateGenuiSurface({ enabled: true, exclusive: 'yes' })).toEqual({ enabled: true })
    expect(validateGenuiSurface({ enabled: true, sourceBody: 'x', exclusive: 1 })).toEqual({ enabled: true, sourceBody: 'x' })
  })

  it('absent exclusive is simply absent — byte-identical to before the field existed', () => {
    expect(validateGenuiSurface({ enabled: true })).toEqual({ enabled: true })
  })
})
