// ids.ts: the shipped persona ids as an import-free const (T-0209), for a reader that needs only the names and must
// not carry the manifests' fragments and checks (`agent/selection-guidance.ts` in the `./agent` bundle).
// `ids.test.ts` holds it equal to `SHIPPED_PERSONA_CATALOG_MANIFESTS`, so a persona added there without a line here
// reds, and the reverse.

export const SHIPPED_PERSONA_IDS: readonly string[] = ['fixture-demo', 'croupier', 'quizmaster', 'stylist']
