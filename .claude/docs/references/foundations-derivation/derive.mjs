// derive.mjs: every derived number in ADR-0245 comes from this script, which calls the skill's reference
// implementation. Sections 1 to 10 (the ADR body and its appendices, frozen) run on scale-v1.mjs, the copy the
// cut shipped (sha256 eca32879...); section 11 on (Amendment 3) runs on scale.mjs, the byte copy of the skill's
// v2 ~/.claude/skills/mathematical-design-system/scale.mjs (sha256 3c319761...), and compares v2 against v1.
// Section 18 (Amendment 4, T-0122) runs on the same v2 copy and gives the px the control rule moves per control;
// section 19 (Amendment 5, T-0134) gives the radii the pill moves; section 20 (Amendment 7, T-0143) the glyph floor,
// which scale.mjs carries ahead of the skill, so sections 13 and 16 read the unfloored glyph they recorded.
// v2 renamed keys: inset and radius are control.margin and control.radius, layout is page, the kicker roles are
// sectionLabel and groupLabel, and the component sizes sit under parts.
// "Today" values are read off the shipped stylesheets (file:line in the ADR appendix).
// Run: node .claude/docs/references/foundations-derivation/derive.mjs > .claude/docs/references/foundations-derivation/derive.out.md
import { resolve, check, CFG } from './scale-v1.mjs';
import { resolve as resolve2, check as check2, CFG as CFG2 } from './scale.mjs';

const SZ = ['sm', 'md', 'lg'];
const ROOT = ['product', 'sm']; // the proposed library root (clause 2)
const at = (z, tier = ROOT[0], scale = ROOT[1]) => resolve(tier, scale, z);
const d = (a, b) => { const x = +(b - a).toFixed(2); return x === 0 ? '0' : (x > 0 ? `+${x}` : `${x}`); };
const tri = (today, derived) => SZ.map((_, i) => `${today[i]} → ${derived[i]} (${d(today[i], derived[i])})`).join(' · ');
const out = [];
const p = (s = '') => out.push(s);

p('## 1. check()');
p('```');
p(`check() = ${JSON.stringify(check())}`);
p('```');

p('## 2. Reachable heights per tier (all 9 scale x size cells)');
for (const t of Object.keys(CFG.tiers)) {
  const hs = [...new Set(SZ.flatMap((s) => SZ.map((z) => resolve(t, s, z).h)))].sort((a, b) => a - b);
  p(`- ${t}: ${hs.join(' / ')}`);
}

p('## 3. Root candidates against today\'s 24 / 28 / 36');
const today = [24, 28, 36];
for (const [t, s] of [['product', 'sm'], ['widget', 'md'], ['product', 'md'], ['widget', 'lg']]) {
  const h = SZ.map((z) => resolve(t, s, z).h);
  const moved = h.reduce((acc, v, i) => acc + Math.abs(v - today[i]), 0);
  p(`- ${t}/${s}: ${h.join(' / ')} · per step ${h.map((v, i) => d(today[i], v)).join(' / ')} · total |delta| ${moved}px`);
}

p('## 4. Today\'s [scale] names mapped to tier/scale');
const scaleMap = [
  ['ui-sm', [20, 24, 28], 14 * 0.875, 'widget', 'sm'],
  ['ui-md', [24, 28, 36], 14, 'product', 'sm'],
  ['ui-lg', [28, 36, 48], 14 * 1.125, 'product', 'md'],
  ['content-sm', [24, 28, 36], 14 * 1.375, 'content', 'sm'],
  ['content-md', [28, 36, 48], 14 * 1.5, 'content', 'md'],
  ['content-lg', [36, 48, 64], 14 * 1.75, 'content', 'lg'],
];
p('| today | heights sm/md/lg | body-medium | proposed | heights sm/md/lg | body at md |');
p('|---|---|---|---|---|---|');
for (const [name, h, body, t, s] of scaleMap) {
  const nh = SZ.map((z) => resolve(t, s, z).h);
  p(`| \`${name}\` | ${h.join('/')} | ${body} | \`${t}/${s}\` | ${nh.join('/')} (${nh.map((v, i) => d(h[i], v)).join('/')}) | ${resolve(t, s, 'md').type.body} |`);
}

