// Ambient shim so the load-bearing CSS side-effect imports type-check. The /site code imports the foundation
// + per-component CSS barrels purely for their cascade side effect (see pages/_page.ts); the barrels carry no
// types, so `tsc` needs this `*.css` module declaration — the standard bundler-CSS shim — to resolve them.
declare module '*.css'
