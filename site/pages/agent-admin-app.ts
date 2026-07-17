// site/pages/agent-admin-app.ts — the STANDALONE ui-agent-admin surface (agent-admin-app.html): the full
// live composition filling the viewport with NO docs container shell — no nav, no prose, no resize frame
// (the gallery.ts ungrouped-entry precedent; agent-admin.ts remains the docs COMPOSITION GUIDE and owns
// the teaching page). Deliberately does NOT import './_page.ts' (that IS the docs shell): the foundation
// cascade is imported directly in the same [1]→[3b] order _page.ts documents.
import '@agent-ui/components/foundation-styles.css' // [1] foundation: tokens.css → dimensions.css (FIRST)
import '@agent-ui/components/base-styles.css' // [1b] the DOCUMENT BASE layer: typeface/leading/ink/rendering (shell-less pages need this or they render in the UA serif)
import '@agent-ui/components/component-styles.css' // [2] per-control CSS, after the foundation
import '@agent-ui/components/components' // [3] self-defining ui-* controls
import '@agent-ui/icons/phosphor' // [3b] the Phosphor default pack — composer/entry-list glyphs render real SVGs
import '@agent-ui/app/master-detail-pane.css'
import '@agent-ui/app/master-detail.css'
import '@agent-ui/app/nav-rail.css'
import '@agent-ui/app/settings.css'
import '@agent-ui/app/conversation.css'
import '@agent-ui/app/conversation-composer.css'
import '@agent-ui/app/surface-host.css'
import '@agent-ui/app/agent-admin.css'
import '@agent-ui/app/master-detail-pane' // self-defines ui-master-detail-pane (composed by ui-settings)
import '@agent-ui/app/master-detail' // self-defines ui-master-detail (composed by ui-settings)
import '@agent-ui/app/nav-rail' // self-defines ui-nav-rail(-group|-item) (composed by ui-settings)
import '@agent-ui/app/settings' // self-defines ui-settings
import '@agent-ui/app/surface-host' // self-defines ui-surface-host (composed by ui-conversation)
import '@agent-ui/app/conversation' // self-defines ui-conversation
import '@agent-ui/app/agent-admin' // self-defines ui-agent-admin
import './agent-admin-app.css' // page-local: full-viewport layout only
import { createMemoryStore } from '@agent-ui/app/settings-memory-store'
import type { UIAgentAdminElement } from '@agent-ui/app/agent-admin'

const root = document.querySelector('#app') ?? document.body

// The SAME persistKey as the composition guide's demo — one config, both surfaces (edit on either page,
// the other sees it on reload).
const admin = document.createElement('ui-agent-admin') as UIAgentAdminElement
admin.store = createMemoryStore({ persistKey: 'docs-agent-admin-demo' })
root.append(admin)

// The DEV-only live-model overlay (the agent-admin.ts/a2ui-live.ts construction-site precedent): the
// `import.meta.env.DEV` guard lives HERE in the site page, never in the packaged component — the static
// build never reaches the dynamic import (ADR-0131 cl.4/7). This page has no prose chrome, so the
// stub-vs-live status goes to the console instead of a caption.
if (import.meta.env.DEV) {
  void (async () => {
    try {
      const overlay = await import('../lib/admin-live-runner.ts')
      const probe = await overlay.probeLive()
      if (probe.available) {
        admin.agentTurn = overlay.createAdminAgentTurn()
        console.info(`[agent-admin-app] live model connected (${probe.providers} provider(s))`)
      } else {
        console.info('[agent-admin-app] stub preview — set a provider key in .env and restart `npm run dev` for a live model')
      }
    } catch {
      console.info('[agent-admin-app] stub preview — the live overlay is unavailable')
    }
  })()
}
