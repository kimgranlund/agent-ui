#!/usr/bin/env node
// agent-content.mjs: the agent content CLI (T-0162, agent-content SPEC ACS-R10). Every command runs the
// one validator (`validateContent` in site/agent-content/schema.ts, backed by the persona kind schema in
// @agent-ui/app/agent-admin-content-fields) over the content files, the same check the generator, the
// settings form and the Builder's patch gate share. No dependency beyond Node.
//
// Usage:
//   node scripts/agent-content.mjs validate [--root <dir>]
//       Validate every content file. Exit 1 naming each problem.
//   node scripts/agent-content.mjs new <id> [--label <label>] [--from <persona file>] [--root <dir>]
//       Write a new roster persona at site/agent-content/personas/<id>/ (the next roster order). With
//       --from, the persona is an exported persona file (agent-ui-persona v1, the Builder's export): its
//       state becomes the seed folder, and every value the seed format cannot carry is listed. Then validate.
//   node scripts/agent-content.mjs add-skill <id> (--persona <id> | --pack <id>) [--description <text>] [--force] [--root <dir>]
//       Write a skill: under a persona's own folder (referenced as ./<id>@1), or in the library and offered
//       by a skill pack (referenced as <id>@1). One of --persona and --pack is required. An existing skill
//       file is refused unless --force; a ref already listed is never listed twice. Then validate.
//   node scripts/agent-content.mjs compile-check [--root <dir>]
//       Validate, then check the generated registries and the manifests' seedVersion are current (the
//       generator's --check). The bundle digest leg arrives with the compiler (T-0163).
//
// Exit codes: 0 = valid, 1 = a content problem or stale output, 2 = usage. A write that would leave the
// content invalid is still written and reported, so the author sees the file the validator names.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { CONTENT_ROOT, ENTRY_LAYOUT, ID_PATTERN, parseRef } from '../site/agent-content/schema.ts'
import { formatContentFile, personaSeedFiles } from '../site/agent-content/seed-file.ts'
import { OUT_REGISTRY, OUT_RUNTIME, discoverAgentContent, generateRegistryModule, generateRuntimeModule, manifestUpdates } from './generate-agent-content.mjs'

const USAGE = `usage: node scripts/agent-content.mjs <validate | new <id> | add-skill <id> | compile-check> [options]
  validate        [--root <dir>]
  new <id>        [--label <label>] [--from <persona file>] [--root <dir>]
  add-skill <id>  (--persona <id> | --pack <id>) [--description <text>] [--force] [--root <dir>]
  compile-check   [--root <dir>]`

class UsageError extends Error {}

/** The options that take no value. */
const SWITCHES = new Set(['force'])

/** `argv` as a command, one positional and `--flag value` options (a switch such as `--force` is `true`). */
export function parseArgs(argv) {
  const [command, ...rest] = argv
  const options = {}
  const positional = []
  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i]
    if (SWITCHES.has(arg.slice(2)) && arg.startsWith('--')) options[arg.slice(2)] = true
    else if (arg.startsWith('--')) {
      const value = rest[i + 1]
      if (value === undefined || value.startsWith('--')) throw new UsageError(`${arg} needs a value`)
      options[arg.slice(2)] = value
      i++
    } else positional.push(arg)
  }
  return { command, options, positional }
}

function report(problems, out) {
  for (const p of problems) out.error(`agent-content: ${p}`)
}

function validate(root, out) {
  const { records, problems } = discoverAgentContent(root)
  report(problems, out)
  if (problems.length === 0) out.log(`agent-content: ${records.length} records valid`)
  return { records, code: problems.length === 0 ? 0 : 1 }
}

/** Refuse to overwrite an existing content file unless `--force` was passed. */
function refuseExisting(root, path, options) {
  if (options.force !== true && existsSync(`${root}/${path}`)) throw new UsageError(`${path} already exists (pass --force to overwrite it)`)
}

function write(root, path, text, out) {
  const abs = `${root}/${path}`
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, text)
  out.log(`agent-content: wrote ${path}`)
}

function requireId(id, what) {
  if (id === undefined || !ID_PATTERN.test(id)) throw new UsageError(`${what} must be a lowercase-hyphenated id`)
}

function newPersona(root, id, options, out) {
  requireId(id, 'new <id>')
  if (existsSync(`${root}/${CONTENT_ROOT}/personas/${id}`)) throw new UsageError(`persona ${id} already exists`)
  const { records } = discoverAgentContent(root)
  const order = Math.max(0, ...records.filter((r) => r.kind === 'persona' && typeof r.frontmatter.order === 'number').map((r) => r.frontmatter.order)) + 1
  let state = {}
  let label = options.label
  let tagline = 'A new agent.'
  let category
  if (options.from !== undefined) {
    let file
    try {
      file = JSON.parse(readFileSync(resolve(options.from), 'utf8'))
    } catch (error) {
      throw new UsageError(`${options.from} is not readable JSON: ${error instanceof Error ? error.message : String(error)}`)
    }
    const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
    if (!isRecord(file) || file.kind !== 'agent-ui-persona' || file.version !== 1 || !isRecord(file.state)) throw new UsageError(`${options.from} is not an agent-ui-persona v1 file with a state object`)
    state = file.state
    label ??= file.persona?.label
    if (typeof file.persona?.tagline === 'string' && file.persona.tagline !== '') tagline = file.persona.tagline
    category = file.persona?.category
  }
  label ??= id
  const { files, dropped } = personaSeedFiles({ id, label, tagline, order, ...(category === undefined ? {} : { category }) }, state, records)
  for (const { path, text } of files) write(root, path, text, out)
  for (const d of dropped) out.log(`agent-content: not carried: ${d}`)
}

