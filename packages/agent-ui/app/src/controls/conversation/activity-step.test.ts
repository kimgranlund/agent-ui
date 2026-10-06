import { describe, it, expect } from 'vitest'
import { formatActivityFooter, joinActivityRaw, type ActivityStep } from './activity-step.ts'

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