p(`## 5. Controls at the root ${ROOT.join('/')} (size sm / md / lg = n ${SZ.map((z) => at(z).n).join(' / ')})`);
const R = SZ.map((z) => at(z));
const rows = [
  ['height', [24, 28, 36], (r) => r.h, '4n'],
  ['icon box', [16, 18, 20], (r) => r.icon, '2n'],
  ['glyph box (caret today = font)', [13, 14, 16], (r) => r.glyph, '2n - 2c'],
  ['control type', [13, 14, 16], (r) => r.type.control, 'n + 6'],
  ['control gap (font/2 today)', [6.5, 7, 8], (r) => r.n, 'n'],
  ['button label padding (h/2 today)', [12, 14, 18], (r) => 2 * r.n, '2n'],
  ['button icon-side padding ((h - icon)/2 today)', [4, 5, 8], (r) => r.n, 'n'],
  ['input inline padding (h/2 today)', [12, 14, 18], (r) => r.n, 'n'],
  ['button / toggle radius (the pill, kept at step 0)', [12, 14, 18], (r) => r.h / 2, 'h/2 = 2n'],
  ['field radius (corner-base today)', [12, 12, 12], (r) => r.radius, 'n'],
  ['checkbox / radio / switch / slider box (compact today)', [14, 16, 18], (r) => r.icon, '2n'],
  ['checkbox radius (box/5 today)', [2.8, 3.2, 3.6], (r) => r.n / 2, 'n/2'],
  ['checkbox check (0.6 box today)', [8.4, 9.6, 10.8], (r) => r.glyph, '2n - 2c'],
  ['radio dot (0.56 box today)', [7.84, 8.96, 10.08], (r) => 2 * r.n - 4 * r.c, '2n - 4c'],
  ['switch thumb (box - 4 today)', [10, 12, 14], (r) => r.glyph, '2n - 2c'],
  ['switch track width (1.8 box today)', [25.2, 28.8, 32.4], (r) => 2 * r.glyph + 2 * r.c, '2 thumb + 2c'],
  ['switch track padding (widget-inset today)', [2, 2, 2], (r) => r.c, 'c'],
  ['field label gap (space-xs today)', [4, 4, 4], (r) => Math.ceil(r.n / 2), 'ceil(n/2)'],
  ['avatar, the skill\'s 2n (not adopted)', [24, 28, 36], (r) => r.icon, '2n'],
  ['avatar, 4n (ruled at step 0)', [24, 28, 36], (r) => r.h, '4n'],
  ['menu item row (font + 8 today)', [22, 22, 22], (r) => r.h, '4n'],
  ['table row (about 28 + 1px today)', [29, 29, 29], (r) => r.h + 2 * r.c, '4n + 2c'],
  ['table text cell inline padding (space-sm today)', [8, 8, 8], (r) => r.n + r.c, 'n + c'],
  ['segmented-control padding (0 today)', [0, 0, 0], (r) => r.c, 'c'],
  ['segment inline padding (h/2 today)', [14, 14, 14], (r) => 2 * r.n, '2n'],
  ['progress track (4 today)', [4, 4, 4], (r) => 2 * r.c, '2c'],
  ['tabs tab height (height-lg today)', [36, 36, 36], (r) => r.h, '4n'],
];
p('| quantity | rule | today → derived (delta), sm · md · lg |');
p('|---|---|---|');
for (const [label, t, f, rule] of rows) p(`| ${label} | ${rule} | ${tri(t, R.map(f))} |`);

p('### Badge (no size axis; sits at its context n, md)');
const m = at('md');
for (const [label, t, v, rule] of [
  ['height', 18, m.icon, '2n'], ['inline padding', 8.75, 2 * m.c, '2c'], ['radius', 9, m.n / 2, 'n/2'], ['type', 13, m.type.fieldLabel, 'field label n + 4'],
]) p(`- ${label}: ${t} → ${v} (${d(t, v)}), rule ${rule}`);

