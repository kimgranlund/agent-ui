// scripts/e2e-admin/flows/test-chat.ts: Test Chat flows.

import { openAdmin, pollUntil, type AdminPage } from '../admin-page.ts'
import type { AdminFlow, FlowContext } from '../runner.ts'
import { assertFlow } from '../scenario.ts'

const NOTE = 'Scripted quant note: the dashboard is ready when you are.'

/** Seeded quant persona; one note-only produce turn through Test Chat; the transcript, the wire timeline
 *  and the Context: Dialog row all show exactly that one turn. */
export const chatGreetingNote: AdminFlow = {
  name: 'chat-greeting-note',
  fixture: 'chat-greeting-note.json',
  async run({ page, wire, scenario, base }) {
    const admin = await openAdmin(page, base, scenario)
    // The seed is written by an init script before the page module resolves the active persona, so the
    // header select must already name quant (the shipped default is the first persona, croupier).
    const active = await admin.activeAgentId()
    assertFlow(active === 'quant', `active agent is "${active}", expected the seeded "quant"`)

    const since = await admin.liveTurnCount()
    assertFlow(since === 0, `liveTurnCount() is ${since} before any turn`)
    await admin.sendTestChat('hello')
    await admin.waitForTurn(since)

    const transcript = await admin.readTestTranscript()
    assertFlow(transcript.length === 2, `testChatTranscript() has ${transcript.length} entries, expected 2`)
    assertFlow(
      transcript[0]?.role === 'user' && transcript[0].content.includes('hello'),
      `first transcript entry is ${JSON.stringify(transcript[0])}, expected the user's "hello"`,
    )
    assertFlow(
      transcript[1]?.role === 'assistant' && transcript[1].content.includes(NOTE),
      `second transcript entry is ${JSON.stringify(transcript[1])}, expected the assistant note`,
    )

    const produce = wire.entries.filter((e) => e.endpoint === 'produce')
    assertFlow(produce.length === 1, `wire log holds ${produce.length} produce entries, expected 1`)
    assertFlow(produce[0]?.outcome === 'fulfilled', `produce entry outcome is ${produce[0]?.outcome}`)
    const mission = (produce[0]?.request as { builderMission?: unknown } | undefined)?.builderMission
    assertFlow(mission === false, `produce request builderMission is ${JSON.stringify(mission)}, expected false`)

    await admin.openSettingsTab('context-dialog-content')
    const rows = await admin.readDialogTurns()
    assertFlow(rows.length === 1, `Context: Dialog shows ${rows.length} context-turn rows, expected 1`)
  },
}

/** The produce entries the wire log holds, with each request's `builderMission` and `input.kind`. */
function produceEntries(wire: FlowContext['wire']): { outcome: string; mission: unknown; inputKind: unknown }[] {
  return wire.entries
    .filter((e) => e.endpoint === 'produce')
    .map((e) => {
      const body = (e.request ?? {}) as { builderMission?: unknown; input?: { kind?: unknown } }
      return { outcome: e.outcome, mission: body.builderMission, inputKind: body.input?.kind }
    })
}

/** Open the app on the seeded quant persona and send one Test Chat intent; resolves once the turn landed. */
async function openAndSend(ctx: FlowContext, text: string): Promise<AdminPage> {
  const admin = await openAdmin(ctx.page, ctx.base, ctx.scenario)
  const active = await admin.activeAgentId()
  assertFlow(active === 'quant', `active agent is "${active}", expected the seeded "quant"`)
  const since = await admin.liveTurnCount()
  await admin.sendTestChat(text)
  await admin.waitForTurn(since)
  return admin
}

/** One produce turn creates a surface (a Column root over a `Click me` Button) and it renders as a
 *  `ui-button` inside the chat pane's surface host. */
export const chatSurfaceRender: AdminFlow = {
  name: 'chat-surface-render',
  fixture: 'chat-surface-render.json',
  async run(ctx) {
    const admin = await openAndSend(ctx, 'show me a button')
    const labels = await pollUntil(
      () => admin.surfaceButtonLabels('chat'),
      (found) => found.includes('Click me'),
      'a "Click me" ui-button in the chat pane surface host',
    )
    assertFlow(labels.length === 1, `the chat pane surface hosts render ${labels.length} buttons (${JSON.stringify(labels)}), expected 1`)
    const builderLabels = await admin.surfaceButtonLabels('copilot')
    assertFlow(builderLabels.length === 0, `the Builder pane renders surface buttons ${JSON.stringify(builderLabels)}, expected none`)
    const produce = produceEntries(ctx.wire)
    assertFlow(produce.length === 1, `wire log holds ${produce.length} produce entries, expected 1`)
    // T-0016: the real page drives the strip through step mode. The runner's adapter counts the two shipped
    // lines into two output steps (opened a surface, updated it); no legacy category rows appear.
    const kinds = await pollUntil(
      () => admin.activityStepKinds('chat'),
      (found) => found.length > 0,
      'activity step rows in the chat pane strip',
    )
    assertFlow(
      kinds.length === 2 && kinds.every((k) => k === 'output'),
      `the chat strip shows activity steps ${JSON.stringify(kinds)}, expected two output steps`,
    )
  },
}

