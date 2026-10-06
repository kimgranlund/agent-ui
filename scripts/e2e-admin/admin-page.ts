// scripts/e2e-admin/admin-page.ts: the page object over the booted agent-admin app.
//
// Drives only the component's `data-part` hooks (plus the composer's editor and send parts), so a CSS band
// swap cannot move a flow's click target. DOM state is read with `page.evaluate` and structural casts;
// nothing here imports the component, so Node type stripping never loads a DOM module.
//
// Every wait is this module's own poll and raises `FlowAssertion` on its timeout (15 s by default), never a
// Playwright `TimeoutError`: a negative control counts only `FlowAssertion` as the expected red.

import type { Page } from 'playwright'
import { FlowAssertion, type AdminScenario } from './scenario.ts'

export const ADMIN_SELECTORS = {
  admin: 'ui-agent-admin',
  adminHeader: '[data-part="admin-header"]',
  agentSelect: '[data-part="agent-select"]',
  agentSelectTrigger: '[data-part="agent-select"] [data-part="trigger"]',
  newAgentNarrow: '[data-part="new-agent-narrow"]',
  newAgentWide: '[data-part="new-agent-wide"]',
  overflowMenu: '[data-part="overflow-menu"]',
  panePills: '[data-part="pane-pills"]',
  paneSegments: '[data-part="pane-segments"]',
  chatPane: '[data-part="chat-pane"]',
  copilotPane: '[data-part="copilot-pane"]',
  settingsPane: '[data-part="settings-pane"]',
  settingsNav: '[data-part="settings-nav"]',
  kindEnabled: '[data-part="kind-enabled"]',
  resetAgentButton: '[data-part="reset-agent-button"]',
  contextTurn: '[data-part="context-turn"]',
  composerEditor: 'ui-conversation-composer [data-part="editor"]',
  composerSend: 'ui-conversation-composer [data-part="send"]',
  surfaceButton: '[data-part="mounts"] ui-surface-host ui-button',
  surfaceHost: '[data-part="mounts"] ui-surface-host',
  flowChrome: '[data-part="log"] [role="group"][aria-label="Flow complete"]',
  contextJson: '[data-part="context-json"]',
} as const

/** The settings sections, keyed by their `data-role` (the `settings-nav` tab key). */
export type SettingsRole =
  | 'agent-content'
  | 'capabilities-content'
  | 'surface-content'
  | 'context-system-content'
  | 'context-dialog-content'

export interface TranscriptTurn {
  role: string
  content: string
}

export interface DialogTurnRow {
  item: string
  open: boolean
  /** The row's parsed `{arm, request, response}` record, or `undefined` when its JSON body is absent. */
  record?: { arm?: unknown; request?: unknown; response?: unknown }
}

/** Which conversation a surface reader or click addresses. */
export type ConversationPane = 'chat' | 'copilot'

export const APP_PATH = '/agent-admin-app.html'
const SEED_MARKER = '__e2eAdminSeeded'
let defaultWaitMs = 15_000

/** Record mode waits on a live model, so it raises the default wait. Runs never call this. */
export function setDefaultWaitMs(ms: number): void {
  defaultWaitMs = ms
}

/** Poll `probe` until `accept` holds; raise `FlowAssertion` naming `what` on timeout. A probe that throws
 *  (a navigation tearing the execution context down) is retried, not fatal. */
