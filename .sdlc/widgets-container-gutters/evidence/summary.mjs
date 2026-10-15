// usage: node summary.mjs before [after]  -> compact table
import { readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const OUT = dirname(fileURLToPath(import.meta.url))
for (const label of process.argv.slice(2)) {
  const d = JSON.parse(readFileSync(`${OUT}/${label}.json`, 'utf8'))
  console.log(`##### ${label}`)
  for (const [n, v] of Object.entries(d)) {
    console.log(`== ${n}: surface ${v.surfaceContentW} root ${v.rootTag} widgetW ${v.widgetW} pad ${v.widgetPad} gap ${v.widgetGap}`)
    console.log('   kids: ' + v.kids.join(' | '))
    console.log('   gaps: ' + v.gaps.join(' | '))
    for (const [k, p] of Object.entries(v.parts)) console.log(`   ${k}: ${p ? `box l${p.box.l} t${p.box.t} r${p.box.r} b${p.box.b} | ink l${p.ink.l} t${p.ink.t}` : 'absent'}`)
    if (v.cellGap !== undefined) console.log(`   cellGap ${v.cellGap} boards ${JSON.stringify(v.boards)} column ${JSON.stringify(v.column)}`)
  }
}
