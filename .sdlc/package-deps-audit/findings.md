# Package dependency audit (T-0053)

Read-only. Scripts: `audit.mjs` (loose scan, counts layering-test string literals too), `evidence.sh <from> <to> [n]` (real import statements only, layering tests excluded, run from `packages/agent-ui`), `check.sh` (paths and packages named here exist). All ten packages are `private: true` and workspace-linked via root `workspaces`, so no change below touches published metadata; any dependency edit does touch `package-lock.json`.

## Premise correction

Two claims in the ticket do not hold:
- a2ui lists `@agent-ui/a2a` and `@agent-ui/icons` under devDependencies (not dependencies), and both ARE imported: `a2ui/tools/pipeline/transports/a2a.ts:17` and `a2ui/src/bridge/feed-fixture.test.ts:17` (a2a), `a2ui/src/catalog/a2ui-basic/factories.test.ts:30` (icons/phosphor). The layering test forbids them only for non-test `src/**`. Legitimate devDependencies.
- components lists BOTH `icons` and `shared` (`components/package.json:13-14`). Shared is consumed through CSS: `components/src/foundation-styles.css:8-9` and `base-styles.css:8` `@import '@agent-ui/shared/...css'`. Icons: `components/src/controls/disclosure/disclosure.ts:57`, `tabs/tabs.ts:43`. Nothing is wrong.

## Per package

Evidence command pattern: `cd packages/agent-ui && bash ../../.sdlc/package-deps-audit/evidence.sh <from> <to>`.

### a2a (no deps)
| Class | Item | Evidence |
|---|---|---|
| imported-but-undeclared (test only) | `@agent-ui/a2ui` | `evidence.sh a2a a2ui` -> `a2a/src/feed/dev-proxy-plugin.test.ts:16` |

### a2ui
| Class | Item | Evidence |
|---|---|---|
| legit (devDependency, tools/tests) | `@agent-ui/a2a` | `evidence.sh a2ui a2a` -> `a2ui/tools/pipeline/transports/a2a.ts:17` |
| legit (devDependency, test) | `@agent-ui/icons` | `evidence.sh a2ui icons` -> `factories.test.ts:30` |
| used, declared | components, shared | `a2ui/src/renderer/surface.ts:12` (components); shared in browser tests |

### app
| Class | Item | Evidence |
|---|---|---|
| imported-but-undeclared (tests only) | `@agent-ui/icons` | `evidence.sh app icons` -> `entry-list.browser.test.ts:15`, `agent-admin-lazy.browser.test.ts:23`; none in non-test source |
| declared, used | a2ui, code, components, data, shared, pdfjs-dist | `app/src/controls/agent-admin/document-ingest.ts` (pdfjs-dist), `settings/schema.ts` (shared) |
| not an import | router mentions | comments only (`settings.ts:32`); `evidence.sh app router` prints nothing |

### code
| Class | Item | Evidence |
|---|---|---|
| declared-but-unused | `@agent-ui/shared` | `grep -rln "agent-ui/shared" code` finds only `layering.test.ts` and package.json |
| declared, used | components, CodeMirror, lezer | `code/src/markdown/markdown.ts:7`; `code/src/editor/cm-editor.ts` |

### components
| Class | Item | Evidence |
|---|---|---|
| legit | `@agent-ui/shared` (CSS @import) | `evidence.sh components shared` |
| legit | `@agent-ui/icons` | `evidence.sh components icons` |

### data
| Class | Item | Evidence |
|---|---|---|
| declared-but-unused | `@agent-ui/shared` | only `layering.test.ts` and package.json mention it |
| used | components | `data/src/core/resource.ts:5` |

### devtools
| Class | Item | Evidence |
|---|---|---|
| used | a2ui, a2a | `devtools/src/transports/a2a-peer.ts:24` |

### icons
| Class | Item | Evidence |
|---|---|---|
| legit devDependency | `@phosphor-icons/core` | `icons/scripts/vendor-phosphor.mjs` (vendoring build script) |

### router
| Class | Item | Evidence |
|---|---|---|
| declared-but-unused | `@agent-ui/shared` | only `layering.test.ts` and package.json mention it |
| used | components | `router/src/core/router.ts:10` |

### shared (no deps): nothing to report.

## Recommended changes (none applied)
1. Drop `@agent-ui/shared` from `code`, `data`, `router` dependencies (3 lines; lockfile changes; no published metadata, all private). Check first that the layering tests do not assert the declared edge, and that the tokens CSS is not expected to arrive transitively through components.
2. Add `@agent-ui/icons` to `app` devDependencies (test-only imports) and `@agent-ui/a2ui` to `a2a` devDependencies (test-only), or accept workspace hoisting and leave as is; lockfile changes either way.
3. Close or reword T-0053's premise: the a2ui and components entries are correct as declared.
