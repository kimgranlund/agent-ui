// Throwaway step-7 codemod: move importers off '@agent-ui/components/components' and
// '@agent-ui/components/component-styles.css'. Usage: node codemod.mjs <files...>
import ts from 'typescript'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.cwd()
const PKG = `${ROOT}/packages/agent-ui/components`
const pkg = JSON.parse(readFileSync(`${PKG}/package.json`, 'utf8'))
const BARREL = '@agent-ui/components/components'
const CSS_BARREL = '@agent-ui/components/component-styles.css'

// symbol -> subpath key, via the TS checker over every ./controls/* JS target.
const targets = Object.entries(pkg.exports)
  .filter(([k, v]) => k.startsWith('./controls/') && typeof v === 'string' && v.endsWith('.ts'))
  .map(([k, v]) => ({ key: k.slice(2), file: resolve(PKG, v) }))
const program = ts.createProgram(targets.map((t) => t.file), {
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler,
  allowImportingTsExtensions: true, noEmit: true, allowJs: false, skipLibCheck: true,
})
const checker = program.getTypeChecker()
const owner = new Map() // name -> {key, direct}
for (const t of targets) {
  const sf = program.getSourceFile(t.file)
  const mod = checker.getSymbolAtLocation(sf)
  for (const sym of checker.getExportsOfModule(mod)) {
    const real = sym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(sym) : sym
    const declFile = real.declarations?.[0]?.getSourceFile().fileName
    const direct = declFile === t.file
    const prev = owner.get(sym.name)
    if (!prev || (direct && !prev.direct)) owner.set(sym.name, { key: t.key, direct })
  }
}

const files = process.argv.slice(2)
for (const f of files) {
  let src = readFileSync(f, 'utf8')
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)
  const edits = []
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === BARREL) {
      const clause = node.importClause
      if (!clause) {
        edits.push([node.moduleSpecifier.getStart(sf), node.moduleSpecifier.end, `'@agent-ui/components/all'`])
      } else {
        if (clause.name || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) throw new Error(`${f}: unsupported import shape`)
        const inner = src.slice(clause.namedBindings.getStart(sf), clause.namedBindings.end)
        if (/\/\/|\/\*/.test(inner)) throw new Error(`${f}: comment inside import list`)
        const groups = new Map() // key -> [{text, type}]
        for (const el of clause.namedBindings.elements) {
          const name = (el.propertyName ?? el.name).text
          const o = owner.get(name)
          if (!o) throw new Error(`${f}: no owner for ${name}`)
          const text = el.propertyName ? `${el.propertyName.text} as ${el.name.text}` : el.name.text
          const isType = clause.isTypeOnly || el.isTypeOnly
          if (!groups.has(o.key)) groups.set(o.key, [])
          groups.get(o.key).push({ text, isType })
        }
        const lines = []
        for (const [key, els] of groups) {
          const allType = els.every((e) => e.isType)
          const list = els.map((e) => (!allType && e.isType ? `type ${e.text}` : e.text)).join(', ')
          lines.push(`import ${allType ? 'type ' : ''}{ ${list} } from '@agent-ui/components/${key}'`)
        }
        edits.push([node.getStart(sf), node.end, lines.join('\n')])
      }
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const a = node.arguments[0]
      if (a && ts.isStringLiteral(a) && a.text === BARREL) edits.push([a.getStart(sf), a.end, `'@agent-ui/components/all'`])
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  edits.sort((a, b) => b[0] - a[0])
  for (const [s, e, t] of edits) src = src.slice(0, s) + t + src.slice(e)
  src = src.split(`'${CSS_BARREL}'`).join(`'@agent-ui/components/all.css'`)
  writeFileSync(f, src)
}
