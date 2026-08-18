import { describe, it, expect } from 'vitest'
import { MAX_AGENT_KNOWLEDGE_CHARS, MAX_DOCUMENT_CHARS, MAX_RAW_FILE_BYTES, truncateToBudget } from './document-budget.ts'

describe('document-budget constants (R6)', () => {
  it('states the three hard caps this module owns', () => {
    expect(MAX_RAW_FILE_BYTES).toBe(10 * 1024 * 1024)
    expect(MAX_DOCUMENT_CHARS).toBe(50_000)
    expect(MAX_AGENT_KNOWLEDGE_CHARS).toBe(200_000)
  })
})

describe('truncateToBudget', () => {
  it('is a no-op when text already fits the budget', () => {
    const result = truncateToBudget('hello world', 100)
    expect(result).toEqual({ text: 'hello world', truncated: false, originalChars: 11 })
  })

  it('is a no-op at the exact boundary (text.length === maxChars)', () => {
    const text = 'x'.repeat(50)
    const result = truncateToBudget(text, 50)
    expect(result).toEqual({ text, truncated: false, originalChars: 50 })
  })

  it('head-truncates over-budget text with a VISIBLE marker naming kept-of-original chars', () => {
    const text = 'a'.repeat(1000)
    const result = truncateToBudget(text, 100)
    expect(result.truncated).toBe(true)
    expect(result.originalChars).toBe(1000)
    expect(result.text).toContain('…[truncated:')
    expect(result.text).toMatch(/…\[truncated: \d+ of 1000 chars\]$/)
    // The kept prefix is the text's own head, verbatim, ahead of the marker.
    const keptMatch = result.text.match(/^(a*)…\[truncated: (\d+) of 1000 chars\]$/)
    expect(keptMatch).not.toBeNull()
    expect(keptMatch![1].length).toBe(Number(keptMatch![2]))
  })

  it('never exceeds maxChars, even once the marker itself is counted', () => {
    for (const maxChars of [0, 1, 5, 10, 50, 99, 100, 999, 1000, 9999, 10_000]) {
      const text = 'z'.repeat(20_000)
      const result = truncateToBudget(text, maxChars)
      expect(result.text.length).toBeLessThanOrEqual(maxChars)
    }
  })

  it('treats a non-positive budget as zero — the marker alone, never a thrown error', () => {
    const result = truncateToBudget('some real content here', -5)
    expect(result.truncated).toBe(true)
    expect(result.text.length).toBeLessThanOrEqual(0 > -5 ? 0 : -5) // budget clamps to 0
  })

  it('crossing a digit-width boundary in the kept count still respects the exact budget', () => {
    // originalChars deliberately picked so the marker's own digit count can grow as `kept` is solved for.
    const text = 'q'.repeat(100_000)
    const result = truncateToBudget(text, 12)
    expect(result.text.length).toBeLessThanOrEqual(12)
    expect(result.truncated).toBe(true)
  })
})
