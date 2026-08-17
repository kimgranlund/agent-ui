// agent-admin-debug-export.test.ts — GH #889: the dev-debug bundle's pure format, proven without the
// browser or the real `ui-agent-admin` element (the page owns wiring the live transcript accessors in;
// this file only proves `buildDebugBundle` turns a snapshot of roster + transcripts into the right entries
// and the right manifest).
import { describe, it, expect } from 'vitest'
import { createMemoryStore } from '@agent-ui/app'
import { AGENT_PRESETS, personaFromPreset } from './agent-admin-presets.ts'
import { PERSONA_FILE_KIND, readPersonaFile } from './agent-admin-persona-file.ts'
import { DEBUG_BUNDLE_VERSION, buildDebugBundle, debugBundleFileName } from './agent-admin-debug-export.ts'
import { buildZip } from '../lib/zip-writer.ts'
import { serializeCapture, parseCapture, replayTransport } from '@agent-ui/devtools'
import type { DevtoolsCapture } from '@agent-ui/devtools'

const FIXED_NOW = new Date('2026-08-14T12:34:56.000Z')

function personaFixtures(count: number) {
  return AGENT_PRESETS.slice(0, count).map((preset) => {
    const persona = personaFromPreset(preset)
    return { persona, store: createMemoryStore({ initial: persona.seed }) }
  })
}

describe('buildDebugBundle', () => {
  it('writes one agent-settings/<id>.json per roster agent, a real readable PersonaFile', () => {
    const agents = personaFixtures(3)
    const { entries } = buildDebugBundle({
      agents,
      activeAgentId: agents[0]!.persona.id,
      testChatTranscript: [],
      builderInterviewTranscript: [],
      now: FIXED_NOW,
    })
    for (const { persona } of agents) {
      const entry = entries.find((e) => e.path === `agent-settings/${persona.id}.json`)
      expect(entry).toBeDefined()
      const parsed = readPersonaFile(entry!.data as string)
      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.file.kind).toBe(PERSONA_FILE_KIND)
        expect(parsed.file.persona.label).toBe(persona.label)
      }
    }
  })

  it('writes exactly one test-chat and one builder-interview file, scoped to the ACTIVE agent only', () => {
    const agents = personaFixtures(2)
    const activeId = agents[1]!.persona.id
    const { entries, manifest } = buildDebugBundle({
      agents,
      activeAgentId: activeId,
      testChatTranscript: [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi there' }],
      builderInterviewTranscript: [{ role: 'user', content: 'build me a concierge' }],
      now: FIXED_NOW,
    })
    const testChat = entries.find((e) => e.path === `test-chat/${activeId}.json`)
    const builderInterview = entries.find((e) => e.path === `builder-interview/${activeId}.json`)
    expect(testChat).toBeDefined()
    expect(builderInterview).toBeDefined()
    expect(JSON.parse(testChat!.data as string)).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
    ])
    expect(JSON.parse(builderInterview!.data as string)).toEqual([{ role: 'user', content: 'build me a concierge' }])
    // No file for the INACTIVE agent — the transcript is element-lifetime, per-active-draft, never
    // persisted (this bundle's own scope ruling, stated in the module header).
    const inactiveId = agents[0]!.persona.id
    expect(entries.some((e) => e.path.startsWith(`test-chat/${inactiveId}`))).toBe(false)
    expect(entries.some((e) => e.path.startsWith(`builder-interview/${inactiveId}`))).toBe(false)
    expect(manifest.files.testChat).toEqual([`test-chat/${activeId}.json`])
    expect(manifest.files.builderInterview).toEqual([`builder-interview/${activeId}.json`])
  })

  it('writes EMPTY transcripts as real `[]` files, not omitted — no turns run yet is a real state', () => {
    const agents = personaFixtures(1)
    const activeId = agents[0]!.persona.id
    const { entries } = buildDebugBundle({
      agents,
      activeAgentId: activeId,
      testChatTranscript: [],
      builderInterviewTranscript: [],
      now: FIXED_NOW,
    })
    expect(JSON.parse(entries.find((e) => e.path === `test-chat/${activeId}.json`)!.data as string)).toEqual([])
    expect(JSON.parse(entries.find((e) => e.path === `builder-interview/${activeId}.json`)!.data as string)).toEqual([])
  })

  it('carries a manifest.json naming every file, the export date, the bundle version, and the agent count', () => {
    const agents = personaFixtures(4)
    const activeId = agents[2]!.persona.id
    const { entries, manifest } = buildDebugBundle({
      agents,
      activeAgentId: activeId,
      testChatTranscript: [],
      builderInterviewTranscript: [],
      now: FIXED_NOW,
    })
    const manifestEntry = entries.find((e) => e.path === 'manifest.json')
    expect(manifestEntry).toBeDefined()
    expect(JSON.parse(manifestEntry!.data as string)).toEqual(manifest)
    expect(manifest.kind).toBe('agent-ui-dev-debug-bundle')
    expect(manifest.version).toBe(DEBUG_BUNDLE_VERSION)
    expect(manifest.exportedAt).toBe(FIXED_NOW.toISOString())
    expect(manifest.agentCount).toBe(4)
    expect(manifest.activeAgentId).toBe(activeId)
    expect(manifest.files.agentSettings).toHaveLength(4)
  })

  it('produces entries that assemble into a real, readable zip (buildZip round trip)', () => {
    const agents = personaFixtures(2)
    const activeId = agents[0]!.persona.id
    const { entries } = buildDebugBundle({
      agents,
      activeAgentId: activeId,
      testChatTranscript: [{ role: 'user', content: 'ping' }],
      builderInterviewTranscript: [],
      now: FIXED_NOW,
    })
    const zip = buildZip(entries, FIXED_NOW)
    expect(zip.length).toBeGreaterThan(0)
    // A real zip's magic number, local-file-header signature, little-endian.
    expect(zip[0]).toBe(0x50)
    expect(zip[1]).toBe(0x4b)
  })
})

