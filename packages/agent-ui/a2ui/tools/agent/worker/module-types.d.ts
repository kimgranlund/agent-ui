// module-types.d.ts — ambient module shapes for the Text-loaded assets the Worker bundle imports
// statically (Wrangler's `rules: [{type: "Text", globs: [...]}]`, wrangler.jsonc). esbuild's Text loader
// exports file content as the default export; `resolveJsonModule` already covers `.json`.

declare module '*.md' {
  const content: string
  export default content
}

declare module '*.jsonl' {
  const content: string
  export default content
}