p(`## 6. Containers at the root md (n ${m.n}, c ${m.c})`);
const cont = [
  ['card / modal text inset, inline (region margin 6 + pad 12)', 18, m.card.margin, 'card margin 3n'],
  ['card / modal text inset, block (6 + 6)', 12, m.card.margin, 'card margin 3n'],
  ['card region gap (6)', 6, m.card.gutter, 'card gutter 2n'],
  ['card content child rhythm (`--ui-box-gap` 8)', 8, m.card.gutter, 'card gutter 2n'],
  ['card / modal radius (corner-base 12)', 12, m.card.radius, 'card radius 3n'],
  ['popover padding (space-md 12)', 12, m.widget.margin, 'widget margin 2n'],
  ['popover radius (12)', 12, m.widget.radius, 'widget radius 2n'],
  ['toast padding inline (12)', 12, m.widget.margin, 'widget margin 2n'],
  ['toast padding block (8)', 8, m.widget.margin, 'widget margin 2n'],
  ['toast gap (8)', 8, m.widget.gutter, 'widget gutter n'],
  ['tooltip padding (space-sm 8)', 8, m.group.margin, 'group margin n + c'],
  ['tooltip radius (12)', 12, m.group.radius, 'group radius n + c'],
  ['listbox padding (menu 6, select h/4 7)', 7, m.c, 'c'],
  ['listbox panel radius (12)', 12, m.group.radius, 'group radius n + c'],
  ['listbox option radius (select 12 - h/4 = 5)', 5, m.radius, 'n'],
  ['bar inline inset (`--ui-bar-inline-inset` 24)', 24, m.layout.margin, 'layout margin 4n'],
];
p('| quantity | rule | today → derived (delta) |');
p('|---|---|---|');
for (const [label, t, v, rule] of cont) p(`| ${label} | ${rule} | ${t} → ${v} (${d(t, v)}) |`);

p(`## 7. The --md-sys-space ladder as an alias layer at n ${m.n}`);
const space = [['xs', 4, m.c, 'c'], ['sm', 8, m.n, 'n'], ['md', 12, m.n + m.c, 'n + c'], ['lg', 16, 2 * m.n, '2n'], ['xl', 24, 3 * m.n, '3n'], ['2xl', 32, 4 * m.n, '4n']];
p('| step | rule | today → derived (delta) |');
p('|---|---|---|');
for (const [s, t, v, rule] of space) p(`| \`${s}\` | ${rule} | ${t} → ${v} (${d(t, v)}) |`);

p('## 8. ui-text: variant x size, today (ADR-0078 cl.2/cl.2b at scale 1) → derived at n 6 / 7 / 8');
const role = { display: 'display', headline: 'heading', title: 'title', body: 'body', label: 'fieldLabel', kicker: 'sectionKicker', overline: 'groupKicker', lead: 'subhead', quote: 'subhead' };
const todayType = { display: [36, 45, 57], headline: [24, 28, 32], title: [14, 16, 22], body: [12, 14, 16], label: [11, 12, 14], kicker: [11, 12, 14], overline: [11, 12, 14], lead: [16, 18, 22], quote: [16, 18, 22] };
p('| variant | skill role | today → derived (delta), sm · md · lg |');
p('|---|---|---|');
const roleName = { fieldLabel: 'field label', sectionKicker: 'section kicker', groupKicker: 'group kicker' };
for (const v of Object.keys(role)) p(`| \`${v}\` | ${roleName[role[v]] ?? role[v]} | ${tri(todayType[v], R.map((r) => r.type[role[v]]))} |`);

p('### Display and heading where rule 4 puts them (a region with its own tier, size md)');
for (const [t, s] of [['content', 'md'], ['brand', 'md']]) {
  const r = resolve(t, s, 'md');
  p(`- ${t}/${s}/md (n ${r.n}): display ${r.type.display}, heading ${r.type.heading}, subhead ${r.type.subhead}, body ${r.type.body}`);
}

