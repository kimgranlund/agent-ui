// naming.ts — A2UI v1.0 name validator (catalog LLD-C2, catalog SPEC-R2).
//
// A catalog-declared component / function / property name MUST be a UAX-31 identifier
// (start char ∈ ID_Start, the rest ∈ ID_Continue) and MUST NOT use the reserved `@`
// namespace (e.g. `@index`, reserved for system context). Pure and zero-dep: a single
// precompiled Unicode-property regex via the `u` flag. A failure is reported by the
// loader as `CATALOG_NAME_INVALID` (catalog SPEC §5.3).

// `@` is not in ID_Start, so the UAX-31 test already rejects a leading `@`; the explicit
// guard documents the reserved-namespace rule and keeps it robust if the profile changes.
const UAX31_IDENT = /^\p{ID_Start}\p{ID_Continue}*$/u

/** True iff `s` is a valid A2UI v1.0 declared name (UAX-31, not in the reserved `@` namespace). */
export function validName(s: string): boolean {
  return typeof s === 'string' && s.length > 0 && s[0] !== '@' && UAX31_IDENT.test(s)
}
