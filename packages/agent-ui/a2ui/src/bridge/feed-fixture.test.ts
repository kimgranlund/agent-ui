// feed-fixture.test.ts — LLD-C5: the standing gate that keeps the committed artifact-feed fixture true.
// Test-only Node use (fs read of the committed file — the `corpus-data.test.ts` precedent); the pure
// core (`tools/pipeline/transports/a2a.ts`) stays Node-free. Re-validates the COMMITTED bytes on every
// `npm test` — the fixture's correctness authority is THIS gate, not its (dev-only) generation script.
//
// Assertions per run (LLD §6 table):
//   1. header pins 0.3.0 + v1.0
//   2. every A2A-message line validates clean against validateA2a
//   3. every a2ui-tagged DataPart carries metadata.mimeType === A2UI_MIME
//   4. per artifact surface: the unwrapped envelope sequence is validateA2ui-clean
//   5. every role:'user' message carries the HV-8 caps key, 'v1.0'-keyed, supportedCatalogIds ⊇ ['agent-ui']
//   6. byte-stability: JSON.stringify(JSON.parse(line)) === line, for every line
//   7. negative controls (in-memory mutations of a parsed line — NEVER planted into the committed file):
//      untagged DataPart · invalid a2ui payload (unknown component) · caps-less user message · wrong pin
import { describe, expect, it } from 'vitest'
// @ts-expect-error - node:fs is untyped without @types/node; vitest/node resolves it at runtime
import { readFileSync } from 'node:fs'
import { validateA2a } from '@agent-ui/a2a'
import type { A2aMessage } from '@agent-ui/a2a'
import { validateA2ui } from '../renderer/validate.ts'
import { defaultCatalog } from '../catalog/default/index.ts'
import { A2UI_MIME, unwrapTurn } from '../../tools/pipeline/transports/a2a.ts'

declare const process: { cwd(): string }

const FIXTURE_PATH = `${process.cwd()}/packages/agent-ui/a2ui/tools/pipeline/fixtures/artifact-feed.a2a.jsonl`
const PROTOCOL_VERSION = '0.3.0'

interface FeedHeader {
  a2aFeed: { protocolVersion: string; a2ui: string; provenance: { source: string; date: string } }
}

function readText(path: string): string {
  return readFileSync(path, 'utf8') as string
}

function nonBlankLines(text: string): string[] {
  return text.split('\n').filter((l) => l.trim() !== '')
}

const raw = readText(FIXTURE_PATH)
const lines = nonBlankLines(raw)
const [headerLine, ...messageLines] = lines
const header = JSON.parse(headerLine!) as FeedHeader
const messages = messageLines.map((l) => JSON.parse(l) as A2aMessage)

describe('feed fixture — header pin (LLD-C5 assertion 1, SPEC-R2)', () => {
  it('exists and is non-empty', () => {
    expect(lines.length).toBeGreaterThan(0)
  })

  it('pins protocolVersion "0.3.0" and a2ui "v1.0"', () => {
    expect(header.a2aFeed.protocolVersion).toBe(PROTOCOL_VERSION)
    expect(header.a2aFeed.a2ui).toBe('v1.0')
  })

  it('carries provenance {source, date}', () => {
    expect(header.a2aFeed.provenance.source).toBe('authored')
    expect(typeof header.a2aFeed.provenance.date).toBe('string')
  })
})

describe('feed fixture — every A2A message line validates clean (LLD-C5 assertion 2, SPEC-R6)', () => {
  for (const [i, msg] of messages.entries()) {
    it(`message line ${i + 1} (${msg.messageId}): validateA2a clean`, () => {
      expect(validateA2a(msg, { protocolVersion: PROTOCOL_VERSION })).toEqual([])
    })
  }
})

describe('feed fixture — every a2ui-tagged DataPart carries the mimeType tag (LLD-C5 assertion 3, HV-8)', () => {
  for (const [i, msg] of messages.entries()) {
    for (const part of msg.parts) {
      if (part.kind !== 'data') continue
      it(`message ${i + 1} (${msg.messageId}) data part: metadata.mimeType === A2UI_MIME`, () => {
        expect(part.metadata?.mimeType).toBe(A2UI_MIME)
      })
    }
  }
})