export async function pollUntil<T>(
  probe: () => Promise<T>,
  accept: (value: T) => boolean,
  what: string,
  timeoutMs: number = defaultWaitMs,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  let last = 'no probe ran'
  for (;;) {
    try {
      const value = await probe()
      if (accept(value)) return value
      last = `last value ${JSON.stringify(value)}`
    } catch (err) {
      last = `last error ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`
    }
    if (Date.now() >= deadline) throw new FlowAssertion(`timed out after ${timeoutMs} ms waiting for ${what} (${last})`)
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
}

/** Structural view of the element's public surface, as `page.evaluate` sees it. */
interface AdminElementView extends HTMLElement {
  agentSurfaceTurn?: unknown
  authoringStore?: unknown
  testChatTranscript(): readonly TranscriptTurn[]
  builderInterviewTranscript(): readonly TranscriptTurn[]
  liveTurnCount(): number
}

export class AdminPage {
  readonly page: Page

  constructor(page: Page) {
    this.page = page
  }

  /** Whether `ui-agent-admin` has its surface-turn runner set (the page arms it after `/status`). */
  async isArmed(): Promise<boolean> {
    return this.page.evaluate((selector) => {
      const admin = document.querySelector(selector) as (Element & { agentSurfaceTurn?: unknown }) | null
      return admin !== null && admin.agentSurfaceTurn !== undefined
    }, ADMIN_SELECTORS.admin)
  }

  async waitArmed(timeoutMs?: number): Promise<void> {
    await pollUntil(() => this.isArmed(), (armed) => armed, 'the surface-turn runner to arm', timeoutMs)
  }

  /** Wait for one element to exist, then click it with a DOM click (works on an overflowed tab too). */
  async #click(selector: string, what: string): Promise<void> {
    await pollUntil(
      () => this.page.evaluate((s) => document.querySelector(s) !== null, selector),
      (found) => found,
      what,
    )
    await this.page.evaluate((s) => (document.querySelector(s) as HTMLElement).click(), selector)
  }

  async #sendThrough(paneSelector: string, text: string, label: string): Promise<void> {
    const editor = `${paneSelector} ${ADMIN_SELECTORS.composerEditor}`
    const send = `${paneSelector} ${ADMIN_SELECTORS.composerSend}`
    await pollUntil(
      () =>
        this.page.evaluate((s) => {
          const el = document.querySelector(s) as HTMLElement | null
          return el !== null && el.getClientRects().length > 0 && el.isContentEditable
        }, editor),
      (ready) => ready,
      `the ${label} composer to be visible and editable`,
    )
    await this.page.evaluate(
      ({ editorSelector, sendSelector, value }) => {
        const el = document.querySelector(editorSelector) as HTMLElement
        el.focus()
        el.textContent = value
        el.dispatchEvent(new Event('input', { bubbles: true }))
        ;(document.querySelector(sendSelector) as HTMLElement).click()
      },
      { editorSelector: editor, sendSelector: send, value: text },
    )
  }

  /** Type into the Test Chat composer and send. */
  sendTestChat(text: string): Promise<void> {
    return this.#sendThrough(ADMIN_SELECTORS.chatPane, text, 'Test Chat')
  }

  /** Type into the Builder (Co-pilot) composer and send. */
  sendBuilderChat(text: string): Promise<void> {
    return this.#sendThrough(ADMIN_SELECTORS.copilotPane, text, 'Builder')
  }

  /** Wait until `liveTurnCount()` passes `since`; resolves the new count. */
  waitForTurn(since: number, timeoutMs?: number): Promise<number> {
    return pollUntil(() => this.liveTurnCount(), (count) => count > since, `a turn after #${since}`, timeoutMs)
  }

  /** Click the header's wide New Agent button (mints a draft and arms the Builder). */
  newAgent(): Promise<void> {
    return this.#click(ADMIN_SELECTORS.newAgentWide, 'the New Agent button')
  }

  /** Pick a persona through the header's agent select, then wait for the selection to land. */
  async switchPersona(id: string): Promise<void> {
    await this.#click(ADMIN_SELECTORS.agentSelectTrigger, 'the agent select trigger')
    await this.#click(`${ADMIN_SELECTORS.agentSelect} [role="option"][value="${id}"]`, `the agent option "${id}"`)
    await pollUntil(() => this.activeAgentId(), (value) => value === id, `the active agent to become "${id}"`)
  }

  /** The agent select's committed value: the active persona id. */
  activeAgentId(): Promise<string> {
    return this.page.evaluate((selector) => {
      const select = document.querySelector(selector) as (Element & { value?: unknown }) | null
      return typeof select?.value === 'string' ? select.value : ''
    }, ADMIN_SELECTORS.agentSelect)
  }

  /** Whether the Builder is armed (`authoringStore` set). */
  isAuthoringArmed(): Promise<boolean> {
    return this.page.evaluate((selector) => {
      const admin = document.querySelector(selector) as AdminElementView | null
      if (admin === null) throw new Error(`no ${selector} on the page`)
      return admin.authoringStore !== undefined
    }, ADMIN_SELECTORS.admin)
  }

  /** Select a settings section through its `settings-nav` tab, then wait for the section to show. */
  async openSettingsTab(role: SettingsRole): Promise<void> {
    await this.#click(`${ADMIN_SELECTORS.settingsNav} ui-tab[key="${role}"]`, `the settings tab "${role}"`)
    await pollUntil(
      () =>
        this.page.evaluate((r) => {
          const section = document.querySelector(`[data-role="${r}"]`) as HTMLElement | null
          return section !== null && !section.hidden
        }, role),
      (shown) => shown,
      `the "${role}" section to show`,
    )
  }

  /** The Context: Dialog rows, newest first. */
  readDialogTurns(): Promise<DialogTurnRow[]> {
    return this.page.evaluate((selectors) => {
      const section = document.querySelector('[data-role="context-dialog-content"]')
      return [...(section?.querySelectorAll(selectors.row) ?? [])].map((row) => {
        const text = row.querySelector(selectors.json)?.textContent ?? ''
        let record: { arm?: unknown; request?: unknown; response?: unknown } | undefined
        try {
          record = text === '' ? undefined : (JSON.parse(text) as typeof record)
        } catch {
          record = undefined
        }
        return {
          item: row.getAttribute('data-item') ?? '',
          open: (row as Element & { open?: unknown }).open === true,
          ...(record !== undefined ? { record } : {}),
        }
      })
    }, { row: ADMIN_SELECTORS.contextTurn, json: ADMIN_SELECTORS.contextJson })
  }

  /** `testChatTranscript()`: the Test Chat exchanges, every arm. */
  readTestTranscript(): Promise<TranscriptTurn[]> {
    return this.page.evaluate((selector) => {
      const admin = document.querySelector(selector) as AdminElementView | null
      if (admin === null) throw new Error(`no ${selector} on the page`)
      return admin.testChatTranscript().map((t) => ({ role: t.role, content: t.content }))
    }, ADMIN_SELECTORS.admin)
  }

  /** `builderInterviewTranscript()`: the Builder interview exchanges. */
  readBuilderTranscript(): Promise<TranscriptTurn[]> {
    return this.page.evaluate((selector) => {
      const admin = document.querySelector(selector) as AdminElementView | null
      if (admin === null) throw new Error(`no ${selector} on the page`)
      return admin.builderInterviewTranscript().map((t) => ({ role: t.role, content: t.content }))
    }, ADMIN_SELECTORS.admin)
  }

  /** `liveTurnCount()`: turns run since the last persona switch, failures included. */
  liveTurnCount(): Promise<number> {
    return this.page.evaluate((selector) => {
      const admin = document.querySelector(selector) as AdminElementView | null
      if (admin === null) throw new Error(`no ${selector} on the page`)
      return admin.liveTurnCount()
    }, ADMIN_SELECTORS.admin)
  }

  readStorage(key: string): Promise<string | null> {
    return this.page.evaluate((k) => localStorage.getItem(k), key)
  }

  /** Every localStorage key that starts with `prefix`, with its raw value. */
  readStorageWithPrefix(prefix: string): Promise<Record<string, string>> {
    return this.page.evaluate((p) => {
      const out: Record<string, string> = {}
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i)
        if (key !== null && key.startsWith(p)) out[key] = localStorage.getItem(key) ?? ''
      }
      return out
    }, prefix)
  }

  /** The labels of every `ui-button` rendered inside a pane's A2UI surface hosts, in document order. */
  surfaceButtonLabels(pane: ConversationPane = 'chat'): Promise<string[]> {
    return this.page.evaluate(
      (selector) => [...document.querySelectorAll(selector)].map((b) => b.textContent?.trim() ?? ''),
      `${paneSelector(pane)} ${ADMIN_SELECTORS.surfaceButton}`,
    )
  }

  /** How many A2UI surface hosts a pane has mounted. */
  surfaceHostCount(pane: ConversationPane = 'chat'): Promise<number> {
    return this.page.evaluate(
      (selector) => document.querySelectorAll(selector).length,
      `${paneSelector(pane)} ${ADMIN_SELECTORS.surfaceHost}`,
    )
  }

  /** Wait for a surface button reading `label` in the pane, then click it (the real A2UI action path). */
  async clickSurfaceButton(label: string, pane: ConversationPane = 'chat'): Promise<void> {
    const selector = `${paneSelector(pane)} ${ADMIN_SELECTORS.surfaceButton}`
    await pollUntil(
      () => this.surfaceButtonLabels(pane),
      (labels) => labels.includes(label),
      `a surface button reading "${label}" in the ${pane} pane`,
    )
    await this.page.evaluate(
      ({ s, l }) => {
        const button = [...document.querySelectorAll<HTMLElement>(s)].find((b) => b.textContent?.trim() === l)
        button?.click()
      },
      { s: selector, l: label },
    )
  }

  /** Answer a declared ask by clicking its button, then wait for the answered round's turn to land. */
  async answerAsk(label: string, pane: ConversationPane = 'chat'): Promise<number> {
    const since = await this.liveTurnCount()
    await this.clickSurfaceButton(label, pane)
    return this.waitForTurn(since)
  }

  /** Whether the page's end-of-flow chrome row sits in the Test Chat log. */
  hasFlowChrome(): Promise<boolean> {
    return this.page.evaluate(
      (selector) => document.querySelector(selector) !== null,
      `${ADMIN_SELECTORS.chatPane} ${ADMIN_SELECTORS.flowChrome}`,
    )
  }

  /** The settings nav's selected section key (`settings-nav`'s `selected`). */
  settingsSection(): Promise<string> {
    return this.page.evaluate((selector) => {
      const nav = document.querySelector(selector) as (Element & { selected?: unknown }) | null
      return typeof nav?.selected === 'string' ? nav.selected : ''
    }, ADMIN_SELECTORS.settingsNav)
  }

  /** The Agent section's `name` field: the `ui-text-field` the settings generator names `name`. */
  #agentNameSelector(): string {
    return `[data-role="agent-content"] ui-settings ui-text-field[name="name"]`
  }

  /** The Agent section's `name` field value, or `undefined` while the field is not rendered. */
  readAgentName(): Promise<string | undefined> {
    return this.page.evaluate((selector) => {
      const field = document.querySelector(selector) as (Element & { value?: unknown }) | null
      return typeof field?.value === 'string' ? field.value : undefined
    }, this.#agentNameSelector())
  }

  /** Write `value` into the Agent section's `name` field and fire its commit event (`change`), the event
   *  the settings generator persists on. */
  async editAgentName(value: string): Promise<void> {
    const selector = this.#agentNameSelector()
    await pollUntil(() => this.readAgentName(), (current) => current !== undefined, 'the Agent section name field')
    await this.page.evaluate(
      ({ s, v }) => {
        const field = document.querySelector(s) as HTMLElement & { value: string }
        field.value = v
        field.dispatchEvent(new Event('change', { bubbles: true }))
      },
      { s: selector, v: value },
    )
  }

  /** A capability kind's master switch state (`kind-enabled` on the kind's settings fold), or `undefined`. */
  kindEnabled(kind: string): Promise<boolean | undefined> {
    return this.page.evaluate((selector) => {
      const toggle = document.querySelector(selector) as (Element & { checked?: unknown }) | null
      return typeof toggle?.checked === 'boolean' ? toggle.checked : undefined
    }, kindSwitchSelector(kind))
  }

  /** Click a capability kind's master switch (`kind-enabled`), then wait for its checked state to flip. */
  async toggleKind(kind: string): Promise<void> {
    const before = await pollUntil(() => this.kindEnabled(kind), (v) => v !== undefined, `the "${kind}" kind-enabled switch`)
    await this.#click(kindSwitchSelector(kind), `the "${kind}" kind-enabled switch`)
    await pollUntil(() => this.kindEnabled(kind), (v) => v === !before, `the "${kind}" kind-enabled switch to flip`)
  }

  /** The labels of a kind's entry rows, in list order. */
  entryLabels(kind: string): Promise<string[]> {
    return this.page.evaluate(
      (selector) => [...document.querySelectorAll(selector)].map((l) => l.textContent?.trim() ?? ''),
      `${entrySectionSelector(kind)} [data-part="entry-list"] [data-part="entry"] [data-part="entry-label"]`,
    )
  }

  /** Add an entry through the kind's Add drawer: open it, fill the Name field, click Add, and wait for the
   *  row to render. */
  async addEntry(kind: string, label: string): Promise<void> {
    const section = entrySectionSelector(kind)
    const labelField = `${section} [data-part="entry-drawer-content"] [data-part="entry-add-label"]`
    await this.#click(`${section} > [data-part="entry-add-toggle"]`, `the "${kind}" Add entry button`)
    await pollUntil(
      () => this.page.evaluate((s) => document.querySelector(s) !== null, labelField),
      (found) => found,
      `the "${kind}" Add drawer name field`,
    )
    await this.page.evaluate(
      ({ s, v }) => {
        const field = document.querySelector(s) as HTMLElement & { value: string }
        field.value = v
        field.dispatchEvent(new Event('input', { bubbles: true }))
      },
      { s: labelField, v: label },
    )
    await this.#click(`${section} [data-part="entry-drawer-footer"] [data-part="entry-add-submit"]`, `the "${kind}" Add submit button`)
    await pollUntil(() => this.entryLabels(kind), (labels) => labels.includes(label), `a "${kind}" entry row labelled "${label}"`)
  }

  /** Remove an entry through its Edit drawer's Remove button, then wait for the row to go. */
  async removeEntry(kind: string, label: string): Promise<void> {
    const section = entrySectionSelector(kind)
    await pollUntil(() => this.entryLabels(kind), (labels) => labels.includes(label), `a "${kind}" entry row labelled "${label}"`)
    await this.page.evaluate(
      ({ s, l }) => {
        const row = [...document.querySelectorAll(`${s} [data-part="entry-list"] [data-part="entry"]`)].find(
          (r) => r.querySelector('[data-part="entry-label"]')?.textContent?.trim() === l,
        )
        ;(row?.querySelector('[data-part="entry-edit"]') as HTMLElement | null)?.click()
      },
      { s: section, l: label },
    )
    await this.#click(`${section} [data-part="entry-drawer-footer"] [data-part="entry-delete"]`, `the "${kind}" Remove button for "${label}"`)
    await pollUntil(() => this.entryLabels(kind), (labels) => !labels.includes(label), `the "${kind}" entry "${label}" to go`)
  }

  /** Click the Model fold's Reset Agent button. The page resets without a confirm today; should a native
   *  confirm ever open, it is accepted. */
  async resetAgent(): Promise<void> {
    const accept = (dialog: { accept(): Promise<void> }): void => void dialog.accept()
    this.page.once('dialog', accept)
    try {
      await this.#click(ADMIN_SELECTORS.resetAgentButton, 'the Reset Agent button')
    } finally {
      this.page.off('dialog', accept)
    }
  }

  /** Whether a pane's composer send control is enabled (the composer disables it while a turn is busy). */
  composerSendEnabled(pane: ConversationPane = 'chat'): Promise<boolean> {
    return this.page.evaluate((selector) => {
      const send = document.querySelector(selector) as (Element & { disabled?: unknown }) | null
      if (send === null) throw new Error(`no ${selector} on the page`)
      return send.disabled !== true
    }, `${paneSelector(pane)} ${ADMIN_SELECTORS.composerSend}`)
  }

  /** The agent select's option values: the header roster's persona ids. */
  rosterIds(): Promise<string[]> {
    return this.page.evaluate(
      (selector) => [...document.querySelectorAll(selector)].map((o) => o.getAttribute('value') ?? ''),
      `${ADMIN_SELECTORS.agentSelect} [role="option"]`,
    )
  }
}