/** The surface's button click becomes a second produce turn with `input.kind: 'client'`; its update-only
 *  reply relabels the same button in the same surface host. */
export const chatClickTurn: AdminFlow = {
  name: 'chat-click-turn',
  fixture: 'chat-click-turn.json',
  async run(ctx) {
    const admin = await openAndSend(ctx, 'show me a button')
    const hostsBefore = await admin.surfaceHostCount('chat')
    assertFlow(hostsBefore === 1, `the chat pane holds ${hostsBefore} surface hosts after the first turn, expected 1`)
    const since = await admin.liveTurnCount()
    await admin.clickSurfaceButton('Click me')
    await admin.waitForTurn(since)

    const produce = produceEntries(ctx.wire)
    assertFlow(produce.length === 2, `wire log holds ${produce.length} produce entries, expected 2`)
    assertFlow(
      produce.every((e) => e.outcome === 'fulfilled'),
      `produce outcomes are ${produce.map((e) => e.outcome).join(', ')}, expected both fulfilled`,
    )
    assertFlow(produce[1]?.inputKind === 'client', `the second produce input.kind is ${JSON.stringify(produce[1]?.inputKind)}, expected "client"`)

    const labels = await pollUntil(
      () => admin.surfaceButtonLabels('chat'),
      (found) => found.includes('Round 2'),
      'the surface button to relabel to "Round 2"',
    )
    assertFlow(
      labels.length === 1 && labels[0] === 'Round 2',
      `the chat pane surface buttons read ${JSON.stringify(labels)}, expected only "Round 2" (updated in place)`,
    )
    const hostsAfter = await admin.surfaceHostCount('chat')
    assertFlow(hostsAfter === 1, `the chat pane holds ${hostsAfter} surface hosts after the click, expected the same 1`)
  },
}

/** The first turn declares an ask over its own surface; clicking the answer sends a `client` turn and the
 *  transcript records the answered round. */
export const chatAskAnswer: AdminFlow = {
  name: 'chat-ask-answer',
  fixture: 'chat-ask-answer.json',
  async run(ctx) {
    const admin = await openAndSend(ctx, 'coach me')
    await admin.answerAsk('Small')

    const produce = produceEntries(ctx.wire)
    assertFlow(produce.length === 2, `wire log holds ${produce.length} produce entries, expected 2`)
    assertFlow(produce[1]?.inputKind === 'client', `the second produce input.kind is ${JSON.stringify(produce[1]?.inputKind)}, expected "client"`)
    assertFlow(produce[1]?.mission === false, `the second produce builderMission is ${JSON.stringify(produce[1]?.mission)}, expected false`)

    const transcript = await admin.readTestTranscript()
    assertFlow(transcript.length === 4, `testChatTranscript() has ${transcript.length} entries, expected 4 (two rounds)`)
    const answered = transcript[2]
    assertFlow(
      answered?.role === 'user' && answered.content.startsWith('[surface action]') && answered.content.includes('ask-1'),
      `third transcript entry is ${JSON.stringify(answered)}, expected the surface action answering ask-1`,
    )
    assertFlow(
      transcript[3]?.role === 'assistant' && transcript[3].content.includes('Scripted answer received'),
      `fourth transcript entry is ${JSON.stringify(transcript[3])}, expected the scripted answer note`,
    )
  },
}

/** A turn that ends with `flowEnd: true` puts the page's "Flow complete" chrome row into the Test Chat log. */
export const chatFlowendChrome: AdminFlow = {
  name: 'chat-flowend-chrome',
  fixture: 'chat-flowend-chrome.json',
  async run(ctx) {
    const admin = await openAndSend(ctx, 'wrap it up')
    const transcript = await admin.readTestTranscript()
    assertFlow(
      transcript[1]?.role === 'assistant' && transcript[1].content.includes('Scripted closing note'),
      `second transcript entry is ${JSON.stringify(transcript[1])}, expected the closing note`,
    )
    // The page wrapper presents the row before the turn finishes, so a short wait is enough.
    await pollUntil(() => admin.hasFlowChrome(), (present) => present, 'the "Flow complete" chrome row in the Test Chat log', 3000)
  },
}
