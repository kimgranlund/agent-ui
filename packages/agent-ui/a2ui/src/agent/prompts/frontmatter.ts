// frontmatter.ts — ADR-0135 cl.12: a minimal, Node-tooling-local frontmatter parser. No reusable
// general-purpose parser exists in-repo (rescore.ts's `readRubricVersion` is a single-line regex, not a
// parser). Splits the leading `---`…`---` block into single-line `key: value` pairs and returns
// `{ data, body }`. Values are single-line (no YAML nesting needed); the body is trimmed so an authored
// trailing newline never breaks a byte-identity gate (every mini-skill body is whitespace-edge-free).

export interface Frontmatter {
  data: Record<string, string>
  body: string
}

export function parseFrontmatter(source: string): Frontmatter {
  const text = source.replace(/\r\n/g, '\n')
  if (!text.startsWith('---\n')) return { data: {}, body: text.trim() }

  const afterOpen = text.slice(4) // past the opening "---\n"
  const closeAt = afterOpen.indexOf('\n---') // the closing fence (on its own line)
  if (closeAt === -1) return { data: {}, body: text.trim() }

  const block = afterOpen.slice(0, closeAt)
  const rest = afterOpen.slice(closeAt + 1) // starts at the closing "---"
  const bodyNewline = rest.indexOf('\n') // end of the closing "---" line
  const body = (bodyNewline === -1 ? '' : rest.slice(bodyNewline + 1)).trim()

  const data: Record<string, string> = {}
  for (const line of block.split('\n')) {
    if (line.trim() === '') continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    data[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  return { data, body }
}