function addSkill(root, id, options, out) {
  requireId(id, 'add-skill <id>')
  if ((options.persona === undefined) === (options.pack === undefined)) throw new UsageError('add-skill takes exactly one of --persona and --pack')
  const { dir, file } = ENTRY_LAYOUT.skill
  const description = options.description ?? `When to use ${id}.`
  if (options.persona !== undefined) {
    requireId(options.persona, '--persona')
    const agentPath = `${CONTENT_ROOT}/personas/${options.persona}/agent.md`
    if (!existsSync(`${root}/${agentPath}`)) throw new UsageError(`no persona ${options.persona}`)
    const skillPath = `${CONTENT_ROOT}/personas/${options.persona}/${dir}/${id}/${file}`
    refuseExisting(root, skillPath, options)
    const source = readFileSync(`${root}/${agentPath}`, 'utf8')
    const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(source)
    if (!match) throw new UsageError(`${agentPath} has no frontmatter fence`)
    const entry = { name: id, description, id, version: 1, kind: 'skill', availability: 'context', label: id }
    write(root, skillPath, formatContentFile(entry, `Describe how ${id} works.`), out)
    const frontmatter = JSON.parse(match[1])
    const refs = Array.isArray(frontmatter.skills) ? frontmatter.skills : []
    if (refs.some((ref) => { const parsed = parseRef(ref); return parsed?.local === true && parsed.id === id })) return
    frontmatter.skills = [...refs, `./${id}@1`]
    write(root, agentPath, `---\n${JSON.stringify(frontmatter, null, 2)}\n---\n${match[2]}`, out)
    return
  }
  const packId = options.pack
  requireId(packId, '--pack')
  const packPath = `${CONTENT_ROOT}/packs/${packId}/pack.json`
  if (!existsSync(`${root}/${packPath}`)) throw new UsageError(`no pack ${packId}`)
  const pack = JSON.parse(readFileSync(`${root}/${packPath}`, 'utf8'))
  if (pack.kind !== 'skill' || !Array.isArray(pack.entries)) throw new UsageError(`pack ${packId} is not a skill pack with entries`)
  const skillPath = `${CONTENT_ROOT}/${dir}/${id}/${file}`
  refuseExisting(root, skillPath, options)
  const entry = { name: id, description, id, version: 1, kind: 'skill', availability: 'context', label: id }
  write(root, skillPath, formatContentFile(entry, `Describe how ${id} works.`), out)
  if (pack.entries.some((ref) => parseRef(ref)?.id === id)) return
  pack.entries = [...pack.entries, `${id}@1`]
  write(root, packPath, `${JSON.stringify(pack, null, 2)}\n`, out)
}

function compileCheck(root, out) {
  const { records, code } = validate(root, out)
  if (code !== 0) return 1
  const manifests = manifestUpdates(records, root)
  report(manifests.problems, out)
  const outputs = [{ path: OUT_REGISTRY, text: generateRegistryModule(records) }, { path: OUT_RUNTIME, text: generateRuntimeModule(records) }, ...manifests.updates]
  const stale = outputs.filter(({ path, text }) => !existsSync(`${root}/${path}`) || readFileSync(`${root}/${path}`, 'utf8') !== text)
  for (const { path } of stale) out.error(`agent-content: ${path} is stale; run node scripts/generate-agent-content.mjs`)
  return manifests.problems.length > 0 || stale.length > 0 ? 1 : 0
}

/** Run one command; returns the exit code. `out` defaults to the console (tests pass a recorder). */
export function run(argv, cwd = process.cwd(), out = console) {
  try {
    const { command, options, positional } = parseArgs(argv)
    const root = resolve(cwd, options.root ?? '.')
    switch (command) {
      case 'validate':
        return validate(root, out).code
      case 'new':
        newPersona(root, positional[0], options, out)
        return validate(root, out).code
      case 'add-skill':
        addSkill(root, positional[0], options, out)
        return validate(root, out).code
      case 'compile-check':
        return compileCheck(root, out)
      default:
        throw new UsageError(command === undefined ? 'no command' : `unknown command ${command}`)
    }
  } catch (error) {
    if (!(error instanceof UsageError)) throw error
    out.error(`agent-content: ${error.message}`)
    out.error(USAGE)
    return 2
  }
}

if (process.argv[1]?.endsWith('agent-content.mjs')) process.exitCode = run(process.argv.slice(2))
