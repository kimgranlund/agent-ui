#!/usr/bin/env node
/**
 * scripts/lib/dev-server.mjs: shared boot and teardown helpers for scripts that run a real
 * `vite dev` (scripts/e2e-devtools.mjs, scripts/eval-catalog-gate.mjs, and later headless flows).
 *
 * Exports:
 *   freePort()                 an OS-allocated free port on 127.0.0.1 (never a fixed number)
 *   waitForHttp(url, opts)     poll until the URL answers; rejects past timeoutMs
 *   killTree(child, opts)      signal a detached child's process group, then verify no survivor
 *   assertPortReleased(port)   resolves when nothing accepts on 127.0.0.1:port, rejects otherwise
 *
 * Importing this module has no side effect: the CLI below runs only when this file is the main
 * module.
 *
 * Usage:
 *   node scripts/lib/dev-server.mjs selftest   # negative controls for the helpers
 *
 * Exit codes: 0 = pass, 1 = failure, 2 = usage.
 */

import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import net from 'node:net'
import { fileURLToPath, pathToFileURL } from 'node:url'

/** Resolve a free ephemeral port chosen by the OS, so no run squats a port a person is using. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close((err) => (err ? reject(err) : resolve(port)))
    })
  })
}

/** Poll `url` until fetch resolves ok (with `anyStatus`, any HTTP response counts as listening).
 *  Throws once `timeoutMs` has passed. */
export async function waitForHttp(url, { timeoutMs = 60_000, intervalMs = 250, anyStatus = false } = {}) {
  const deadline = Date.now() + timeoutMs
  let lastErr = 'no attempt'
  for (;;) {
    try {
      const res = await fetch(url)
      if (anyStatus || res.ok) return res
      lastErr = `HTTP ${res.status}`
    } catch (err) {
      lastErr = err instanceof Error ? err.message : String(err)
    }
    if (Date.now() > deadline) throw new Error(`waitForHttp: ${url} not ready after ${timeoutMs}ms (${lastErr})`)
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

/** Signal a detached child's whole process group, then verify nothing survives. A survivor throws:
 *  a leaked process is a loud failure, not a silent one. */
export async function killTree(child, { graceMs = 4000 } = {}) {
  const pid = child.pid
  if (typeof pid !== 'number') throw new Error('killTree: child has no pid')
  const exited = child.exitCode !== null || child.signalCode !== null ? Promise.resolve() : once(child, 'exit')
  try {
    process.kill(-pid, 'SIGTERM') // a negative pid targets the group; detached means pgid equals pid
  } catch (err) {
    if (err.code !== 'ESRCH') throw err // already gone is fine
  }
  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise((r) => setTimeout(() => r(true), graceMs)),
  ])
  if (timedOut) {
    try {
      process.kill(-pid, 'SIGKILL')
    } catch (err) {
      if (err.code !== 'ESRCH') throw err
    }
    await Promise.race([exited, new Promise((r) => setTimeout(r, 2000))])
  }
  // Check 1: the direct pid no longer exists.
  let direct = true
  try {
    process.kill(pid, 0)
  } catch (err) {
    direct = err.code !== 'ESRCH' ? direct : false
  }
  if (direct) throw new Error(`killTree: pid ${pid} still alive after teardown`)
  // Check 2: no member of the group remains (pgrep exits 1 when it finds none).
  const pg = spawnSync('pgrep', ['-g', String(pid)], { encoding: 'utf8' })
  if (pg.status === 0 && pg.stdout.trim() !== '') {
    throw new Error(`killTree: process-group survivors remain: ${pg.stdout.trim().split('\n').join(', ')}`)
  }
}

/** Connect probe after teardown: resolves when 127.0.0.1:port refuses, rejects while it accepts. */
export function assertPortReleased(port) {
  return new Promise((resolve, reject) => {
    const probe = net.connect({ host: '127.0.0.1', port }, () => {
      probe.destroy()
      reject(new Error(`port ${port} still accepting connections after teardown`))
    })
    probe.once('error', () => resolve())
  })
}

// Selftest: negative controls for each helper.

async function selftest() {
  let failures = 0
  const check = (name, ok) => {
    console.log(`${ok ? 'ok' : 'FAIL'} - ${name}`)
    if (!ok) failures += 1
  }

  const p = await freePort()
  const bindable = await new Promise((resolve) => {
    const s = net.createServer()
    s.once('error', () => resolve(false))
    s.listen(p, '127.0.0.1', () => s.close(() => resolve(true)))
  })
  check('freePort returns a bindable port', Number.isInteger(p) && p > 0 && bindable)

  const dead = await freePort()
  const t0 = Date.now()
  const timedOut = await waitForHttp(`http://127.0.0.1:${dead}/nope`, { timeoutMs: 700, intervalMs: 100 }).then(
    () => false,
    () => true,
  )
  check('waitForHttp rejects on a dead port within its timeout', timedOut && Date.now() - t0 < 5000)

  const tree = spawn('sh', ['-c', 'sleep 60 & sleep 60'], { detached: true, stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 200)) // give the shell time to fork its child
  const before = spawnSync('pgrep', ['-g', String(tree.pid)], { encoding: 'utf8' })
  const hadTree = before.status === 0 && before.stdout.trim().split('\n').length >= 2
  let killed = true
  try {
    await killTree(tree)
  } catch {
    killed = false
  }
  check('killTree reaps a detached parent+child tree and verifies it', hadTree && killed)

  const gone = spawn('true', { detached: true, stdio: 'ignore' })
  await once(gone, 'exit')
  const idempotent = await killTree(gone).then(
    () => true,
    () => false,
  )
  check('killTree is idempotent on an already-exited child', idempotent)

  // assertPortReleased: rejects while a server listens, resolves once it has closed.
  const srv = net.createServer()
  await new Promise((r) => srv.listen(0, '127.0.0.1', r))
  const lp = srv.address().port
  const rejected = await assertPortReleased(lp).then(
    () => false,
    () => true,
  )
  check('assertPortReleased rejects while the port still listens', rejected)
  await new Promise((r) => srv.close(r))
  const released = await assertPortReleased(lp).then(
    () => true,
    () => false,
  )
  check('assertPortReleased resolves once the port is closed', released)

  const usage = spawnSync(process.execPath, [fileURLToPath(import.meta.url), 'bogus'], { encoding: 'utf8' })
  check('unknown subcommand exits 2', usage.status === 2)

  console.log(failures === 0 ? 'selftest: all green' : `selftest: ${failures} failure(s)`)
  return failures === 0 ? 0 : 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === 'selftest') {
    process.exit(await selftest())
  } else {
    console.error('usage: node scripts/lib/dev-server.mjs selftest')
    process.exit(2)
  }
}
