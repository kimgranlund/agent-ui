// descriptor — the component-descriptor public surface (ADR-0004). This barrel exposes the CANONICAL
// `{name}.md` frontmatter reader + schema + contract↔props trip-wire as the package subpath
// `@agent-ui/components/descriptor`, so a second consumer (the /site doc page, A4) reuses the SAME parser
// the contract trip-wire is built on — one parser, two consumers, never a forked frontmatter dialect.
export * from './component-descriptor.ts'
