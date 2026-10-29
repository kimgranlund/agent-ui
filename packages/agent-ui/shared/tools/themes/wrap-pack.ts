// wrap-pack.ts — ADR-0141's theme-pack wrap tool (TKT-0087). Wraps ONE Ultimate Tokens color export
// (a real `exportCSS`/`exportOKLCH` artifact, `export.colorPrefix: 'md-sys-color'`) into a
// `[theme='<name>']` pack at `src/tokens/themes/<name>.css` — the ONE mechanical step between "a UT
// export sitting on disk" and "a theme this repo's provider can select". Never imports UT's engine
// (ADR-0118's generator-owns-math fence, ADR-0141 cl.3) — it consumes an export ARTIFACT, validated by
// SHAPE, not re-derived.
//
// Run via Node type-stripping from the repo root:
//
//   node --experimental-strip-types packages/agent-ui/shared/tools/themes/wrap-pack.ts <name> <export.css>
//   node --experimental-strip-types packages/agent-ui/shared/tools/themes/wrap-pack.ts --repoint [name...]   (re-derive fill and text legs)
//
// Validates the input is UT's export grammar (a single `:root { … }` block, `--md-sys-color-*` custom
// properties only, `color-scheme: light dark;` present — the same scheme-completeness marker the
// default carries) and fails LOUDLY on drift (a malformed/foreign file never silently becomes a
// "pack"). No family-name adaptation table: a config's palette names (e.g. this repo's own "accent"
// slot) are UT's OWN `name` field, passed straight through — verified 2026-07-17 against the real
// `ultimate-tokens-modal-jazz-the-cool-blue-session-config.json` config (TKT-0087 Findings): there is
// no generic UT-role → agent-ui-name rename to encode here.
//
// Idempotent: re-running with the same (name, export) pair overwrites the pack with byte-identical
// content — never a second, drifted copy.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

declare const process: { argv: string[]; cwd(): string; exit(code: number): never }

// Paths resolve from `process.cwd()` (the repo root this script is documented to run from), NOT
// `import.meta.url` — the mini-skills.ts precedent this repo already learned the hard way: a bundler
// relocating this file breaks a source-relative resolution silently, cwd never does.
const THEMES_DIR = `${process.cwd()}/packages/agent-ui/shared/src/tokens/themes`

const NAME_RE = /^[a-z][a-z0-9-]*$/

/** Extract the declaration body of a UT export's single top-level `:root { … }` block, validating the
 *  shape as it goes. Throws with a specific, actionable message on the first thing that doesn't match
 *  a real UT export — never a silent partial wrap. */
export function extractRootBody(css: string): string {
  const at = css.indexOf(':root')
  if (at === -1) throw new Error('wrap-pack: input has no `:root` block — not a UT color export')
  const open = css.indexOf('{', at)
  if (open === -1) throw new Error('wrap-pack: `:root` has no opening brace')
  const close = css.lastIndexOf('}')
  if (close === -1 || close < open) throw new Error('wrap-pack: `:root` block has no closing brace')
  const body = css.slice(open + 1, close).trim()

  if (!/color-scheme:\s*light dark\s*;/.test(body)) {
    throw new Error('wrap-pack: input has no `color-scheme: light dark;` — not scheme-complete')
  }
  const props = [...body.matchAll(/--([\w-]+)\s*:/g)].map((m) => m[1] as string)
  if (props.length === 0) throw new Error('wrap-pack: input declares zero custom properties')
  const foreign = props.filter((p) => p !== 'color-scheme' && !p.startsWith('md-sys-color-'))
  if (foreign.length > 0) {
    throw new Error(`wrap-pack: input declares non-\`--md-sys-color-*\` propert${foreign.length === 1 ? 'y' : 'ies'}: ${foreign.slice(0, 5).join(', ')}`)
  }
  return body
}

// T-0340 (Kim 2026-10-17): a stock UT export has no fill role for on-primary text, and its dark `primary` (450)
// carries that text at about 3.2:1. `primary` stays the ink and indicator role; the wrap adds the FILL ladder
// (`--md-sys-color-primary-fill`, `-fill-hover`, `-fill-active`) derived from the pack's OWN ramp. Light legs copy
// the pack's `primary` / `-dim` / `-active` light legs (ui-button's light ladder; T-0462: pressed is one stop past hover). The dark rest is the first stop,
// walking away from the on-primary ink from DARK_FILL_START (darker for a light ink, lighter for a dark ink), that
// clears 4.5:1; hover and pressed step 100 and 150 further the same way. Every leg, light and dark, is then checked
// against its matching on-primary leg, and a miss (or a pack with only some fill roles) refuses. Nothing is tabled.
export const DARK_FILL_START = { darker: 600, lighter: 400 } as const
export const AA_TEXT = 4.5
const FILL_ROLES = ['primary-fill', 'primary-fill-hover', 'primary-fill-active'] as const
const INK_ROLES = ['primary-on-primary', 'primary-on-primary-hover', 'primary-on-primary-active'] as const