p('## 9. Rejected root product/md (the skill default), same quantities at md');
const a = resolve('product', 'md', 'md');
for (const [label, t, v] of [['height', 28, a.h], ['icon box', 18, a.icon], ['glyph box', 14, a.glyph], ['control type', 14, a.type.control], ['body', 14, a.type.body], ['button radius (pill)', 14, a.h / 2], ['card margin', 18, a.card.margin], ['card radius', 12, a.card.radius]]) {
  p(`- ${label}: ${t} → ${v} (${d(t, v)})`);
}

p('## 9b. The A2UI canvas register product/md (ruled at step 0, superseded by Amendment 2: the canvas is widget/md, section 16), size sm / md / lg');
const cv = SZ.map((z) => resolve('product', 'md', z));
for (const [label, f] of [['height', (r) => r.h], ['icon box', (r) => r.icon], ['glyph box', (r) => r.glyph], ['control type', (r) => r.type.control], ['button radius (pill)', (r) => r.h / 2]]) {
  p(`- ${label}: ${cv.map(f).join(' / ')}`);
}

p('## 10. Check values (SKILL.md section 9) recomputed');
const pm = resolve('product', 'md', 'md'), ws = resolve('widget', 'md', 'sm'), bl = resolve('brand', 'lg', 'lg');
p(`- product md/md: n ${pm.n}, h ${pm.h}, c ${pm.c}, glyph ${pm.glyph}; type ${JSON.stringify(pm.type)}; card ${pm.card.margin}/${pm.card.gutter}/${pm.card.radius}`);
p(`- widget md/sm: n ${ws.n}, h ${ws.h}, c ${ws.c}, glyph ${ws.glyph}; body ${ws.type.body}, control ${ws.type.control}, field label ${ws.type.fieldLabel}, group kicker ${ws.type.groupKicker}`);
p(`- brand lg/lg: n ${bl.n}, h ${bl.h}, c ${bl.c}; display ${bl.type.display}, heading ${bl.type.heading}, subhead ${bl.type.subhead}, body ${bl.type.body}`);

// ---- Amendment 3: the skill v2 constants, density, M14 and the derived exceptions (T-0120) ----------------

const v1 = SZ.map((z) => resolve('product', 'sm', z)); // the cut's root, n 6 / 7 / 8
const v2 = SZ.map((z) => resolve2('product', 'sm', z)); // the same root on v2, n 5 / 6 / 7
const cmp = (a, b) => SZ.map((_, i) => `${a[i]} → ${b[i]} (${d(a[i], b[i])})`).join(' · ');

p('## 11. Amendment 3: check() on the v2 constants');
p('```');
p(`check() = ${JSON.stringify(check2())}`);
p('```');
p(`Tiers (n0 a k g): ${Object.entries(CFG2.tiers).map(([t, v]) => `${t} ${v.join('/')}`).join(' · ')}; ladder ${CFG2.ladder.join(' to ')}; density ${JSON.stringify(CFG2.density)}; linear type floor ${CFG2.floor}px.`);

p('## 12. Reachable heights per tier on v2 (all 9 scale x size cells)');
for (const t of Object.keys(CFG2.tiers)) {
  const hs = [...new Set(SZ.flatMap((s) => SZ.map((z) => resolve2(t, s, z).h)))].sort((a, b) => a - b);
  p(`- ${t}: ${hs.join(' / ')}`);
}
p('Registers, sm / md / lg heights, v1 → v2:');
for (const [t, s] of [['product', 'sm'], ['product', 'md'], ['widget', 'md'], ['widget', 'lg'], ['content', 'sm']]) {
  p(`- ${t}/${s}: ${SZ.map((z) => resolve(t, s, z).h).join(' / ')} → ${SZ.map((z) => resolve2(t, s, z).h).join(' / ')}`);
}

