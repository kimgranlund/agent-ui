import { describe, it, expect } from 'vitest'
import { exceedsAgentKnowledgeBudget, formatFileSize, MAX_AGENT_KNOWLEDGE_CHARS } from './document-ingest.ts'

// document-ingest.test.ts — GH #1211's OWN additions over the real #1210 extraction seam
// (`@agent-ui/app/document-extraction`/`document-budget`, PR #1217): the per-agent AGGREGATE
// knowledge-budget check and the chip's file-size formatter. The extraction seam itself
// (extractDocumentText/DocumentExtractionError/truncateToBudget) is already covered by its own
// document-extraction.test.ts/document-budget.test.ts — not re-tested here.

describe('exceedsAgentKnowledgeBudget — req-doc-ingestion.md R6, the aggregate cap', () => {
  it('under the budget: false', () => {
    expect(exceedsAgentKnowledgeBudget(0, 1000)).toBe(false)
    expect(exceedsAgentKnowledgeBudget(MAX_AGENT_KNOWLEDGE_CHARS - 1, 1)).toBe(false)
  })

  it('at exactly the budget: false (the cap is inclusive)', () => {
    expect(exceedsAgentKnowledgeBudget(MAX_AGENT_KNOWLEDGE_CHARS, 0)).toBe(false)
    expect(exceedsAgentKnowledgeBudget(0, MAX_AGENT_KNOWLEDGE_CHARS)).toBe(false)
  })

  it('one char past the budget: true', () => {
    expect(exceedsAgentKnowledgeBudget(MAX_AGENT_KNOWLEDGE_CHARS, 1)).toBe(true)
    expect(exceedsAgentKnowledgeBudget(MAX_AGENT_KNOWLEDGE_CHARS + 1, 0)).toBe(true)
  })
})

describe('formatFileSize', () => {
  it('renders bytes, KB, and MB tiers', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})
