// Reference implementation. Edit CFG to change the system; resolve() and check() follow.
const CFG = {
  ladder: [4, 24],                                   // allowed n; h = 4n
  tiers: { widget: [6, 1, 1, 0], product: [8, 2, 2, 1], content: [10, 2, 2, 1], brand: [14, 2, 2, 1] }, // n0 a k g
  density: { compact: -1, default: 0, spacious: 1 }, // d; m = n + a·d, floored
  linear: { body: [12, 1], control: [11, 1], fieldLabel: [9, 1], groupLabel: [9, 0.5] },              // px at n=5, px per step; never below floor
  Q: [1.25, 1 / 32],                                 // heading ratio at n=5, per step
  sectionRatio: 9 / 8, titleBump: { sm: 0, md: 1, lg: 2 }, floor: 9, glyphFloor: 8, // px; the glyph box never drops below glyphFloor
  levels: { chip: ["tight"], control: ["base"], group: ["tight", "control"], widget: ["roomy", "control"], tray: ["tight", "widget", "reserved"], // wrap, child; in ladder order
    card: ["roomy", "widget"], lane: ["tight", "card", "reserved"], page: ["roomy", "card"], shell: ["tight", "page", "reserved"] },
};
const STEPS = ["sm", "md", "lg"], IX = { sm: -1, md: 0, lg: 1 };
const ROLES = ["display", "heading", "subhead", "sectionLabel", "title", "body", "control", "fieldLabel", "groupLabel"];
const round = (x) => Math.floor(x + 0.5);
const rung = (t, sc, sz) => { const [n0, a, k, g] = CFG.tiers[t], s = IX[sc], z = IX[sz]; return n0 + a * s + k * z + g * s * z; };
const nOnly = (v) => Object.entries({ ...v, ...v.parts, ...Object.fromEntries(["chip", "control", "group"].flatMap((l) => Object.entries(v[l]).map(([k, x]) => [`${l} ${k}`, x]))) })
  .filter(([k, x]) => typeof x === "number" && k !== "m"); // px that depend on n alone