p(`## 13. Controls at the root product/sm, v1 (n ${v1.map((r) => r.n).join(' / ')}) → v2 (n ${v2.map((r) => r.n).join(' / ')}), size sm · md · lg`);
p('| quantity | rule v1 → v2 | v1 → v2 (delta), sm · md · lg |');
p('|---|---|---|');
const g = (r) => 2 * r.n - 2 * r.c; // the glyph box Amendment 3 recorded, before the Amendment 7 floor
const controls = [
  ['height, avatar, swatch tile (4n)', '4n', (r) => r.h],
  ['inset, gap, field radius (n)', 'n', (r) => r.n],
  ['c', 'ceil(n/4)', (r) => r.c],
  ['icon box, indicator box, badge height (2n)', '2n', (r) => r.icon],
  ['glyph box, checkbox check, switch thumb', '2n - 2c', g],
  ['button / toggle pill radius', 'h/2 → 2n', (r) => 2 * r.n],
  ['button label padding', '2n', (r) => 2 * r.n],
  ['checkbox radius', 'n/2', (r) => r.n / 2],
  ['switch track width', '2 thumb + 2c', (r) => 2 * g(r) + 2 * r.c],
  ['field label gap', 'ceil(n/2)', (r) => Math.ceil(r.n / 2)],
  ['table row', '4n + 2c', (r) => r.h + 2 * r.c],
  ['table text cell padding, tooltip padding (group margin)', 'n + c', (r) => r.n + r.c],
  ['glyph stroke', 'max(1.5, c/2)', (r) => Math.max(1.5, r.c / 2)],
  ['control type', 'n + 6', (r) => r.type.control],
  ['body', 'n + 7', (r) => r.type.body],
  ['title', 'body + 0/1/2', (r) => r.type.title],
  ['field label (`label`)', 'n + 4', (r) => r.type.fieldLabel],
  ['group label (`overline`, table header)', 'n/2 + 6.5', (r) => r.type.groupKicker ?? r.type.groupLabel],
  ['section label', 'round(body · 9/8)', (r) => r.type.sectionKicker ?? r.type.sectionLabel],
  ['subhead (`lead`, `quote`)', 'round(body · Q)', (r) => r.type.subhead],
  ['heading (`headline`)', 'round(body · Q²)', (r) => r.type.heading],
  ['display', 'round(body · Q³)', (r) => r.type.display],
];
for (const [label, rule, f] of controls) p(`| ${label} | ${rule} | ${cmp(v1.map(f), v2.map(f))} |`);
p(`| radio dot | 2n - 4c → glyph - 2 | ${cmp(v1.map((r) => 2 * r.n - 4 * r.c), v2.map((r) => r.parts.radioDot))} |`);
p(`| \`kicker\` variant | field label (Amendment 1) → group label | ${cmp(v1.map((r) => r.type.fieldLabel), v2.map((r) => r.type.groupLabel))} |`);

const m1 = resolve('product', 'sm', 'md'), m2 = resolve2('product', 'sm', 'md');
p(`## 14. Containers and the derived exceptions at the root md, v1 (n ${m1.n}, c ${m1.c}) → v2 (n ${m2.n}, c ${m2.c}, m ${m2.m})`);
p('| quantity | rule v1 → v2 | v1 → v2 (delta) |');
p('|---|---|---|');
const one = (a, b) => `${a} → ${b} (${d(a, b)})`;
const QS = ['margin', 'gutter', 'radius'];
for (const [q, rule] of [['margin', 'n + c'], ['gutter', 'c'], ['radius', 'n + c']]) p(`| group ${q} | ${rule} | ${one(m1.group[q], m2.group[q])} |`);
// v1 kept its roomy levels as [margin, gutter, radius] multiples of n and named the last one layout; v2 walks them
// off one ladder as multiples of m and names it page.
for (const [level, ks] of Object.entries(CFG.levels)) {
  const now = m2[level === 'layout' ? 'page' : level];
  ks.forEach((k, i) => p(`| ${level} ${QS[i]} | ${k === 1 ? '' : k}n → ${k === 1 ? '' : k}m | ${one(m1[level][QS[i]], now[QS[i]])} |`));
}
const space2 = [['xs', (r) => r.c, 'c'], ['sm', (r) => r.n, 'n'], ['md', (r) => r.group.margin, 'n + c'], ['lg', (r) => r.widget.margin, '2n → 2m'], ['xl', (r) => r.card.margin, '3n → 3m'], ['2xl', (r) => (r.layout ?? r.page).margin, '4n → 4m']];
for (const [s, f, rule] of space2) p(`| \`--md-sys-space-${s}\` | ${rule} | ${one(f(m1), f(m2))} |`);
p(`| gauge ring stroke | 0.5rem → 4c | ${one(8, 4 * m2.c)} |`);
p(`| swatch box | 2rem → 4n (radius n) | ${one(32, m2.h)} |`);
p(`| column-chart top segment radius | 0.75rem → n + c | ${one(12, m2.group.radius)} |`);
p(`| A2UI artboard padding | space-lg (2n) → card margin 3m | ${one(m1.widget.margin, m2.card.margin)} |`);
p(`| A2UI artboard gap | space-md (n + c) → card gutter 2m | ${one(m1.group.margin, m2.card.gutter)} |`);
p(`- Before the cut the artboard read 16 / 12 (the legacy space-lg / space-md); M14 holds the gauge ring at 4c: ${[5, 9, 13, 17].map((n) => `${4 * Math.ceil(n / 4)} at n ${n}`).join(', ')}.`);

