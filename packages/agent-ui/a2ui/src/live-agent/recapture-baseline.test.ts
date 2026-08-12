// recapture-baseline.test.ts — the DELIBERATE golden-baseline writer (GH #748). Checked in NEXT TO
// the gate it feeds (prompt-equivalence.test.ts) so the captured shape can never drift from the
// asserted shape: whoever adds a baseline key updates BOTH files in one diff, and every consumer
// (a2ui-prompt-author's recapture step) cites THIS file's invocation instead of carrying its own
// copy of the key set — the copied 5-of-7-key scratch snippet in that skill is exactly what
// destroyed-on-use golden references are made of.
//
// Armed ONLY via the env flag — a plain `npm test` run skips it (1 skip, writes nothing):
//
//   RECAPTURE_BASELINE=1 npx vitest run --project packages \
//     packages/agent-ui/a2ui/src/live-agent/recapture-baseline.test.ts
//
// The baseline's own standing rule is unchanged: regenerate ONLY on a DELIBERATE text change —
// never to green a red gate you don't understand. On an UNCHANGED tree an armed run is a
// byte-identical no-op (a useful self-check: `git diff` after recapture should show exactly the
// delta you meant to make, nothing else).
import { describe, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { buildSystemPrompt } from '../agent/system-prompt.ts'
import { MINI_SKILLS } from '../agent/mini-skills.ts'
import { GENUI_PACKS } from '../agent/prompts/genui-packs.ts'
import { defaultCatalog } from '../catalog/default/index.ts'

const here = (import.meta as { dirname?: string }).dirname ?? dirname(fileURLToPath(import.meta.url))
const armed = process.env['RECAPTURE_BASELINE'] === '1'

describe('recapture — the deliberate golden-baseline writer (armed via RECAPTURE_BASELINE=1)', () => {
  it.skipIf(!armed)('rewrites prompt-equivalence.baseline.json in the CURRENT full shape', () => {
    // The teaching half is a straight file read — the same source loadPrompt reads (SPEC-R13(a)),
    // mirroring prompt-equivalence.test.ts's own leg exactly.
    const teaching = readFileSync(`${here}/../agent/prompts/genui-dogfood-teaching.md`, 'utf8').trim()
    writeFileSync(
      `${here}/prompt-equivalence.baseline.json`,
      `${JSON.stringify(
        {
          default: buildSystemPrompt(defaultCatalog, []),
          defaultExplicit: buildSystemPrompt(defaultCatalog, [], 'default'),
          specific: buildSystemPrompt(defaultCatalog, [], 'specific'),
          blueSky: buildSystemPrompt(defaultCatalog, [], 'blue-sky'),
          miniSkills: MINI_SKILLS.map((m) => ({ id: m.id, triggers: m.triggers, body: m.body })),
          genuiPacks: GENUI_PACKS.map((p) => ({ id: p.id, label: p.label, description: p.description, body: p.body })),
          genuiDogfoodTeaching: teaching,
        },
        null,
        2,
      )}\n`,
    )
  })
})
