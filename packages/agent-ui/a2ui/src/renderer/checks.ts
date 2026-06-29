// checks.ts — A2UI `checks` reactive controller (renderer LLD-C13, ADR-0029).
//
// Installs scope-owned effects that run each check's `{call,args}` via `evaluate` (ADR-0026) and
// drive the control's validity or disabled state — all client-side (no server error, no ErrorCode).
//
// Two wire shapes accepted (ADR-0029 §1 / Postel — mirrors the action-shape Postel reader):
//   FLAT (canonical TextField example):    { call, args?, message }
//   CONDITION wrapper (Button example):    { condition: { call, args }, message }
// Both are normalised to a single `Check` internal type before evaluation.
//
// Semantics per check:
//   call returns TRUE (or `{valid:true}`)  → valid (no contribution)
//   call returns FALSE (or `{valid:false}`) → invalid — surface the `message`
//   call returns undefined (FUNCTION error from evaluator) → treated as INVALID (fault-gate, ADR-0029 §8)
//
// Target dispatch (ADR-0029 §5/§7):
//   el has setCustomValidity (UIFormElement — TextField etc.):
//     first failing check → setCustomValidity(message); all pass → setCustomValidity('')
//   el is a Button (no setCustomValidity, has a reflecting `disabled` prop):
//     any failing check → el.disabled = true; all pass → restore the node's declared disabled
//   neither → no-op (an unrecognised element type with `checks`)
//
// Leak-free (SPEC-N3): each effect is scope-owned — `scope` is the surface scope for static nodes
// or a per-item child scope for list items (so a removed list item's checks die with the item,
// not at surface teardown). All effects in one scope, one scope.run().

import { effect } from '@agent-ui/components'
import type { Scope } from '@agent-ui/components'
import type { FunctionCall, A2uiComponent, A2uiError } from '../protocol.ts'
import type { CatalogRegistry } from '../catalog/types.ts'
import type { Surface } from './surface.ts'
import type { ItemScope } from './types.ts'
import { evaluate } from './functions.ts'

// ── internal normalised check shape ───────────────────────────────────────────

/**
 * One normalised check: a `{call,args?}` function-call to evaluate + the human message to surface
 * when the call returns falsy. Internal representation only — both wire shapes map here.
 */
interface Check {
  fn: FunctionCall
  message: string
}

/**
 * Tolerant reader for one raw `checks` entry (ADR-0029 §1 — Postel's law, mirrors the action reader).
 * Accepts either the flat `{call,args?,message}` shape or the `condition`-wrapped `{condition:{call,args},message}`
 * shape. Any other shape returns `null` (skipped, non-fatal — `checks` is not user-submitted data).
 */
function readCheck(raw: unknown): Check | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>

  // CONDITION wrapper: `{ condition: { call, args? }, message }`
  if (typeof r.condition === 'object' && r.condition !== null && typeof (r.condition as Record<string, unknown>).call === 'string') {
    const c = r.condition as Record<string, unknown>
    if (typeof r.message !== 'string') return null
    return {
      fn: {
        call: c.call as string,
        args: isArgsObject(c.args) ? c.args : undefined,
      },
      message: r.message,
    }
  }

  // FLAT: `{ call, args?, message }` (canonical)
  if (typeof r.call === 'string' && typeof r.message === 'string') {
    return {
      fn: {
        call: r.call,
        args: isArgsObject(r.args) ? r.args : undefined,
      },
      message: r.message,
    }
  }

  return null // unrecognised shape — skip
}

/** Args must be a plain object (not array, not null) to be valid. */
function isArgsObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

// ── check result interpreter ───────────────────────────────────────────────────

/**
 * Interpret a check call's raw return value as a BOOLEAN pass/fail (ADR-0029 §3):
 *   `{valid}` shape (the `required`/`email`/`regex` catalog-function return) → `.valid`
 *   bare boolean → direct
 *   `undefined` (FUNCTION error from evaluator, fault-gate) → treated as false (invalid)
 *   any other truthy → valid; any other falsy → invalid
 */
function checkPassed(result: unknown): boolean {
  if (typeof result === 'object' && result !== null && 'valid' in result) {
    return Boolean((result as { valid: unknown }).valid)
  }
  return Boolean(result)
}

// ── target dispatch ────────────────────────────────────────────────────────────