p('## 15. data-density at the root md (n 6): m, then card margin / gutter / radius and layout margin');
p('| density | m | card | layout margin |');
p('|---|---|---|---|');
for (const dens of Object.keys(CFG2.density)) {
  const r = resolve2('product', 'sm', 'md', dens);
  p(`| ${dens} | ${r.m} | ${r.card.margin} / ${r.card.gutter} / ${r.card.radius} | ${r.page.margin} |`);
}
const floor = resolve2('product', 'sm', 'sm', 'compact');
p(`- The floor binds at product sm/sm compact: n ${floor.n}, m ${floor.m} (n - a = ${floor.n - 2}), widget ${floor.widget.margin} / ${floor.widget.gutter} / ${floor.widget.radius}, group ${floor.group.margin} / ${floor.group.gutter} / ${floor.group.radius}.`);
p('- `[density]` (retired) maps onto `data-density` in the bridge, so `[density="compact"]` moves m, never n.');

p('## 16. The A2UI canvas register widget/md (Amendment 2), re-derived on v2, size sm / md / lg');
{
  const was = SZ.map((z) => resolve('widget', 'md', z)), now = SZ.map((z) => resolve2('widget', 'md', z));
  for (const [label, f] of [['height', (r) => r.h], ['icon box', (r) => r.icon], ['glyph box', g], ['control type', (r) => r.type.control], ['button radius (pill)', (r) => 2 * r.n]]) {
    p(`- ${label}: ${was.map(f).join(' / ')} → ${now.map(f).join(' / ')}`);
  }
  const a = was[1], b = now[1];
  p(`- card margin / gutter / radius at md: ${a.card.margin} / ${a.card.gutter} / ${a.card.radius} → ${b.card.margin} / ${b.card.gutter} / ${b.card.radius}; body ${a.type.body} → ${b.type.body}`);
  p(`- product/md, the step 0 register no surface uses: height ${SZ.map((z) => resolve('product', 'md', z).h).join(' / ')} → ${SZ.map((z) => resolve2('product', 'md', z).h).join(' / ')}`);
}

p('## 17. Not adopted from the skill v2: the control rule, and the sizes the fleet still holds at its own value');
p('| quantity | fleet today → the skill v2 | today → skill (delta), sm · md · lg at the root |');
p('|---|---|---|');
const edge = (r) => r.control.margin + r.labelMargin; // the control rule: margin n plus label margin n - c
p(`| text edge of entry and trigger controls (text-field, select, combo-box, multi-select, otp-field, textarea), menu and listbox rows, tabs | n → 2n - c | ${cmp(v2.map((r) => r.n), v2.map(edge))} |`);
p(`| text edge of button, toggle and segment labels | 2n → 2n - c | ${cmp(v2.map((r) => 2 * r.n), v2.map(edge))} |`);
p(`| icon to label | n → gutter c + label margin n - c | ${cmp(v2.map((r) => r.n), v2.map((r) => r.control.gutter + r.labelMargin))} |`);
p(`| badge height | 2n → 2n + 2c | ${cmp(v2.map((r) => r.icon), v2.map((r) => r.parts.badge))} |`);
p(`| checkbox and badge radius | n/2 → ceil(n/2) | ${cmp(v2.map((r) => r.n / 2), v2.map((r) => r.parts.checkboxRadius))} |`);
p(`- The chip level (tag, badge, kbd: margin c, gutter c, radius ceil(n/2)) has no token yet: ${v2.map((r) => `${r.chip.margin} / ${r.chip.gutter} / ${r.chip.radius}`).join(' · ')} at the root sm · md · lg. The reserved levels tray, lane and shell have none by design.`);