describe('feed fixture — per-artifact-surface envelope sequences validate clean (LLD-C5 assertion 4)', () => {
  for (const [i, msg] of messages.entries()) {
    const { envelopes } = unwrapTurn(msg)
    if (envelopes.length === 0) continue
    it(`message ${i + 1} (${msg.messageId}): unwrapped envelope sequence is validateA2ui-clean`, () => {
      const verdict = validateA2ui(envelopes, defaultCatalog)
      expect(verdict.failures).toEqual([])
      expect(verdict.valid).toBe(true)
    })
  }
})

describe('feed fixture — every user message carries the HV-8 caps key (LLD-C5 assertion 5)', () => {
  const userMessages = messages.filter((m) => m.role === 'user')

  it('the fixture has at least one user message (anti-vacuous)', () => {
    expect(userMessages.length).toBeGreaterThan(0)
  })

  for (const msg of userMessages) {
    it(`user message ${msg.messageId}: metadata.a2uiClientCapabilities is 'v1.0'-keyed with supportedCatalogIds ⊇ ['agent-ui']`, () => {
      const caps = msg.metadata?.a2uiClientCapabilities as { 'v1.0'?: { supportedCatalogIds?: string[] } } | undefined
      expect(caps?.['v1.0']?.supportedCatalogIds).toContain('agent-ui')
    })
  }
})

describe('feed fixture — byte-stability (LLD-C5 assertion 6, the house JSONL discipline)', () => {
  for (const [i, line] of lines.entries()) {
    it(`line ${i + 1}: JSON.stringify(JSON.parse(line)) === line`, () => {
      expect(JSON.stringify(JSON.parse(line))).toBe(line)
    })
  }
})

// ── negative controls (LLD-C5 assertion 7) — in-memory mutations, NEVER planted into the committed file ──
describe('feed fixture — negative controls (each MUST fail its assertion, proving the gate bites)', () => {
  const firstArtifactMessage = messages.find((m) => m.parts.some((p) => p.kind === 'data'))!
  const firstUserMessage = messages.find((m) => m.role === 'user')!

  it('an untagged a2ui DataPart (metadata.mimeType stripped) is NOT counted as an envelope', () => {
    const mutated: A2aMessage = {
      ...firstArtifactMessage,
      parts: firstArtifactMessage.parts.map((p) => (p.kind === 'data' ? { kind: 'data' as const, data: p.data } : p)),
    }
    const { envelopes, foreignParts } = unwrapTurn(mutated)
    expect(envelopes.length).toBe(0) // every part in this message WAS a data part → all now foreign
    expect(foreignParts).toBeGreaterThan(0)
  })

  it('an invalid a2ui payload (unknown component type) FAILS validateA2ui', () => {
    const { envelopes } = unwrapTurn(firstArtifactMessage)
    const poisoned = envelopes.map((e) =>
      'updateComponents' in e
        ? { ...e, updateComponents: { ...e.updateComponents, components: [{ id: 'root', component: 'Chart' }] } }
        : e,
    )
    const verdict = validateA2ui(poisoned, defaultCatalog)
    expect(verdict.valid).toBe(false)
    expect(verdict.failures.length).toBeGreaterThan(0)
  })

  it('a caps-less user message (metadata stripped) FAILS the assertion 5 check', () => {
    const capsLess = { ...firstUserMessage, metadata: undefined }
    const caps = capsLess.metadata as { 'v1.0'?: { supportedCatalogIds?: string[] } } | undefined
    expect(caps?.['v1.0']?.supportedCatalogIds).toBeUndefined()
  })

  it('a wrong protocolVersion pin FAILS validateA2a with A2A_PIN', () => {
    // The committed message lines carry no protocolVersion field themselves (bare messages are
    // version-silent, LLD §3) — mint a synthetic artifact carrying an unsupported pin to prove the SAME
    // `validateA2a` this gate runs (assertion 2) actually enforces SPEC-R2 when a pin IS present.
    const wrongPin = { ...firstArtifactMessage, protocolVersion: '9.9.9' }
    const failures = validateA2a(wrongPin, { protocolVersion: PROTOCOL_VERSION })
    expect(failures.some((f) => f.code === 'A2A_PIN')).toBe(true)
  })
})