function paneSelector(pane: ConversationPane): string {
  return pane === 'chat' ? ADMIN_SELECTORS.chatPane : ADMIN_SELECTORS.copilotPane
}

function kindSwitchSelector(kind: string): string {
  return `[data-part="settings-item"][data-item="${kind}"] ${ADMIN_SELECTORS.kindEnabled}`
}

function entrySectionSelector(kind: string): string {
  return `[data-part="entry-section"][data-kind="${kind}"]`
}

/** Seed storage (once per tab, so a reload keeps edits made since), open the app, and wait until the page
 *  has armed `ui-agent-admin`'s surface-turn runner. */
export async function openAdmin(
  page: Page,
  base: string,
  scenario: AdminScenario,
  options: { timeoutMs?: number } = {},
): Promise<AdminPage> {
  const origin = new URL(base).origin
  await page.context().addInitScript(
    ({ seed, marker, expectedOrigin }) => {
      try {
        if (location.origin !== expectedOrigin) return
        if (sessionStorage.getItem(marker) !== null) return
        for (const [key, value] of Object.entries(seed)) localStorage.setItem(key, value)
        sessionStorage.setItem(marker, '1')
      } catch {
        // an opaque-origin document (about:blank) has no storage to seed
      }
    },
    { seed: scenario.seed?.localStorage ?? {}, marker: SEED_MARKER, expectedOrigin: origin },
  )
  await page.goto(`${base}${APP_PATH}`)
  const admin = new AdminPage(page)
  await admin.waitArmed(options.timeoutMs)
  return admin
}
