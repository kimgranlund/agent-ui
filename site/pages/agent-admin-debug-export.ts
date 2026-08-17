// agent-admin-debug-export.ts — GH #889: the dev-debug bundle's PURE format (what goes in the zip and
// under what names), mirroring `agent-admin-persona-file.ts`'s split — the shape lives here, deterministically
// testable with plain data; the page (agent-admin-app.ts) owns only the browser I/O (a Blob download) and the
// live reads (the roster's stores, the active element's transcript accessors).
//
// SCOPE, ruled at build time (GH #889 Findings): "agent-settings" covers EVERY agent on the roster — each is
// a `PersonaFile` snapshot of its OWN persisted store, exactly `exportPersonaFile`'s existing per-agent
// export idiom, so this bundle carries zero new settings-serialization logic. "test-chat" and
// "builder-interview" cover the ACTIVE agent ONLY: both are `ui-agent-admin`'s own element-lifetime,
// per-draft turn arrays (`#history`/`#authoringHistory`), cleared on every real persona switch (GH #145) and
// never persisted to any store — there is no such transcript for an inactive persona to read, at export time
// or any other. This is not a narrowing of the ticket's "entire chat-log state" default; it is the actual
// shape of that state — one active session's transcripts, every agent's settings.
import type { Persona } from './agent-admin-presets.ts'
import { exportPersonaFile, personaFileText, type PersonaStateReader } from './agent-admin-persona-file.ts'
import type { ZipEntryInput } from '../lib/zip-writer.ts'
// ADR-0200 clause 7 / devtools-harness SPEC-R10 (GH #1122 S6): the bundle's ADDITIVE `captures/` family
// rides the ONE capture format module — `serializeCapture` writes each `captures/<id>.json`, never a
// second writer of the shape (ADR-0200 Consequences' one-format-module law).
import { serializeCapture } from '@agent-ui/devtools'
import type { DevtoolsCapture } from '@agent-ui/devtools'

/** The format this build writes. Bumped only if the manifest/layout shape changes in a way a consumer of
 *  the bundle would need to know about — the `PERSONA_FILE_VERSION` precedent, scoped to this bundle.
 *  The optional `captures` family (ADR-0200 clause 7) deliberately does NOT bump it: the field is
 *  additive-optional and every pre-existing reader parses v1 bundles byte-unchanged — an ignorable
 *  addition is not a consumer-MUST-know change (this constant's own bump rule, applied). */
export const DEBUG_BUNDLE_VERSION = 1

/** The transcript shape both `test-chat/*.json` and `builder-interview/*.json` files carry — `AdminTurn`'s
 *  own shape (`role`/`content`), duplicated here rather than imported so this pure lib carries no dependency
 *  on `@agent-ui/app`'s component internals — only the page (which already imports the component) reads the
 *  live values in. */
export interface DebugTranscriptTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface DebugBundleManifest {
  kind: 'agent-ui-dev-debug-bundle'
  version: number
  exportedAt: string
  agentCount: number
  activeAgentId: string
  files: {
    agentSettings: string[]
    testChat: string[]
    builderInterview: string[]
    /** ADDITIVE-optional (ADR-0200 clause 7 / SPEC-R10): present ONLY when the bundle carries devtools
     *  captures — a bundle without any is byte-identical to the pre-extension shape, so every
     *  pre-existing reader parses unchanged (the additive proof in this module's test suite). */
    captures?: string[]
  }
}

export interface DebugBundleInput {
  /** Every roster agent, paired with the store its OWN persisted state currently lives in — the same pair
   *  `exportActivePersona` reads for its single-agent export. */
  agents: readonly { persona: Persona; store: PersonaStateReader | undefined }[]
  activeAgentId: string
  /** The active draft's own test-chat transcript ("chat" pane) — empty is a real, exportable state (no
   *  turns run yet), never treated as "missing". */
  testChatTranscript: readonly DebugTranscriptTurn[]
  /** The active draft's own Builder-interview transcript ("copilot" pane) — same empty-is-real rule. */
  builderInterviewTranscript: readonly DebugTranscriptTurn[]
  /** GH #1154 — the trip-wire: how many turns the live element has actually run this session (any arm,
   *  `liveTurnCount()`). When this is > 0 and BOTH transcripts above are empty, the export is provably
   *  dropping a live session (the shipped `[]`-bundle defect) and `buildDebugBundle` THROWS instead of
   *  silently writing empty files. Omitted/0 keeps the empty-is-real rule: no turns ⇒ `[]` is the truth. */
  liveTurnCount?: number
  /** Devtools session captures to carry (ADR-0200 clause 7 — the harness/app round-trip family), each
   *  under a caller-named id (`captures/<id>.json`). Absent/empty ⇒ the family is omitted ENTIRELY
   *  (no folder, no manifest field) — the additive-optional law. */
  captures?: readonly { id: string; capture: DevtoolsCapture }[]
  now?: Date
}

