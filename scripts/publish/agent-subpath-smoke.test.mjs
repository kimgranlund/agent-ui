// agent-subpath-smoke.test.mjs: the pre-publish proof that `@agent-ui-kit/a2ui/agent` imports from plain
// Node (ADR-0236). It runs the real publish path (`buildLibrary` + `preparePackage` from
// publish-packages.mjs) into temp dirs, packs shared/icons/components/a2ui (the whole dependency closure;
// none has an external dependency), installs the tarballs offline into a consumer dir outside the
// workspace (the GH #283 recipe), and calls `buildSystemPrompt` from `node --input-type=module` with no
// bundler. Nothing is written inside the repo.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { buildLibrary, preparePackage } from './publish-packages.mjs'

const VERSION = '0.0.0-smoke.0'
const CLOSURE = ['shared', 'icons', 'components', 'a2ui']
const TIMEOUT = 180_000

// The same shape as step 3's off-cwd probe: a one-type catalog, dogfood on, and a `ui-card` dogfood row.
const PROBE = `
import { buildSystemPrompt } from '@agent-ui-kit/a2ui/agent'
const catalog = { catalogId: 'smoke', protocolVersion: '0.9', components: { Text: { name: 'Text', properties: {} } }, functions: {} }
const prompt = buildSystemPrompt(catalog, [], undefined, undefined, undefined, { enabled: true, dogfood: true })
if (typeof prompt !== 'string' || prompt.length === 0) throw new Error('empty prompt')
if (!/^- ui-card \\S/m.test(prompt)) throw new Error('no ui-card dogfood row in the prompt')
console.log('agent-smoke ok ' + prompt.length)
`

const tempDirs = []
const temp = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

afterAll(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

describe('@agent-ui-kit/a2ui/agent from plain Node (packed tarballs, offline install)', () => {
  it(
    'builds, packs, installs and runs buildSystemPrompt with a ui-card dogfood row',
    () => {
      const distLib = temp('agent-smoke-dist-')
      const scratch = temp('agent-smoke-scratch-')
      const tarballs = temp('agent-smoke-tgz-')
      const consumer = temp('agent-smoke-consumer-')

      buildLibrary(distLib)
      for (const pkgDir of CLOSURE) {
        const { scratchRoot } = preparePackage(pkgDir, VERSION, { distLib, scratch })
        execFileSync('npm', ['pack', '--pack-destination', tarballs], { cwd: scratchRoot, stdio: 'pipe' })
      }
      const tgz = readdirSync(tarballs).filter((f) => f.endsWith('.tgz'))
      expect(tgz).toHaveLength(CLOSURE.length)

      writeFileSync(
        join(consumer, 'package.json'),
        `${JSON.stringify({ name: 'agent-smoke', private: true, type: 'module' }, null, 2)}\n`,
      )
      execFileSync('npm', ['install', '--offline', '--no-audit', '--no-fund', ...tgz.map((f) => join(tarballs, f))], {
        cwd: consumer,
        stdio: 'pipe',
      })

      const out = execFileSync('node', ['--input-type=module', '-e', PROBE], { cwd: consumer, encoding: 'utf8' })
      expect(out).toMatch(/^agent-smoke ok [1-9]\d*/m)
    },
    TIMEOUT,
  )
})
