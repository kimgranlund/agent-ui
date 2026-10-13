// Reference implementation. Edit CFG to change the system; resolve() and check() follow.
const CFG = {
  ladder: [5, 24],                                   // allowed n; h = 4n
  tiers: { widget: [7, 1, 1, 0], product: [9, 2, 2, 1], content: [11, 2, 2, 1], brand: [14, 2, 2, 1] }, // n0 a k g
  linear: { body: [12, 1], control: [11, 1], fieldLabel: [9, 1], groupKicker: [9, 0.5] },             // px at n=5, px per step
  Q: [1.25, 1 / 32],                                 // heading ratio at n=5, per step
  kicker: 9 / 8, titleBump: { sm: 0, md: 1, lg: 2 }, floor: 9,
  levels: { widget: [2, 1, 2], card: [3, 2, 3], layout: [4, 3, 4] },                                 // margin gutter radius, × n
};
const STEPS = ["sm", "md", "lg"], IX = { sm: -1, md: 0, lg: 1 };
const ROLES = ["display", "heading", "subhead", "sectionKicker", "title", "body", "control", "fieldLabel", "groupKicker"];
const round = (x) => Math.floor(x + 0.5);
const rung = (t, sc, sz) => { const [n0, a, k, g] = CFG.tiers[t], s = IX[sc], z = IX[sz]; return n0 + a * s + k * z + g * s * z; };
function at(n, size = "md") {
  const c = Math.ceil(n / 4), lin = (r) => CFG.linear[r][0] + CFG.linear[r][1] * (n - 5);
  const body = lin("body"), Q = CFG.Q[0] + CFG.Q[1] * (n - 5);
  const box = ([m, g, r]) => ({ margin: m * n, gutter: g * n, radius: r * n });
  return { n, h: 4 * n, inset: n, icon: 2 * n, radius: n, c, glyph: 2 * n - 2 * c,
    type: { display: round(body * Q ** 3), heading: round(body * Q ** 2), subhead: round(body * Q), sectionKicker: round(body * CFG.kicker),
      title: body + CFG.titleBump[size], body, control: lin("control"), fieldLabel: lin("fieldLabel"), groupKicker: lin("groupKicker") },
    group: { margin: n + c, gutter: c, radius: n + c }, ...Object.fromEntries(Object.entries(CFG.levels).map(([l, v]) => [l, box(v)])) };
}
export function resolve(tier = "product", scale = "md", size = "md") {
  const n = rung(tier, scale, size);
  if (!Number.isInteger(n) || n < CFG.ladder[0] || n > CFG.ladder[1]) throw new Error(`${tier}/${scale}/${size}: n=${n} is off the ladder`);
  return { tier, scale, size, ...at(n, size) };
}
// Contract: every check must pass after any change to CFG. Returns the failures.
export function check() {
  const bad = [], all = Object.keys(CFG.tiers).flatMap((t) => STEPS.flatMap((s) => STEPS.map((z) => [t, s, z])));
  for (const [t, s, z] of all) { const n = rung(t, s, z); if (!Number.isInteger(n) || n < CFG.ladder[0] || n > CFG.ladder[1]) bad.push(`M1 ${t}/${s}/${z} n=${n} off the ladder`); }
  if (bad.length) return bad;
  for (const t in CFG.tiers) for (const x of STEPS) for (const i of [0, 1]) {
    if (rung(t, x, STEPS[i]) >= rung(t, x, STEPS[i + 1])) bad.push(`M2 ${t}/${x}: size ${STEPS[i]}→${STEPS[i + 1]} doesn't grow`);
    if (rung(t, STEPS[i], x) >= rung(t, STEPS[i + 1], x)) bad.push(`M2 ${t}: scale ${STEPS[i]}→${STEPS[i + 1]} doesn't grow at size ${x}`);
  }
  const order = ROLES.filter((r) => r !== "title");
  for (let n = CFG.ladder[0]; n <= CFG.ladder[1]; n++) {
    const v = at(n), w = n > CFG.ladder[0] ? at(n - 1) : null;
    order.slice(1).forEach((r, i) => { if (v.type[order[i]] < v.type[r]) bad.push(`M3 h${4 * n}: ${order[i]} < ${r}`); });
    for (const z of STEPS) { const u = at(n, z).type; if (!(u.body <= u.title && u.title <= u.sectionKicker)) bad.push(`M4 h${4 * n}/${z}: body ≤ title ≤ section kicker fails`); }
    if (Math.min(...ROLES.map((r) => v.type[r])) < CFG.floor) bad.push(`M5 h${4 * n}: type below ${CFG.floor}px`);
    const chain = [v.inset, v.group.margin, v.widget.margin, v.card.margin, v.layout.margin];
    if (!chain.every((m, i) => !i || chain[i - 1] < m)) bad.push(`M6 h${4 * n}: margins don't nest ${chain.join(" < ")}`);
    for (const l of ["group", "widget", "card", "layout"]) {
      if (!(v[l].gutter < v[l].margin)) bad.push(`M6 h${4 * n}: ${l} gutter ≥ margin`);
      if (v[l].margin - v.inset < v.c) bad.push(`M8 h${4 * n}: a control doesn't fit in ${l}`);
      if (![v[l].margin, v[l].gutter].every(Number.isInteger)) bad.push(`M7 h${4 * n}: ${l} not whole px`);
    }
    if (ROLES.some((r) => !Number.isInteger(2 * v.type[r]))) bad.push(`M7 h${4 * n}: type off the 0.5px grid`);
    if (!(v.glyph > 0)) bad.push(`M9 h${4 * n}: glyph ${v.glyph}`);
    if (w) ROLES.forEach((r) => { if (v.type[r] < w.type[r]) bad.push(`M10 h${4 * (n - 1)}→h${4 * n}: ${r} shrinks`); });
  }
  return bad;
}
export { CFG };
