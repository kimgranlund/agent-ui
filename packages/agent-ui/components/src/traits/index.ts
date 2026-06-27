// traits — stateless `(host, opts) => cleanup` behaviours and stateful controllers, invoked directly from a
// control's `connected()` (e.g. `tabbable(this, …)`); there is no `host.use()`.
export { tabbable } from './tabbable.ts'
export type { TabbableOptions } from './tabbable.ts'