const unit = (t, n, d) => Math.max(n + CFG.tiers[t][1] * CFG.density[d], Math.floor((n + Math.ceil(n / 4)) / 2) + 1); // m, floored so a widget out-margins a group
function at(n, size = "md", m = n) {
  const c = Math.ceil(n / 4), half = Math.ceil(n / 2), lin = (r) => Math.max(CFG.floor, CFG.linear[r][0] + CFG.linear[r][1] * (n - 5));
  const body = lin("body"), Q = CFG.Q[0] + CFG.Q[1] * (n - 5);
  const lv = {}, span = { control: m };              // span: a level's size in container space, where the control counts as m
  for (const [l, [wrap, child]] of Object.entries(CFG.levels)) {
    const inner = child ? lv[child].margin : 0;      // a chip wraps a mark, margin 0
    if (wrap === "base") lv[l] = { margin: n, gutter: c, radius: n };
    else if (wrap === "tight") lv[l] = { margin: inner + c, gutter: c, radius: child ? inner + c : half };
    else { span[l] = span[child] + m; lv[l] = { margin: span[l], gutter: span[child], radius: span[l] }; }
  }
  const pick = (reserved) => Object.fromEntries(Object.entries(lv).filter(([l]) => (CFG.levels[l][2] === "reserved") === reserved));
  return { n, m, h: 4 * n, minWidth: 4 * n, labelMargin: n - c, icon: 2 * n, c, glyph: Math.max(CFG.glyphFloor, 2 * n - 2 * c),
    type: { display: round(body * Q ** 3), heading: round(body * Q ** 2), subhead: round(body * Q), sectionLabel: round(body * CFG.sectionRatio),
      title: body + CFG.titleBump[size], body, control: lin("control"), fieldLabel: lin("fieldLabel"), groupLabel: lin("groupLabel") },
    parts: { checkbox: 2 * n, checkboxRadius: half, check: 2 * n - 2 * c, radio: 2 * n, radioDot: 2 * n - 2 * c - 2, switchTrack: 2 * n, switchThumb: 2 * n - 2 * c, switchWidth: 4 * n - 2 * c,
      badge: 2 * n + 2 * c, avatar: 4 * n, avatarInline: 2 * n, iconTile: 4 * n, progress: 2 * c, tableRow: 4 * n + 2 * c, fieldGutter: half },
    ...pick(false), reserved: pick(true) };
}
export function resolve(tier = "product", scale = "md", size = "md", density = "default") {
  const n = rung(tier, scale, size);
  if (!Number.isInteger(n) || n < CFG.ladder[0] || n > CFG.ladder[1]) throw new Error(`${tier}/${scale}/${size}: n=${n} is off the ladder`);
  if (!(density in CFG.density)) throw new Error(`${density}: not a density`);
  return { tier, scale, size, density, ...at(n, size, unit(tier, n, density)) };
}
// Contract: every check must pass after any change to CFG. Returns the failures.
export function check() {
  const bad = [], all = Object.keys(CFG.tiers).flatMap((t) => STEPS.flatMap((s) => STEPS.map((z) => [t, s, z])));
  const nest = (v) => ["control", "group", "widget", "card", "page"].map((l) => v[l].margin), rising = (xs) => xs.every((x, i) => !i || xs[i - 1] < x);
  for (const [t, s, z] of all) { const n = rung(t, s, z); if (!Number.isInteger(n) || n < CFG.ladder[0] || n > CFG.ladder[1]) bad.push(`M1 ${t}/${s}/${z} n=${n} off the ladder`); }
  if (bad.length) return bad;
  for (const t in CFG.tiers) for (const x of STEPS) for (const i of [0, 1]) {
    if (rung(t, x, STEPS[i]) >= rung(t, x, STEPS[i + 1])) bad.push(`M2 ${t}/${x}: size ${STEPS[i]}→${STEPS[i + 1]} doesn't grow`);
    if (rung(t, STEPS[i], x) >= rung(t, STEPS[i + 1], x)) bad.push(`M2 ${t}: scale ${STEPS[i]}→${STEPS[i + 1]} doesn't grow at size ${x}`);
  }
  for (const [t, s, z] of all) { const u = resolve(t, s, z).type; if (!(u.body <= u.title && u.title <= u.sectionLabel)) bad.push(`M4 ${t}/${s}/${z}: body ≤ title ≤ section label fails`); }
  const order = ROLES.filter((r) => r !== "title");
  for (let n = CFG.ladder[0]; n <= CFG.ladder[1]; n++) {
    const v = at(n), w = n > CFG.ladder[0] ? at(n - 1) : null, k = v.control;
    order.slice(1).forEach((r, i) => { if (v.type[order[i]] < v.type[r]) bad.push(`M3 h${4 * n}: ${order[i]} < ${r}`); });
    if (Math.min(...ROLES.map((r) => v.type[r])) < CFG.floor) bad.push(`M5 h${4 * n}: type below ${CFG.floor}px`);
    if (!rising(nest(v))) bad.push(`M6 h${4 * n}: margins don't nest ${nest(v).join(" < ")}`);
    for (const l of ["group", "widget", "card", "page"]) {
      if (!(v[l].gutter < v[l].margin)) bad.push(`M6 h${4 * n}: ${l} gutter ≥ margin`);
      if (v[l].margin - k.margin < v.c) bad.push(`M8 h${4 * n}: a control doesn't fit in ${l}`);
      if (![v[l].margin, v[l].gutter].every(Number.isInteger)) bad.push(`M7 h${4 * n}: ${l} not whole px`);
    }
    if (ROLES.some((r) => !Number.isInteger(2 * v.type[r]))) bad.push(`M7 h${4 * n}: type off the 0.5px grid`);
    if (!nOnly(v).every(([, x]) => Number.isInteger(x))) bad.push(`M7 h${4 * n}: a chip, control, group or component size is not whole px`);
    if (!(v.glyph > 0)) bad.push(`M9 h${4 * n}: glyph ${v.glyph}`);
    if (w) ROLES.forEach((r) => { if (v.type[r] < w.type[r]) bad.push(`M10 h${4 * (n - 1)}→h${4 * n}: ${r} shrinks`); });
    if (k.gutter + v.labelMargin !== k.margin || v.labelMargin < v.c || ![k.gutter, v.labelMargin].every(Number.isInteger)) bad.push(`M11 h${4 * n}: gutter ${k.gutter} + label margin ${v.labelMargin} must be ${k.margin}, label margin ≥ ${v.c}, whole px`);
    if (Math.max(v.minWidth, 2 * k.margin + 2 * v.labelMargin) < v.h) bad.push(`M12 h${4 * n}: a label-only control can be narrower than ${v.h}`);
    if (w) { const was = Object.fromEntries(nOnly(w)); nOnly(v).forEach(([key, x]) => { if (x < was[key]) bad.push(`M14 h${4 * (n - 1)}→h${4 * n}: ${key} shrinks ${was[key]} → ${x}`); }); }
    if (v.parts.badge < v.type.fieldLabel + v.c) bad.push(`M15 h${4 * n}: badge ${v.parts.badge} is not c taller than its type ${v.type.fieldLabel}`);
  }
  for (const [t, s, z] of all) for (const d in CFG.density) {
    const v = resolve(t, s, z, d), lv = { ...v, ...v.reserved }, names = Object.keys(CFG.levels);
    if (!Number.isInteger(v.m) || !rising(nest(v))) bad.push(`M13 ${t}/${s}/${z} ${d}: margins don't nest ${nest(v).join(" < ")}`);
    for (const l of ["widget", "card", "page"]) if (v[l].margin - v.control.margin < v.c) bad.push(`M13 ${t}/${s}/${z} ${d}: a control doesn't fit in ${l}`);
    const fits = names.every((l) => { const [wrap, child] = CFG.levels[l]; return wrap === "base" || lv[l].margin - (child ? lv[child].margin : 0) >= v.c; });
    if (!rising(names.map((l) => lv[l].margin)) || !fits) bad.push(`M16 ${t}/${s}/${z} ${d}: level margins don't nest with an offset of c: ${names.map((l) => `${l} ${lv[l].margin}`).join(" < ")}`);
  }
  return bad;
}
export { CFG };