/** True if `el` has a `setCustomValidity` method (UIFormElement — TextField et al.). */
const hasCustomValidity = (el: HTMLElement): el is HTMLElement & { setCustomValidity(msg: string): void } =>
  typeof (el as { setCustomValidity?: unknown }).setCustomValidity === 'function'

// ── public API ─────────────────────────────────────────────────────────────────

/**
 * Wire the `checks` controller for one component node (renderer LLD-C13, ADR-0029).
 *
 * Called from the renderer host's `createWidget` wrapper after `base(node,…)` builds the control,
 * with `el`/`node`/`surface`/`scope`/`ac`/`itemScope`/`emitError`/`registry` all in scope. If the
 * node has no `checks` array, or it is empty/unrecognised, this is a no-op. Otherwise it installs
 * ONE `scope`-owned effect that evaluates ALL checks and surfaces the first failure (the common UX:
 * one message at a time), then re-evaluates reactively whenever a `{path}` arg's data changes
 * (SPEC-N2, live validation, reused from the existing per-path memo in binding.ts / evaluate).
 *
 * @param el       The mounted control element.
 * @param node     The A2UI component node (may carry `node.checks`).
 * @param surface  The owning surface (data model, catalogId, ids — passed through to evaluate).
 * @param scope    The owning scope (surface scope or per-item child scope — dies with the item, SPEC-N3).
 * @param ac       The AbortController that dies with the item/surface (for future listener use; threaded for symmetry with #wireAction).
 * @param itemScope  Per-item context (list index, relative-path root) — absent for static nodes.
 * @param emitError  The renderer error sink (receives FUNCTION errors from evaluate on unknown/throwing fns).
 * @param registry   The bound-catalog registry (passed through to evaluate for catalog-function lookup).
 */
export function wireChecks(
  el: HTMLElement,
  node: A2uiComponent,
  surface: Surface,
  scope: Scope,
  _ac: AbortController,
  itemScope: ItemScope | undefined,
  emitError: (error: A2uiError) => void,
  registry: CatalogRegistry,
): void {
  // Parse the raw `checks` array. A missing or non-array `checks` is a no-op (the common case).
  if (!Array.isArray(node.checks) || node.checks.length === 0) return

  const checks: Check[] = []
  for (const raw of node.checks) {
    const check = readCheck(raw)
    if (check !== null) checks.push(check)
  }
  if (checks.length === 0) return // all entries were unrecognised — no-op

  // ONE scope-owned effect: evaluates ALL checks, surfaces the first failure. The effect runs
  // inside `scope` (surface or per-item child) so it is disposed when the node/surface is torn down.
  // Each `{path}` arg inside a check's `args` is resolved through `evaluate`→`resolveValue`→`resolve`
  // (the per-path memo), so the effect re-runs when a relevant data-model path changes (SPEC-N2).
  scope.run(() => {
    effect(() => {
      let firstFailingMessage: string | null = null
      for (const check of checks) {
        const result = evaluate(check.fn, surface, itemScope, emitError, registry)
        if (!checkPassed(result)) {
          // Treat `undefined` (FUNCTION error already emitted by evaluate) as invalid (ADR-0029 §8).
          firstFailingMessage = check.message
          break // one message at a time — the first failing check is surfaced
        }
      }

      if (hasCustomValidity(el)) {
        // Input target (UIFormElement — TextField, Checkbox, etc.): drive setCustomValidity.
        // The form base's merged validity effect picks up the #customValidity signal change and
        // re-publishes through internals.setValidity — the control then shows the message via
        // its existing :state(user-invalid) timing (text-field: the visible message node, ADR-0029 A1).
        el.setCustomValidity(firstFailingMessage ?? '')
      } else if ('disabled' in el) {
        // Button target: auto-disable on any failing check (ADR-0029 §7). On pass, restore the
        // node's DECLARED `disabled` literal (v1.0: `disabled` is a boolean, never a binding on the
        // host-managed checks path) — `Boolean(node.disabled)` is the literal read; a `{path}`-bound
        // `disabled` prop has its own scope-owned bind-effect that also writes `el.disabled`, so the
        // checks effect WINS on fail (overwrites to true) and YIELDS on pass (restores the literal).
        ;(el as { disabled: boolean }).disabled = firstFailingMessage !== null ? true : Boolean(node.disabled)
      }
      // else: neither input nor button — no-op (unrecognised target type, non-fatal)
    })
  })
}
