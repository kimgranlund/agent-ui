/** Type surface for generate-llms-full.mjs — consumed by site/llms.test.ts (the drift gate imports the
 *  SAME implementation the CLI runs, so the committed corpus and the generator cannot drift apart). */
export function generateLlmsFull(repoRoot?: string): string
