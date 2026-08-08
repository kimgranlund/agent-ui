// site/lib/identity-error-code.ts — the identity family's shared `errorCodeOf` narrow (GH #611, the
// family-close debt recorded at S3's review, PR #605): four pages (credentials.ts/magic-link.ts/
// otp-signin.ts/social-signin.ts) each carried a byte-identical copy; this is the one shared home.
//
// Deliberately its OWN file, NOT folded into identity-mock-transport.ts. Every consuming page calls this
// at RUNTIME from inside its always-present wireXxx() catch blocks (never gated behind
// `import.meta.env.DEV`), so it needs a real value import — but identity-mock-transport.ts is the DEV-
// fenced module SPEC-R9 AC2 keeps OUT of the production bundle (GH #576's prod-bundle probe,
// identity-mock-transport-prod-bundle.test.ts, greps every emitted chunk for `createIdentityMockTransport`/
// `IdentityMockError`). A value import of a function FROM that file would create a real runtime edge to
// it — tree-shaking would likely still drop the unused transport/class exports, but the DEV fence's whole
// point is not depending on "likely". This file imports only the `IdentityMockErrorCode` TYPE (erased at
// compile time, verbatimModuleSyntax), so no page that imports `errorCodeOf` from here ever creates a
// runtime edge to identity-mock-transport.ts at all.
import type { IdentityMockErrorCode } from './identity-mock-transport.ts'

/** Read a rejection's `.code` WITHOUT importing the `IdentityMockError` class as a runtime value — every
 *  consuming page only ever holds the transport's TYPES statically (SPEC-R9 AC2; the class itself lives
 *  behind each page's own DEV-gated dynamic import, same as every other transport symbol). SPEC-R8 AC1's
 *  own shape (an `instanceof Error` carrying a `code` string) is what this narrows against structurally. */
export function errorCodeOf(err: unknown): IdentityMockErrorCode | undefined {
  if (err instanceof Error && 'code' in err && typeof (err as { code: unknown }).code === 'string') {
    return (err as { code: IdentityMockErrorCode }).code
  }
  return undefined
}
