// theme-loader.ts — TKT-0088/ADR-0141 cl.4: the SITE-SIDE on-demand pack loader + persistence. The
// packaged `ui-theme-provider` component stays untouched (its LLD's own prediction for this seam) —
// `theme`/`scheme` are plain reflected attributes with zero fetch/env code inside the component; every
// concern here (which packs exist, when to inject them, what to remember across a reload) is the APP's,
// living site-side, the same discipline the DEV-only live-agent seams already established.
//
// A pack's stylesheet is injected LAZILY (only once the app actually selects it) via a real `<link>`
// element, never bundled eagerly — Vite's `?url` import suffix resolves the pack to a servable URL
// string without inlining its CSS into the JS graph (verified live under `vite dev`, 2026-07-17: the
// `@agent-ui/shared/themes/*` export subpath + `?url` resolves to the real wrapped pack file). Once
// injected, a pack's `<link>` is never removed — switching AWAY from a theme just re-points the
// provider's `theme` attribute; switching BACK is instant (the stylesheet is already loaded).

const THEME_KEY = 'agent-ui.theme'
const SCHEME_KEY = 'agent-ui.scheme'

/** The packs this build knows how to load, in picker-display order. `'default'` is pack ZERO (ADR-0141
 *  cl.2) — it needs no stylesheet at all, since `tokens.css`'s `:root` IS the default. */
export const THEME_OPTIONS = [
  { id: 'default', label: 'Default' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'ember', label: 'Ember' },
] as const

export type ThemeId = (typeof THEME_OPTIONS)[number]['id']
export type SchemeId = '' | 'light' | 'dark'

const injected = new Set<string>()

/** Lazy-inject `name`'s pack stylesheet the FIRST time it's selected (a no-op on every later call for
 *  the same name — `injected` is the idempotency guard, not a DOM query, since a query would re-pay a
 *  layout cost every call for no reason). `'default'` never reaches this — see `applyTheme`. */
async function ensurePackLoaded(name: Exclude<ThemeId, 'default'>): Promise<void> {
  if (injected.has(name)) return
  injected.add(name)
  const href = (await import(`@agent-ui/shared/themes/${name}.css?url`)).default as string
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.dataset.themePack = name
  document.head.append(link)
}

/** Apply a theme to `provider` — the default clears the attribute (pack zero needs no stylesheet, ever);
 *  any other id lazy-loads its pack first, then sets `theme` so `[theme='<id>']`'s CSS actually matches
 *  something. Awaits the load so a caller can rely on the repaint having happened by the time this
 *  resolves (the picker uses this to avoid a visible flash of unstyled `[theme]`). */
export async function applyTheme(provider: { theme: string }, id: ThemeId): Promise<void> {
  if (id === 'default') {
    provider.theme = ''
    return
  }
  await ensurePackLoaded(id)
  provider.theme = id
}

/** Apply a scheme to `provider` — `''` is the ADR-0117 unset-inherits value (tracks the OS / an
 *  ancestor), never re-mapped to `'light'`. */
export function applyScheme(provider: { scheme: string }, scheme: SchemeId): void {
  provider.scheme = scheme
}

/** Persist a choice for the next page load. `localStorage` may be unavailable (privacy mode, SSR-ish
 *  test harnesses) — persistence degrading to session-only is an acceptable fallback, never a throw. */
export function persistTheme(id: ThemeId): void {
  try {
    localStorage.setItem(THEME_KEY, id)
  } catch {
    /* unavailable — the choice still applies this session, it just won't survive a reload */
  }
}
export function persistScheme(scheme: SchemeId): void {
  try {
    localStorage.setItem(SCHEME_KEY, scheme)
  } catch {
    /* see persistTheme */
  }
}

/** Read back a prior session's choice — an unrecognized/missing value degrades to the default
 *  (`'default'` theme, `''` unset scheme) rather than throwing or guessing. */
export function loadPersistedTheme(): ThemeId {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    return THEME_OPTIONS.some((o) => o.id === raw) ? (raw as ThemeId) : 'default'
  } catch {
    return 'default'
  }
}
export function loadPersistedScheme(): SchemeId {
  try {
    const raw = localStorage.getItem(SCHEME_KEY)
    return raw === 'light' || raw === 'dark' ? raw : ''
  } catch {
    return ''
  }
}
