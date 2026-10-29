// site/lib/control-subpaths.ts — the getting-started page's per-control import derivation, pulled out of the page
// so a test can pin it. The components exports map carries two keys per control (`./controls/{name}` the module,
// `./controls/{name}.css` the sheet); only the module keys name a control, so the list and its count read those.

/** The `./controls/{name}` module subpaths of an exports map, sorted; `.css` sheet subpaths are not controls. */
export function controlModuleSubpaths(exportsMap: Record<string, unknown>): string[] {
  return Object.keys(exportsMap)
    .filter((k) => k.startsWith('./controls/') && !k.endsWith('.css'))
    .sort()
}
