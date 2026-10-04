// facets.fixture.ts: the ADR-0231 test fixtures, one conforming `multi-turn` record and one conforming
// `repair` record against the agent-ui catalog, shared by `record.test.ts`, `admit.test.ts` and
// `corpus-data.test.ts` (the per-facet legs build their fixture shards from these through `admit()`).
// Test support only: never re-exported from the corpus barrel, never read by shipped code.

import type { A2uiActionMessage, A2uiOutput, Failure } from '../protocol.ts'
import type { CorpusRecord } from './record.ts'

const SID = 'login'

/** Turn 1: a sign-in card with a status line bound to the data model and two action buttons. */
export const LOGIN_PRIOR: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: SID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: SID,
      components: [
        { id: 'root', component: 'Column', children: ['status', 'submit', 'cancel'] },
        { id: 'status', component: 'Text', text: { path: '/status' } },
        { id: 'submit', component: 'Button', label: 'Sign in', action: { action: 'login_submit' } },
        { id: 'cancel', component: 'Button', label: 'Cancel', action: { action: 'login_cancel' } },
      ],
    },
  },
  { version: 'v1.0', updateDataModel: { surfaceId: SID, value: { status: 'Signed out' } } },
]

/** The client turn: the user pressed "Sign in". */
export const LOGIN_ACTION: A2uiActionMessage = {
  version: 'v1.0',
  action: {
    surfaceId: SID,
    actionId: 'act-0001',
    name: 'login_submit',
    sourceComponentId: 'submit',
    timestamp: '2026-10-04T09:00:00.000Z',
    context: {},
  },
}

/** Turn 2: an update-only follow-up on the live surface (no `root` resend). */
export const LOGIN_FOLLOW_UP: A2uiOutput = [
  { version: 'v1.0', updateDataModel: { surfaceId: SID, path: '/status', value: 'Signed in' } },
  {
    version: 'v1.0',
    updateComponents: { surfaceId: SID, components: [{ id: 'submit', component: 'Button', label: 'Signed in', disabled: true, action: { action: 'login_submit' } }] },
  },
]

/** A conforming multi-turn record (ADR-0231 cl.2). `overrides` replace whole top-level fields. */
export function multiTurnRecord(overrides: Partial<CorpusRecord> = {}): CorpusRecord {
  return {
    name: 'mt-login-submit',
    description: 'acknowledge a sign-in submit on the live login card',
    promptText: 'the user pressed sign in on the login card; acknowledge it',
    priorOutput: LOGIN_PRIOR,
    clientInput: [LOGIN_ACTION],
    a2uiOutput: LOGIN_FOLLOW_UP,
    meta: {
      facet: 'multi-turn',
      protocolVersion: 'v1.0',
      catalogId: 'agent-ui',
      provenance: { source: 'authored', origin: 'src/corpus/facets.fixture.ts' },
      status: 'valid',
    },
    ...overrides,
  }
}

const FIX_SID = 'greeting'

/** The broken stream: `root` lists a child id no component defines (a dangling reference). */
export const DANGLING_CHILD_INPUT: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: FIX_SID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: FIX_SID,
      components: [
        { id: 'root', component: 'Column', children: ['title', 'subtitle'] },
        { id: 'title', component: 'Text', text: 'Welcome back' },
      ],
    },
  },
]

/** What `validateA2ui(DANGLING_CHILD_INPUT, agent-ui, undefined, { atFinalize: true })` reports. */
export const DANGLING_CHILD_ERRORS: Failure[] = [{ code: 'IDGRAPH', path: 'root->subtitle' }]

/** The corrected stream: the missing child is delivered, nothing else changes. */
export const DANGLING_CHILD_FIXED: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: FIX_SID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: FIX_SID,
      components: [
        { id: 'root', component: 'Column', children: ['title', 'subtitle'] },
        { id: 'title', component: 'Text', text: 'Welcome back' },
        { id: 'subtitle', component: 'Text', text: 'Pick up where you left off' },
      ],
    },
  },
]

/** A second breakage of the same card (the title never arrived): the same corrected tree reached from a
 * different breakage, the ADR-0231 cl.3 "distinct pair" case. */
export const MISSING_TITLE_INPUT: A2uiOutput = [
  { version: 'v1.0', createSurface: { surfaceId: FIX_SID, catalogId: 'agent-ui' } },
  {
    version: 'v1.0',
    updateComponents: {
      surfaceId: FIX_SID,
      components: [
        { id: 'root', component: 'Column', children: ['title', 'subtitle'] },
        { id: 'subtitle', component: 'Text', text: 'Pick up where you left off' },
      ],
    },
  },
]

/** What `validateA2ui(MISSING_TITLE_INPUT, agent-ui, undefined, { atFinalize: true })` reports. */
export const MISSING_TITLE_ERRORS: Failure[] = [{ code: 'IDGRAPH', path: 'root->title' }]

/** A conforming repair record (ADR-0231 cl.3). `overrides` replace whole top-level fields. */
export function repairRecord(overrides: Partial<CorpusRecord> = {}): CorpusRecord {
  return {
    name: 'rp-dangling-child',
    description: 'deliver the child component the root already references',
    promptText: 'a welcome card whose subtitle never rendered',
    invalidInput: DANGLING_CHILD_INPUT,
    validatorErrors: DANGLING_CHILD_ERRORS,
    a2uiOutput: DANGLING_CHILD_FIXED,
    meta: {
      facet: 'repair',
      protocolVersion: 'v1.0',
      catalogId: 'agent-ui',
      provenance: { source: 'authored', origin: 'src/corpus/facets.fixture.ts' },
      status: 'valid',
    },
    ...overrides,
  }
}