// ---- Amendment 4: the control rule, the chip level and the two rounded-up radii adopted (T-0122) ----------
p('');
p('## 18. Amendment 4: the control rule adopted, per control at the root product/sm, before → after (delta), sm · md · lg');
p('Section 17 listed these as not adopted; T-0122 adopts every row of it. Edges are measured from the padding edge (inside the 1px border).');
p('| control | quantity | rule, before → after | sm · md · lg |');
p('|---|---|---|---|');
{
  const n = v2.map((r) => r.n), c = v2.map((r) => r.c), zero = v2.map(() => 0);
  const inset = v2.map((r) => r.labelMargin), h = v2.map((r) => r.h);
  const row = (control, quantity, rule, a, b) => p(`| ${control} | ${quantity} | ${rule} | ${cmp(a, b)} |`);
  row('button', 'text edge of a label', '2n → 2n - c', n.map((x) => 2 * x), v2.map(edge));
  row('button', 'box margin beside a label (host padding)', '2n → n', n.map((x) => 2 * x), n);
  row('button, text-field, textarea, select trigger', 'label inset on the text slot', '0 → n - c', zero, inset);
  row('button, text-field, select trigger', 'gutter (column-gap)', 'n → c', n, c);
  row('button, toggle, text-field, select trigger', 'icon edge and icon to text', 'n → n', n, v2.map((r) => r.control.gutter + r.labelMargin));
  row('toggle, segment', 'text edge (anonymous label: margin + inset on the host)', '2n → 2n - c', n.map((x) => 2 * x), v2.map(edge));
  row('text-field, textarea, select trigger, combo-box', 'value or text edge', 'n → 2n - c', n, v2.map(edge));
  row('select and combo-box option rows', 'text edge, from the row edge', 'n - c → 2n - c', inset, v2.map(edge));
  row('multi-select row', 'tick cell edge', 'n - c → n', inset, n);
  row('multi-select row', 'trailing text edge', 'n - c → 2n - c', inset, v2.map(edge));
  row('menu row', 'text edge', 'n + c → 2n - c', v2.map((r) => r.group.margin), v2.map(edge));
  row('menu check row', 'check box edge', 'n + c → n', v2.map((r) => r.group.margin), n);
  row('menu check row', 'check box to text', 'c → n', c, n);
  row('tab', 'text edge (GH #536 had none)', '0 → 2n - c', zero, v2.map(edge));
  row('tab strip', 'gap between tabs', 'n + 2c → c', v2.map((r) => r.n + 2 * r.c), c);
  row('tab strip', 'label to label distance', 'n + 2c → 4n - c', v2.map((r) => r.n + 2 * r.c), v2.map((r) => 2 * edge(r) + r.c));
  row('text-field, select, combo-box, tab', 'explicit min width (button already had it; toggle and segment keep the content minimum)', 'none → 4n', zero, h);
  row('badge', 'height', '2n → 2n + 2c', v2.map((r) => r.icon), v2.map((r) => r.parts.badge));
  row('badge', 'text edge (host margin c + label margin c)', '2c → 2c', c.map((x) => 2 * x), v2.map((r) => r.chip.margin + r.c));
  row('badge', 'glyph edge (the 2n mark box at the chip margin, glyph c inside it)', '2c → 2c', c.map((x) => 2 * x), v2.map((r) => r.chip.margin + r.c));
  row('badge', 'glyph to text', 'n → 3c', n, c.map((x) => 3 * x));
  row('badge, checkbox', 'radius', 'n/2 → ceil(n/2)', n.map((x) => x / 2), v2.map((r) => r.parts.checkboxRadius));
}
p(`- New tokens: \`--md-sys-label-inset\` (n - c: ${v2.map((r) => r.labelMargin).join(' / ')}) and the chip level \`--md-sys-chip-{margin,gutter,radius}\` (${v2.map((r) => `${r.chip.margin} / ${r.chip.gutter} / ${r.chip.radius}`).join(' · ')}) at the root sm · md · lg.`);
p(`- The identity the rule rests on: gutter c + label inset (n - c) = margin n, so an icon stays n from the edge and n from the text while the text edge is 2n - c: ${v2.map(edge).join(' / ')} at the root, 12 at n 7.`);