type Oklch = [number, number, number]

/** WCAG relative luminance of an OKLCH colour (OKLab -> linear sRGB, gamut-clamped). */
function luminance([L, C, H]: Oklch): number {
  const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => Math.min(1, Math.max(0, c)))
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!
}

const contrastOf = (x: Oklch, y: Oklch): number => {
  const a = luminance(x), b = luminance(y)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const pad = (n: number): string => String(n).padStart(3, '0')

/** Write the derived `--md-sys-color-primary-fill{,-hover,-active}` roles into a pack body (inserted after
 *  `--md-sys-color-primary-active`, or replaced in place). A body with no `primary` role is returned as is. */
export function repointFill(body: string): string {
  if (!/--md-sys-color-primary:/.test(body)) return body // no primary family declared: nothing to derive
  const ramp = new Map<number, Oklch>()
  for (const m of body.matchAll(/--md-sys-color-primary-(\d{3}):\s*oklch\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/g)) {
    ramp.set(Number(m[1]), [Number(m[2]), Number(m[3]), Number(m[4])])
  }
  const legs = (role: string): [string, string] => {
    const m = body.match(new RegExp(`--md-sys-color-${role}:\\s*light-dark\\(var\\(--md-sys-color-primary-(\\d{3})\\),\\s*var\\(--md-sys-color-primary-(\\d{3})\\)\\);`))
    if (!m) throw new Error(`wrap-pack: --md-sys-color-${role} is not a two-leg primary light-dark() role`)
    return [m[1]!, m[2]!]
  }
  const ink = ramp.get(Number(legs('primary-on-primary')[1]))
  if (!ink) throw new Error('wrap-pack: the dark on-primary leg has no primitive in the ramp')
  const stops = [...ramp.keys()].sort((a, b) => a - b)
  const mid = ramp.get(500) ?? ramp.get(stops[Math.floor(stops.length / 2)]!)!
  const way = luminance(ink) >= luminance(mid) ? 'darker' : 'lighter'
  const sign = way === 'darker' ? 1 : -1
  const start = DARK_FILL_START[way]
  const walk = way === 'darker' ? stops.filter((n) => n >= start) : stops.filter((n) => n <= start).reverse()
  const rest = walk.find((n) => contrastOf(ramp.get(n)!, ink) >= AA_TEXT)
  if (rest === undefined) {
    throw new Error(`wrap-pack: no primary stop ${way} than ${start} clears ${AA_TEXT}:1 against the dark on-primary ink; this pack needs a hand-picked fill`)
  }
  const step = (n: number): number => {
    if (!ramp.has(n)) throw new Error(`wrap-pack: the primary ramp has no ${pad(n)} stop for the fill ladder (rest ${pad(rest)}, ${way})`)
    return n
  }
  const dark = [rest, step(rest + sign * 100), step(rest + sign * 150)].map(pad)
  const light = [legs('primary')[0], legs('primary-dim')[0], legs('primary-active')[0]]
  // every leg, light and dark, against its matching on-primary leg (rest, hover, pressed); refuse on any miss
  INK_ROLES.forEach((inkRole, i) => {
    const inkLegs = legs(inkRole)
    for (const [scheme, fill, inkStop] of [['light', light[i]!, inkLegs[0]], ['dark', dark[i]!, inkLegs[1]]] as const) {
      const f = ramp.get(Number(fill)), k = ramp.get(Number(inkStop))
      if (!f || !k) throw new Error(`wrap-pack: ${FILL_ROLES[i]} ${scheme} leg ${fill} or its ink ${inkStop} has no primitive in the ramp`)
      const r = contrastOf(f, k)
      if (r < AA_TEXT) {
        throw new Error(`wrap-pack: ${FILL_ROLES[i]} ${scheme} leg primary-${fill} is ${r.toFixed(2)}:1 under ${inkRole} (primary-${inkStop}), below ${AA_TEXT}:1; this pack needs a hand-picked fill`)
      }
    }
  })
  const decl = FILL_ROLES.map((r, i) => `--md-sys-color-${r}: light-dark(var(--md-sys-color-primary-${light[i]}), var(--md-sys-color-primary-${dark[i]}));`)

  let out = body
  const present = FILL_ROLES.filter((r) => new RegExp(`--md-sys-color-${r}:`).test(out))
  if (present.length === FILL_ROLES.length) {
    FILL_ROLES.forEach((r, i) => { out = out.replace(new RegExp(`--md-sys-color-${r}:[^;]*;`), decl[i]!) })
    return out
  }
  if (present.length > 0) {
    const missing = FILL_ROLES.filter((r) => !present.includes(r))
    throw new Error(`wrap-pack: the pack declares ${present.join(', ')} but not ${missing.join(', ')}; a fill ladder is all three roles or none`)
  }
  const anchor = out.match(/^([ \t]*)--md-sys-color-primary-active:[^;]*;$/m)
  if (!anchor) throw new Error('wrap-pack: no --md-sys-color-primary-active declaration to place the fill roles after')
  return out.replace(anchor[0], [anchor[0], ...decl.map((d) => `${anchor[1]}${d}`)].join('\n'))
}

// T-0560: a stock UT export's placeholder (`neutral-placeholder`) and link (`primary-placeholder`) inks are 650 / 350,
// which fall under 4.5:1 on the dimmest light planes (n-175, n-200; the placeholder also sits on the idle field fill,
// `neutral-container-low` composited over the plane). Each leg is the first stop, walking from TEXT_START away from
// its planes (darker for light, lighter for dark), that clears 4.5:1 as text on every elevation plane of its scheme,
// and the placeholder also on the field fill over each. Nothing is tabled; tokens.css is held to the same rule.
export const TEXT_START = { light: 650, dark: 350 } as const
export const TEXT_PLANES = { light: [50, 75, 100, 125, 150, 175, 200], dark: [950, 925, 900, 875, 850, 825, 800] } as const
const TEXT_ROLES = [['neutral-placeholder', 'neutral', true], ['primary-placeholder', 'primary', false]] as const

/** OKLCH to gamma-encoded sRGB (gamut-clamped), for alpha compositing the field fill over a plane. */
function gammaOf([L, C, H]: Oklch): number[] {
  const h = (H * Math.PI) / 180, a = C * Math.cos(h), b = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ].map((c) => { c = Math.min(1, Math.max(0, c)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055 })
}
const gammaLum = (g: number[]): number => {
  const [r, gg, b] = g.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r! + 0.7152 * gg! + 0.0722 * b!
}
const gammaContrast = (x: number[], y: number[]): number => {
  const a = gammaLum(x), b = gammaLum(y)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

/** Repoint the `neutral-placeholder` and `primary-placeholder` legs in a pack body (or tokens.css) to the derived
 *  stops, in place. A body without those roles is returned as is; a ramp with no passing stop refuses. */
export function repointText(body: string): string {
  if (!/--md-sys-color-neutral-placeholder:/.test(body)) return body
  const stop = (family: string, n: number): { c: Oklch; a: number } | undefined => {
    const m = body.match(new RegExp(`--md-sys-color-${family}-${pad(n)}:\\s*oklch\\(([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)(?:\\s*/\\s*([\\d.]+)%)?\\)`))
    return m ? { c: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] ? Number(m[4]) / 100 : 1 } : undefined
  }
  const fillLegs = body.match(/--md-sys-color-neutral-container-low:\s*light-dark\(var\(--md-sys-color-neutral-scrim-(\d{3})\),\s*var\(--md-sys-color-neutral-scrim-(\d{3})\)\);/)
  if (!fillLegs) throw new Error('wrap-pack: --md-sys-color-neutral-container-low is not a two-leg neutral scrim light-dark() role')
  const fillMix = (k: 0 | 1): { c: Oklch; a: number } => {
    const m = body.match(new RegExp(`--md-sys-color-neutral-scrim-${fillLegs[k + 1]}:\\s*oklch\\(([-\\d.]+)\\s+([-\\d.]+)\\s+([-\\d.]+)\\s*/\\s*([\\d.]+)%\\)`))
    if (!m) throw new Error(`wrap-pack: the field fill scrim neutral-scrim-${fillLegs[k + 1]} has no primitive`)
    return { c: [Number(m[1]), Number(m[2]), Number(m[3])], a: Number(m[4]) / 100 }
  }
  let out = body
  for (const [role, family, onField] of TEXT_ROLES) {
    const legs: string[] = []
    ;(['light', 'dark'] as const).forEach((scheme, k) => {
      const fill = fillMix(k as 0 | 1)
      const backs = TEXT_PLANES[scheme].flatMap((p) => {
        const plane = stop('neutral', p)
        if (!plane) throw new Error(`wrap-pack: the neutral ramp has no ${pad(p)} plane`)
        const g = gammaOf(plane.c)
        if (!onField) return [g]
        const f = gammaOf(fill.c)
        return [g, g.map((c, i) => fill.a * f[i]! + (1 - fill.a) * c)]
      })
      const walk: number[] = []
      for (let n = TEXT_START[scheme]; n >= 50 && n <= 950; n += scheme === 'light' ? 50 : -50) walk.push(n)
      const hit = walk.find((n) => { const ink = stop(family, n); return ink !== undefined && backs.every((b) => gammaContrast(gammaOf(ink.c), b) >= AA_TEXT) })
      if (hit === undefined) throw new Error(`wrap-pack: no ${family} stop from ${TEXT_START[scheme]} clears ${AA_TEXT}:1 for --md-sys-color-${role} on every ${scheme} plane; this pack needs a hand-picked ink`)
      legs.push(pad(hit))
    })
    const decl = `--md-sys-color-${role}: light-dark(var(--md-sys-color-${family}-${legs[0]}), var(--md-sys-color-${family}-${legs[1]}));`
    const re = new RegExp(`--md-sys-color-${role}:[^;]*;`)
    if (!re.test(out)) throw new Error(`wrap-pack: no --md-sys-color-${role} declaration to repoint`)
    out = out.replace(re, decl)
  }
  return out
}

/** Wrap a UT export's `:root` body under `[theme='<name>']`, 2-space re-indented to match this repo's
 *  CSS convention (ADR-0003 — the same indent every hand-authored token block already uses). */
export function wrapPack(name: string, exportCss: string): string {
  if (!NAME_RE.test(name)) throw new Error(`wrap-pack: "${name}" is not a legal theme name (kebab, lowercase, [a-z0-9-]+)`)
  const body = repointText(repointFill(extractRootBody(exportCss)))
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => `  ${l}`)
  return (
    `/* ${name}.css — a THEME PACK (ADR-0141/TKT-0087): an Ultimate Tokens color export wrapped under\n` +
    ` * \`[theme='${name}']\`, re-declaring the --md-sys-color-* system-tier surface for any subtree an\n` +
    ` * ancestor \`ui-theme-provider[theme='${name}']\` themes. Generated — do not hand-edit; regenerate via\n` +
    ` * \`wrap-pack.ts\` from a fresh UT export. Parity: the 16 hand-authored roles the default (tokens.css)\n` +
    ` * carries beyond a stock UT export (focus-ring · neutral-tint-* · neutral-track{,-hover} ·\n` +
    ` * primary-selected · the raw 050/950 alpha triples — TKT-0087 Findings) are DELIBERATELY absent here;\n` +
    ` * an element inside this themed subtree inherits those roles from :root's default via ordinary CSS\n` +
    ` * custom-property cascade — no fallback mechanism needed. */\n\n` +
    `[theme='${name}'] {\n${lines.join('\n')}\n}\n`
  )
}

