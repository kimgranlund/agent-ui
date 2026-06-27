// components — the self-defining ui-* FACE-control family barrel (ADR-0003). Importing this module pulls in
// every control, each of which `customElements.define`s its tag as a top-level side effect, so importing the
// package `./components` entry registers the whole family in one line (today: ui-button). Re-exporting each
// control's module ALSO surfaces its element class (e.g. UIButtonElement) for typed references. Layer-4
// barrel: composes the controls layer only; never reaches into kernel internals.
export * from './button/button.ts'