describe('debugBundleFileName', () => {
  it('is a stable, sortable, dated .zip name', () => {
    expect(debugBundleFileName(FIXED_NOW)).toBe('agent-ui-dev-debug-2026-08-14.zip')
  })
})

// ── the ADDITIVE captures family (ADR-0200 clause 7 / devtools-harness SPEC-R10 AC1+AC2; GH #1122 S6,
// #1129 item 5). Every pre-existing test above runs UNCHANGED with the extension in place — that green
// run IS the additive proof's first half; the legs below prove the family itself + the omitted-when-
// absent law + the capture round-trip THROUGH the bundle entry text. ────────────────────────────────────
describe('the captures family (ADR-0200 clause 7 — additive, round-tripping)', () => {
  const capture: DevtoolsCapture = {
    kind: 'agent-ui-devtools-capture',
    version: 1,
    createdAt: '2026-08-17T00:00:00.000Z',
    backend: 'replay',
    session: { turns: [] },
    timeline: [
      { seq: 0, at: 't', kind: 'turn-start', input: { kind: 'intent', text: 'x', session: { turns: [] } }, backend: 'replay' },
      { seq: 1, at: 't', kind: 'line', line: '{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}' },
      { seq: 2, at: 't', kind: 'line', line: '{"version":"v1.0","updateComponents":{"surfaceId":"s1","components":[]}}' },
      { seq: 3, at: 't', kind: 'turn-end', status: 'ok', lines: 2, ms: 0 },
    ],
  }
  const base = () => {
    const agents = personaFixtures(1)
    return { agents, activeAgentId: agents[0]!.persona.id, testChatTranscript: [], builderInterviewTranscript: [], now: FIXED_NOW } as const
  }

  it('a bundle WITHOUT captures omits the family entirely — no entries, no manifest field (v1 byte-unchanged)', () => {
    const { entries, manifest } = buildDebugBundle(base())
    expect(entries.some((e) => e.path.startsWith('captures/'))).toBe(false)
    expect('captures' in manifest.files).toBe(false)
    // the serialized manifest text carries no trace of the family — a pre-existing reader sees v1 exactly
    expect(entries.find((e) => e.path === 'manifest.json')!.data as string).not.toContain('captures')
    expect(manifest.version).toBe(DEBUG_BUNDLE_VERSION) // stays 1 — the bump rule says only consumer-MUST-know bumps
  })

  it('a bundle WITH captures writes captures/<id>.json (one per capture) and the manifest names each', () => {
    const { entries, manifest } = buildDebugBundle({ ...base(), captures: [{ id: 'cap-1', capture }] })
    const entry = entries.find((e) => e.path === 'captures/cap-1.json')
    expect(entry).toBeDefined()
    expect(manifest.files.captures).toEqual(['captures/cap-1.json'])
    // ONE format module owns serialization — the entry is serializeCapture's own bytes, nothing local
    expect(entry!.data).toBe(serializeCapture(capture))
    // the extended bundle still assembles into a real zip
    const zip = buildZip(entries, FIXED_NOW)
    expect(zip[0]).toBe(0x50)
    expect(zip[1]).toBe(0x4b)
  })

  it('SPEC-R10 AC1 through the bundle: the entry text parses back and replays a byte-identical line sequence', async () => {
    const { entries } = buildDebugBundle({ ...base(), captures: [{ id: 'cap-1', capture }] })
    const reparsed = parseCapture(entries.find((e) => e.path === 'captures/cap-1.json')!.data as string)
    expect(reparsed).toStrictEqual(capture)
    const transport = replayTransport(reparsed)
    const lines: string[] = []
    for await (const line of transport.turn({ kind: 'intent', text: 'replay', session: { turns: [] } })) lines.push(line)
    expect(lines).toEqual([
      '{"version":"v1.0","createSurface":{"surfaceId":"s1","catalogId":"agent-ui"}}',
      '{"version":"v1.0","updateComponents":{"surfaceId":"s1","components":[]}}',
    ])
  })
})