/** `--repoint [name...]`: apply repointFill and repointText to committed packs (all of them when none is named), for
 *  packs wrapped before the repoint existed; idempotent, so a re-run leaves the files byte-identical. */
function repointCommitted(names: string[]): void {
  const bad = names.filter((n) => !NAME_RE.test(n))
  if (bad.length > 0) {
    console.error(`wrap-pack: --repoint name(s) not a legal theme name (kebab, lowercase, [a-z0-9-]+): ${bad.join(', ')}`)
    process.exit(1)
  }
  const files = names.length > 0 ? names.map((n) => `${n}.css`) : readdirSync(THEMES_DIR).filter((f) => f.endsWith('.css'))
  for (const file of files) {
    const path = `${THEMES_DIR}/${file}`
    const before = readFileSync(path, 'utf8')
    const after = repointText(repointFill(before))
    if (after !== before) writeFileSync(path, after)
    console.log(`wrap-pack: ${after === before ? 'unchanged' : 'repointed'} ${path}`)
  }
}

function main(): void {
  if (process.argv[2] === '--repoint') return repointCommitted(process.argv.slice(3))
  const [, , name, exportPath] = process.argv
  if (!name || !exportPath) {
    console.error('usage: wrap-pack.ts <name> <export.css>')
    process.exit(1)
  }
  const resolved = resolve(exportPath)
  if (!existsSync(resolved)) {
    console.error(`wrap-pack: no such file: ${resolved}`)
    process.exit(1)
  }
  const exportCss = readFileSync(resolved, 'utf8')
  const pack = wrapPack(name, exportCss)
  const outPath = `${THEMES_DIR}/${name}.css`
  writeFileSync(outPath, pack)
  console.log(`wrap-pack: wrote ${outPath} (${pack.length} bytes)`)
}

// Only run as a CLI, not when imported (extractRootBody/wrapPack are unit-tested directly).
const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isMain) main()
