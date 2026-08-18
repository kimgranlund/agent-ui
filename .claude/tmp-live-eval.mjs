// TEMPORARY live eval for GH #1200 (backable wizard) + GH #1202 (settled receipt at close) — deleted after.
import { proxyTransport } from '@agent-ui/devtools'
import { appendAssistantTurn, appendUserTurn } from '@agent-ui/a2ui/agent'

const transport = proxyTransport({ url: 'http://localhost:5173/__a2ui/agent', provider: 'anthropic', model: 'claude-sonnet-5' })
let session = { turns: [] }
const turns = []

async function runTurn(text) {
  session = appendUserTurn(session, text)
  const lines = []
  for await (const line of transport.turn({ kind: 'intent', text, session })) lines.push(line)
  session = appendAssistantTurn(session, lines.join('\n'))
  turns.push({ text, lines })
  return lines
}

const kinds = (lines) => lines.map((l) => { try { const o = JSON.parse(l); return Object.keys(o).filter((k) => k !== 'version')[0] } catch { return '?' } })
const surfaceIds = (lines) => [...new Set(lines.map((l) => { try { const o = JSON.parse(l); return (o.createSurface||o.updateComponents||o.updateDataModel||o.deleteSurface||{}).surfaceId } catch { return undefined } }).filter(Boolean))]

// GH #1200 — backable 3-step wizard: book a hotel room (the refreshed booking-flow playbook shape)
console.log('== T1: start booking')
const t1 = await runTurn('I want to book a room: check-in tomorrow, 2 nights, just me.')
console.log('kinds:', kinds(t1).join(','), '| surfaces:', surfaceIds(t1).join(','))

console.log('== T2: advance (Next-equivalent: give room preference)')
const t2 = await runTurn('The Garden King room looks right. Next.')
console.log('kinds:', kinds(t2).join(','), '| surfaces:', surfaceIds(t2).join(','))
const created2 = t2.filter((l) => l.includes('"createSurface"')).length
console.log('REUSE CHECK — new surfaces on step 2 (0 = reuse law held):', created2)

console.log('== T3: go BACK')
const t3 = await runTurn('Actually go back — change the dates to check in two days from now instead.')
console.log('kinds:', kinds(t3).join(','), '| surfaces:', surfaceIds(t3).join(','))
const created3 = t3.filter((l) => l.includes('"createSurface"')).length
console.log('BACK CHECK — new surfaces on back-step (0 = reuse held):', created3)

console.log('== T4: confirm')
const t4 = await runTurn('Yes, confirm the booking with those new dates.')
console.log('kinds:', kinds(t4).join(','))

console.log('== T5: final confirm commit (if T4 presented the summary ask)')
const t5 = await runTurn('Confirmed — book it.')
const k5 = kinds(t5)
console.log('kinds:', k5.join(','))
const closing = t5[t5.length - 1] || ''
const hasFlowEnd = t5.some((l) => l.includes('"flowEnd":true') || l.includes('"flowEnd": true'))
const settleUpdates = t5.filter((l) => l.includes('"updateComponents"')).length
console.log('\n== VERDICTS ==')
console.log('#1202 SETTLE — closing turn carries exactly ONE updateComponents:', settleUpdates, '(want 1, or 0 if settle rode T4)')
console.log('#1202/#1101 flowEnd on close:', hasFlowEnd)
const t4settles = t4 ? turns[3].lines.filter((l) => l.includes('"updateComponents"')).length : 0
console.log('T4 updateComponents count (context):', t4settles)
console.log('FINAL LINE:', closing.slice(0, 400))
console.log('\n== T4 deep ==')
const t4l = turns[3].lines
console.log('T4 flowEnd:', t4l.some((l)=>l.includes('"flowEnd"')))
const t4u = t4l.find((l)=>l.includes('"updateComponents"'))
console.log('T4 update:', (t4u||'').slice(0, 500))
const t4note = t4l.filter((l)=>l.includes('"note"')).pop()
console.log('T4 note:', (t4note||'').slice(0, 300))
