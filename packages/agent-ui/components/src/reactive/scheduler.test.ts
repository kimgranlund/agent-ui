import { describe, it, expect } from 'vitest'
import { schedule, dequeue, flush, whenFlushed } from './scheduler.ts'

// K4 — scheduler discipline. Tested against bare Schedulable stubs ({ run() }), so this
// file never touches the graph half.
describe('scheduler (K4)', () => {
  it('batch-dedupe: a Schedulable queued twice runs once per wave', () => {
    let runs = 0
    const s = { run() { runs++ } }
    schedule(s)
    schedule(s)
    flush()
    expect(runs).toBe(1)
  })

  it('budget-throws: a self-rescheduling effect throws instead of hanging', () => {
    const s = { run() { schedule(s) } } // never settles
    schedule(s)
    expect(() => flush()).toThrow(/100 waves/)
  })

  it('dequeue-on-dispose: a dequeued effect does not run', () => {
    let runs = 0
    const s = { run() { runs++ } }
    schedule(s)
    dequeue(s)
    flush()
    expect(runs).toBe(0)
  })

  it('when-flushed resolves after the batch settles (microtask-driven)', async () => {
    let ran = false
    schedule({ run() { ran = true } })
    await whenFlushed()
    expect(ran).toBe(true)
  })

  it('throw-no-wedge: a throwing effect rethrows but never wedges the queue', () => {
    const boom = { run() { throw new Error('boom') } }
    schedule(boom)
    expect(() => flush()).toThrow('boom')
    // not wedged: a fresh schedule re-arms and drains
    let ran = false
    schedule({ run() { ran = true } })
    flush()
    expect(ran).toBe(true)
  })
})
