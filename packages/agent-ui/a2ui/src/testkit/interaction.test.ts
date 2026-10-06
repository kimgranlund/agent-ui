// interaction.test.ts: the closed loop over a mounted renderer in jsdom (tools/testkit/interaction.ts,
// T-0011): click, action, nextTurn framing, scripted reply, updateDataModel, re-render; plus the loop's own
// reds (unresolved binding, unconsumed turn, out-of-order meta-line) and the wantResponse:false rule.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { armOffline } from '../../tools/testkit/offline.ts'
import { runScenario } from '../../tools/testkit/interaction.ts'
import { resolveKitCatalog } from '../../tools/testkit/catalogs.ts'
import { parseScenarioDoc } from '../../tools/testkit/scenario.ts'
import { nextTurn } from '../agent/session.ts'

let disarm: () => void
beforeAll(() => {
  disarm = armOffline()
})
afterAll(() => disarm())

const env = { resolveCatalog: resolveKitCatalog }
const codes = (r: { findings: { code: string }[] }) => r.findings.map((f) => f.code)
const create = (extra: Record<string, unknown> = {}) => ({ version: 'v1.0', createSurface: { surfaceId: 's', catalogId: 'agent-ui', ...extra } })
const update = (components: unknown[]) => ({ version: 'v1.0', updateComponents: { surfaceId: 's', components } })
const data = (value: unknown, path?: string) => ({ version: 'v1.0', updateDataModel: { surfaceId: 's', ...(path !== undefined ? { path } : {}), value } })
const scenario = (turns: unknown[], name = 'loop') =>
  parseScenarioDoc({ kind: 'agent-ui-a2ui-scenario', version: 1, name, catalogId: 'agent-ui', intent: 'greet me', turns })

const greeting = (action: Record<string, unknown>) => [
  create(),
  update([
    { id: 'root', component: 'Column', children: ['label', 'go'] },
    { id: 'label', component: 'Text', text: { path: '/greeting' } },
    { id: 'go', component: 'Button', label: 'Refresh', action },
  ]),
  data({ greeting: 'hello' }),
]

describe('runScenario: the click loop', () => {
  it('click -> one action -> nextTurn frames it -> scripted updateDataModel -> the bound text re-renders', async () => {
    const r = await runScenario(scenario([
      {
        respond: { lines: greeting({ action: 'refresh' }) },
        expect: {
          tree: [{ surfaceId: 's', select: 'ui-text', count: 1, textIncludes: 'hello' }],
          dataModel: [{ surfaceId: 's', path: '/greeting', equals: 'hello' }],
          clientMessages: [{ action: { name: 'refresh', surfaceId: 's', sourceComponentId: 'go', actionId: 'kit-action-1' } }],
        },
        act: { click: { surfaceId: 's', select: 'ui-button' } },
      },
      {
        match: { inputKind: 'client', actionName: 'refresh' },
        respond: { lines: [data('updated', '/greeting')] },
        expect: { tree: [{ surfaceId: 's', select: 'ui-text', textIncludes: 'updated' }], dataModel: [{ surfaceId: 's', path: '/greeting', equals: 'updated' }] },
      },
    ]), env)
    expect(r.findings).toEqual([])
    // The framing the loop used is the real reducer's: a client turn carrying the action.
    const action = { version: 'v1.0', action: { surfaceId: 's', actionId: 'kit-action-1', name: 'refresh', sourceComponentId: 'go', timestamp: 't', context: {} } }
    expect(nextTurn({ turns: [] }, action)).toEqual({ kind: 'client', message: action, session: { turns: [] } })
  })

  it('a wrong expectation reds: the stale text after the reply is TREE_MISMATCH', async () => {
    const r = await runScenario(scenario([
      { respond: { lines: greeting({ action: 'refresh' }) }, act: { click: { surfaceId: 's', select: 'ui-button' } } },
      { respond: { lines: [data('updated', '/greeting')] }, expect: { tree: [{ surfaceId: 's', select: 'ui-text', textIncludes: 'hello' }] } },
    ]), env)
    expect(codes(r)).toEqual(['TREE_MISMATCH'])
  })

  it('an action with wantResponse: false runs no turn; its twin without the flag pulls one (SCRIPT_EXHAUSTED)', async () => {
    const quiet = await runScenario(scenario([{ respond: { lines: greeting({ action: 'dismiss', wantResponse: false }) }, act: { click: { surfaceId: 's', select: 'ui-button' } } }]), env)
    expect(quiet.findings).toEqual([])
    const loud = await runScenario(scenario([{ respond: { lines: greeting({ action: 'dismiss' }) }, act: { click: { surfaceId: 's', select: 'ui-button' } } }]), env)
    expect(codes(loud)).toEqual(['SCRIPT_EXHAUSTED'])
  })

  it('a second turn with no intent that no act reaches yields SCRIPT_UNCONSUMED', async () => {
    const r = await runScenario(scenario([{ respond: { lines: greeting({ action: 'refresh' }) } }, { respond: { lines: [data('never', '/greeting')] } }]), env)
    expect(codes(r)).toEqual(['SCRIPT_UNCONSUMED'])
    expect(r.findings[0]!.path).toBe('$.turns[1]')
  })

  it('a binding to an unset path under expect.bindings yields BINDING_UNRESOLVED; allow exempts it', async () => {
    const lines = [create(), update([{ id: 'root', component: 'Text', text: { path: '/missing/name' } }])]
    const red = await runScenario(scenario([{ respond: { lines }, expect: { bindings: {} } }]), env)
    expect(red.findings).toEqual([{ layer: 'renderer', code: 'BINDING_UNRESOLVED', path: '/missing/name', detail: 's/root.text' }])
    const allowed = await runScenario(scenario([{ respond: { lines }, expect: { bindings: { allow: ['/missing/name'] } } }]), env)
    expect(allowed.findings).toEqual([])
    const unchecked = await runScenario(scenario([{ respond: { lines } }]), env)
    expect(unchecked.findings).toEqual([])
  })

  it('setValue on a TextField, then a click, on a sendDataModel surface: the action carries the committed value', async () => {
    const r = await runScenario(scenario([
      {
        respond: {
          lines: [
            create({ sendDataModel: true }),
            update([
              { id: 'root', component: 'Column', children: ['name', 'save'] },
              { id: 'name', component: 'TextField', label: 'Name', value: { path: '/name' } },
              { id: 'save', component: 'Button', label: 'Save', action: { action: 'save', wantResponse: false } },
            ]),
            data({ name: '' }),
          ],
        },
        act: { setValue: { surfaceId: 's', select: 'ui-text-field', prop: 'value', event: 'change', value: 'Ada' } },
      },
      {
        intent: 'now save',
        respond: { lines: [] },
        expect: { clientMessages: [{ action: { name: 'save', dataModel: { name: 'Ada' } } }] },
        act: { click: { surfaceId: 's', select: 'ui-button' } },
      },
    ]), env)
    expect(r.findings).toEqual([])
  })

  it('an out-of-order meta-line yields ORDER_CONTENT_BEFORE_META', async () => {
    const r = await runScenario(scenario([{ respond: { lines: [...greeting({ action: 'refresh' }), { a2uiMeta: { note: 'late' } }] } }]), env)
    expect(codes(r)).toEqual(['ORDER_CONTENT_BEFORE_META'])
  })
})
