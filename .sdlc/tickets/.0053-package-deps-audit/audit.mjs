// Read-only: declared deps vs imports per package. Usage: node audit.mjs [--json]
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve(import.meta.dirname, '../../..');
const base = path.join(root, 'packages/agent-ui');
const walk = (d, o = []) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name === 'dist') continue; const p = path.join(d, e.name); e.isDirectory() ? walk(p, o) : /\.(ts|mjs|js|css|json|md)$/.test(e.name) && o.push(p); } return o; };
const re = /(?:from\s+|import\s*\(\s*|import\s+|require\(\s*|@import\s+(?:url\()?)['"](@[\w.-]+\/[\w.-]+|[\w][\w.-]*)(?:\/[^'"]*)?['"]/g;
const out = {};
for (const pkg of fs.readdirSync(base)) {
  const dir = path.join(base, pkg); const pj = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const declared = {}; for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) for (const n of Object.keys(pj[k] || {})) declared[n] = k;
  const used = {};
  for (const f of walk(dir)) {
    const rel = path.relative(root, f); const isCode = /\.(ts|mjs|js|css)$/.test(f); if (!isCode && !f.endsWith('package.json')) continue;
    if (f.endsWith('package.json')) continue;
    const src = fs.readFileSync(f, 'utf8'); let m; re.lastIndex = 0;
    while ((m = re.exec(src))) { const n = m[1]; if (n.startsWith('@agent-ui/') || n.startsWith('@') || /^(pdfjs-dist|vitest|typescript)$/.test(n)) (used[n] ??= new Set()).add(rel); }
  }
  const unused = Object.keys(declared).filter(n => !used[n]);
  const undeclared = Object.keys(used).filter(n => !declared[n] && n !== pj.name);
  out[pkg] = { name: pj.name, declared, unused, undeclared, usage: Object.fromEntries(Object.entries(used).map(([n, s]) => [n, [...s].length + ' files, e.g. ' + [...s][0]])) };
}
console.log(JSON.stringify(out, null, 1));
