import { describe, it, expect } from 'vitest'
import {
  ACTIVITY_REASONING_CAP,
  activityReasoning,
  formatActivityFooter,
  formatActivityRetries,
  joinActivityRaw,
  totalActivityRetries,
  type ActivityStep,
} from './activity-step.ts'

// The neutral activity model (ADR-0159 amendment, T-0016): pure data plus two formatters. No DOM, no
// A2UI, no catalog. The control-side rendering is conversation.test.ts's; this file pins the formatters.

const step = (id: string, raw?: string): ActivityStep => ({ id, kind: 'k', label: id, status: 'ok', ...(raw === undefined ? {} : { raw }) })

describe('formatActivityFooter', () => {
  it('renders every present fact in a fixed order, with grouped counts and singular/plural nouns', () => {
    expect(formatActivityFooter({ rounds: 2, inputTokens: 3210, outputTokens: 845, model: 'model-x' })).toBe(
      '2 rounds · 3,210 input tokens · 845 output tokens · model-x',
    )
    expect(formatActivityFooter({ rounds: 1, inputTokens: 1, outputTokens: 1 })).toBe('1 round · 1 input token · 1 output token')
  })

  it('absent facts render nothing: an empty footer is the empty string, a partial one shows only what it has', () => {
    expect(formatActivityFooter({})).toBe('')
    expect(formatActivityFooter({ model: 'model-x' })).toBe('model-x')
    expect(formatActivityFooter({ outputTokens: 12 })).toBe('12 output tokens')
  })

  it('a malformed number (NaN, negative, infinite) or an empty model is dropped, never printed', () => {
    expect(formatActivityFooter({ rounds: Number.NaN, inputTokens: -1, outputTokens: Number.POSITIVE_INFINITY, model: '' })).toBe('')
  })
})

describe('joinActivityRaw', () => {
  it('returns every distinct non-empty raw once, in step order, blank-line separated', () => {
    expect(joinActivityRaw([step('a', 'A'), step('b'), step('c', ''), step('d', 'D'), step('e', 'A')])).toBe('A\n\nD')
  })

  it('no step carries raw: the empty string (the strip then renders no raw row)', () => {
    expect(joinActivityRaw([step('a'), step('b')])).toBe('')
  })
})

describe('retries (T-0019)', () => {
  const retried = (id: string, retries: unknown): ActivityStep => ({ id, kind: 'k', label: id, status: 'repaired', retries: retries as number })

  it('sums every step retry count and formats it singular or plural', () => {
    expect(totalActivityRetries([retried('a', 1), retried('b', 2), step('c')])).toBe(3)
    expect(formatActivityRetries(1)).toBe('1 retry')
    expect(formatActivityRetries(3)).toBe('3 retries')
  })

  it('zero, negative, NaN or non-number counts are ignored, so a clean turn has no marker', () => {
    expect(totalActivityRetries([step('a'), retried('b', 0), retried('c', -2), retried('d', Number.NaN), retried('e', '2')])).toBe(0)
  })
})

describe('reasoning (T-0021, ADR-0240)', () => {
  const thought = (reasoning: unknown): ActivityStep => ({ id: 'r', kind: 'reasoning', label: 'Reasoned', status: 'ok', reasoning: reasoning as string })

  it('returns the text as handed when it is within the cap, and never trims or rewrites it', () => {
    expect(activityReasoning(thought('Weigh the hit risk.\n\nStand on 17.'))).toBe('Weigh the hit risk.\n\nStand on 17.')
    expect(activityReasoning(thought('x'.repeat(ACTIVITY_REASONING_CAP))), 'exactly at the cap is not truncated').toBe('x'.repeat(ACTIVITY_REASONING_CAP))
  })

  it('cuts text over the cap at the cap and says so with an explicit marker, never silently', () => {
    const out = activityReasoning(thought('y'.repeat(ACTIVITY_REASONING_CAP + 50)))
    expect(out.startsWith('y'.repeat(ACTIVITY_REASONING_CAP))).toBe(true)
    expect(out.length, 'the cut text is the cap plus the marker only').toBeLessThan(ACTIVITY_REASONING_CAP + 30)
    expect(out).toMatch(/\[truncated\]$/)
  })

  it('absent, empty, whitespace-only or non-string reasoning is the empty string (the step then shows no panel)', () => {
    expect(activityReasoning({ id: 'r', kind: 'k', label: 'Reasoned', status: 'ok' })).toBe('')
    expect(activityReasoning(thought(''))).toBe('')
    expect(activityReasoning(thought('  \n\t '))).toBe('')
    expect(activityReasoning(thought(42))).toBe('')
    expect(activityReasoning(thought(null))).toBe('')
  })

  it('reasoning is its own field: it never joins the single raw block', () => {
    expect(joinActivityRaw([{ ...thought('private thoughts'), raw: '{"a":1}' }])).toBe('{"a":1}')
    expect(joinActivityRaw([thought('private thoughts')])).toBe('')
  })
})
