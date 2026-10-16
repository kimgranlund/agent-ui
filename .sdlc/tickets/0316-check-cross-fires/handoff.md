---
id: T-0316
title: "Check defects D1 to D3 found by the T-0314 contract tests"
type: bug             # feature | bug | chore | spike | idea
status: ready        # proposed | ready | claimed | paused | blocked | done | dropped (build progress lives in /board)
size: L2             # L1 | L2 | L3 | L4 (L5 reserved)
priority: P2         # P1 | P2 | P3
depends: []          # T-NNNN, file:<path>, cap:<name>; e.g. [T-0002]
created: 2026-10-16
router: .sdlc/tickets/AGENTS.md  # how to claim and close this ticket
---

## Goal
Fix the three check defects `packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts` and `produce-loop-property.test.ts` (T-0314) holds in its shrink-only allowlists, and shrink each allowlist entry as it is fixed.

## Defects
- D1: `fleetSecretCheck` (`packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts:212`) reads every clickable BoardGrid with no word cue as a Battleship board, so a tic-tac-toe board gets FLEET_SECRET_MISSING (`KNOWN_CROSS_FIRES`).
- D2: on `a2ui-basic--concierge`, concierge-surface-required asks for ProductCard, Grid or DescriptionList, which that catalog lacks.
- D3 (low): the framed-choice repair tells a2ui-basic turns to drop a CardContent that catalog lacks.

## Done when
- Each defect's allowlist entry is removed and the contract tests stay green; each fix red-first; the catalog and live-agent suites and `npm run check` exit 0.

verifier: L3

## Acceptance criteria
- (red) D1, a tic-tac-toe board draws no fleet finding: `node --experimental-strip-types --input-type=module -e "import {fleetSecretCheck as k} from './packages/agent-ui/a2ui/src/catalog/hidden-state-checks.ts';import {semanticSurfaceViews as v} from './packages/agent-ui/a2ui/src/catalog/semantic-check.ts';const o=[{version:'v1.0',createSurface:{surfaceId:'ttt',catalogId:'agent-ui'}},{version:'v1.0',updateComponents:{surfaceId:'ttt',components:[{id:'root',component:'BoardGrid',rows:3,cols:3,label:'Tic-tac-toe',actionName:'mark',cells:{path:'/cells'}}]}},{version:'v1.0',updateDataModel:{surfaceId:'ttt',value:{cells:[]}}}];process.exit(k.check({surfaces:v({turns:[]},o)}).length)"`
- (red) D2, no concierge check on a2ui-basic--concierge asks for ProductCard, Grid or DescriptionList: `node --experimental-strip-types --input-type=module -e "import {readFileSync as r} from 'node:fs';import {conciergeSemanticChecks as cs} from './packages/agent-ui/a2ui/src/catalog/personas/concierge/checks.ts';import {gateChecksOnCatalog as g} from './packages/agent-ui/a2ui/src/catalog/semantic-check.ts';const j=(p)=>JSON.parse(r('packages/agent-ui/a2ui/src/catalog/'+p,'utf8')).components;const c={...j('a2ui-basic/catalog.json'),...j('personas/concierge/catalog.json')};const m=g(cs,{components:c}).flatMap((k)=>['What spa services can I book?','When do the pool and gym close?'].flatMap((i)=>k.check({surfaces:[],intent:i}))).map((f)=>f.message).join(' ');process.exit(/ProductCard|Grid|DescriptionList/.test(m)?1:0)"`
- (red) D3, the framed-choice repair names only the wrappers the surface holds: `node --experimental-strip-types --input-type=module -e "import {framedChoiceCheck as k} from './packages/agent-ui/a2ui/src/catalog/framed-choice-check.ts';import {semanticSurfaceViews as v} from './packages/agent-ui/a2ui/src/catalog/semantic-check.ts';const b=(i)=>({id:i,component:'Button',label:i,action:{event:{name:i}}});const o=[{version:'v1.0',createSurface:{surfaceId:'h',catalogId:'a2ui-basic'}},{version:'v1.0',updateComponents:{surfaceId:'h',components:[{id:'root',component:'Row',children:['c1','c2','c3']},{id:'c1',component:'Card',children:['a']},b('a'),{id:'c2',component:'Card',children:['b']},b('b'),{id:'c3',component:'Card',child:'x'},{id:'x',component:'Column',children:['t']},{id:'t',component:'Text',text:'hi'}]}}];const f=k.check({surfaces:v({turns:[]},o)});process.exit(f.length>0&&f.every((x)=>!/CardContent|CardFooter/.test(x.message))?0:1)"`
- (red) each defect's allowlist entry is gone: `! grep -qE "composite-moment-board-grid/pass fleet-secret|': D2,|': D3," packages/agent-ui/a2ui/src/live-agent/check-contracts.test.ts`
- the contract, catalog and live-agent suites are green: `npx vitest run packages/agent-ui/a2ui/src/catalog packages/agent-ui/a2ui/src/live-agent`
- `npm run check`