/** `<agent-id>.json`, pretty-printed — the persona-file idiom (`personaFileText`) reused for every JSON
 *  family in this bundle, so a hand-opened file in any of the three folders reads the same way. */
function prettyJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

/** Build the bundle's zip entries + its manifest from a snapshot of roster + active-agent state. Pure: no
 *  Blob, no download — `buildZip` (zip-writer.ts) turns the returned entries into archive bytes, and the
 *  page wraps those in a download anchor exactly like `exportActivePersona` already does for one agent. */
export function buildDebugBundle(input: DebugBundleInput): { entries: ZipEntryInput[]; manifest: DebugBundleManifest } {
  // GH #1154 — fail LOUDLY, never write a silently-empty session: turns ran, yet neither transcript has a
  // single entry ⇒ the caller is reading a source the session never reached (the exact shipped defect —
  // `#history` was prose-arm memory while the whole session ran on the surface arm). The transcript is the
  // bundle's entire diagnostic value; an empty one here is a bug upstream, not an exportable state.
  if ((input.liveTurnCount ?? 0) > 0 && input.testChatTranscript.length === 0 && input.builderInterviewTranscript.length === 0) {
    throw new Error(
      `debug-export: ${input.liveTurnCount} live turn(s) ran this session but both transcripts are empty — ` +
        'refusing to export an empty transcript for a live session (GH #1154)',
    )
  }
  const now = input.now ?? new Date()
  const agentSettingsFiles: string[] = []
  const entries: ZipEntryInput[] = []

  for (const { persona, store } of input.agents) {
    const path = `agent-settings/${persona.id}.json`
    entries.push({ path, data: personaFileText(exportPersonaFile(persona, store, now)) })
    agentSettingsFiles.push(path)
  }

  const testChatPath = `test-chat/${input.activeAgentId}.json`
  entries.push({ path: testChatPath, data: prettyJson(input.testChatTranscript) })

  const builderInterviewPath = `builder-interview/${input.activeAgentId}.json`
  entries.push({ path: builderInterviewPath, data: prettyJson(input.builderInterviewTranscript) })

  // The ADDITIVE captures family (ADR-0200 clause 7): one `captures/<id>.json` per supplied capture,
  // serialized by the devtools format module itself. No captures ⇒ no entries AND no manifest field.
  const captureFiles: string[] = []
  for (const { id, capture } of input.captures ?? []) {
    // The id lands in a zip entry path — "../x" or "a/b" would escape the captures/ family on
    // extraction (zip-slip; S4–S6 code-checker). Fail closed on anything but a plain filename token.
    if (!/^[A-Za-z0-9._-]+$/.test(id) || id === '.' || id === '..') {
      throw new Error(`debug-export: invalid capture id ${JSON.stringify(id)} — expected [A-Za-z0-9._-]+`)
    }
    const path = `captures/${id}.json`
    entries.push({ path, data: serializeCapture(capture) })
    captureFiles.push(path)
  }

  const manifest: DebugBundleManifest = {
    kind: 'agent-ui-dev-debug-bundle',
    version: DEBUG_BUNDLE_VERSION,
    exportedAt: now.toISOString(),
    agentCount: input.agents.length,
    activeAgentId: input.activeAgentId,
    files: {
      agentSettings: agentSettingsFiles,
      testChat: [testChatPath],
      builderInterview: [builderInterviewPath],
      ...(captureFiles.length > 0 ? { captures: captureFiles } : {}),
    },
  }
  entries.push({ path: 'manifest.json', data: prettyJson(manifest) })

  return { entries, manifest }
}

/** `agent-ui-dev-debug-{ISO date}.zip` — a stable, sortable download name (no agent label to derive one
 *  from, unlike a single persona's own export). */
export function debugBundleFileName(now: Date = new Date()): string {
  return `agent-ui-dev-debug-${now.toISOString().slice(0, 10)}.zip`
}