// ---- Amendment 5: everything pill (T-0134) ----------------------------------------------------------------
p('');
p('## 19. Amendment 5: every single-line control and chip takes radius h/2, panels nest concentrically, sm · md · lg');
p('scale.mjs is unchanged; the pill is a derived exception the generator emits beside it (`--md-sys-control-radius`, and `--md-sys-chip-radius` moved to the chip pill).');
p('| control | quantity | rule, before → after | sm · md · lg |');
p('|---|---|---|---|');
{
  const pill = v2.map((r) => r.h / 2), chipPill = v2.map((r) => r.n + r.c);
  const row = (control, quantity, rule, a, b) => p(`| ${control} | ${quantity} | ${rule} | ${cmp(a, b)} |`);
  row('text-field, select trigger, combo-box, otp-field cell', 'radius', 'n → 2n (h/2)', v2.map((r) => r.control.radius), pill);
  row('textarea, ui-code-editor', 'radius', 'n → 2n (the single-line control radius)', v2.map((r) => r.control.radius), pill);
  row('menu, select, combo-box and multi-select rows', 'radius', 'n → 2n (h/2)', v2.map((r) => r.control.radius), pill);
  row('menu, select listbox, combo-box panel, multi-select', 'radius', 'n + c → 2n + c (row + inset c)', v2.map((r) => r.group.radius), v2.map((r) => r.h / 2 + r.c));
  row('badge', 'radius', 'ceil(n/2) → n + c (h/2 of 2n + 2c)', v2.map((r) => r.chip.radius), chipPill);
  row('checkbox', 'radius', 'ceil(n/2) → ceil(n/2)', v2.map((r) => r.parts.checkboxRadius), v2.map((r) => r.parts.checkboxRadius));
}
p(`- New tokens: \`--md-sys-control-radius\` (2n: ${v2.map((r) => r.h / 2).join(' / ')}) and \`--md-sys-checkbox-radius\` (ceil(n/2): ${v2.map((r) => r.parts.checkboxRadius).join(' / ')}); \`--md-sys-chip-radius\` becomes n + c (${v2.map((r) => r.n + r.c).join(' / ')}) at the root sm · md · lg.`);

// ---- Amendment 7: the glyph floor (T-0143) -----------------------------------------------------------------
p('');
p(`## 20. Amendment 7: the glyph box floors at ${CFG2.glyphFloor}px, max(${CFG2.glyphFloor}, 2n - 2c), sm · md · lg`);
p('scale.mjs carries `CFG.glyphFloor` ahead of the skill (P15); every control that reads `--md-sys-glyph-box`, and `ui-glyph`, follows.');
p('| register | rule, before → after | sm · md · lg |');
p('|---|---|---|');
{
  const reg = (tier, scale) => SZ.map((z) => resolve2(tier, scale, z));
  p(`| root product/sm | 2n - 2c → max(${CFG2.glyphFloor}, 2n - 2c) | ${cmp(reg('product', 'sm').map(g), reg('product', 'sm').map((r) => r.glyph))} |`);
  p(`| A2UI canvas widget/md | 2n - 2c → max(${CFG2.glyphFloor}, 2n - 2c) | ${cmp(reg('widget', 'md').map(g), reg('widget', 'md').map((r) => r.glyph))} |`);
}

console.log(out.join('\n'));
