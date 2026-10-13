// derive.mjs: every derived number in ADR-0245 comes from this script, which calls the skill's reference
// implementation (scale.mjs beside it, a byte copy of ~/.claude/skills/mathematical-design-system/scale.mjs,
// sha256 eca32879...). "Today" values are read off the shipped stylesheets (file:line in the ADR appendix).
// Run: node .claude/docs/references/foundations-derivation/derive.mjs > .claude/docs/references/foundations-derivation/derive.out.md
import { resolve, check, CFG } from './scale.mjs';

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
  ['button / toggle radius (pill h/2 today)', [12, 14, 18], (r) => r.radius, 'n'],
  ['field radius (corner-base today)', [12, 12, 12], (r) => r.radius, 'n'],
  ['checkbox / radio / switch / slider box (compact today)', [14, 16, 18], (r) => r.icon, '2n'],
  ['checkbox radius (box/5 today)', [2.8, 3.2, 3.6], (r) => r.n / 2, 'n/2'],
  ['checkbox check (0.6 box today)', [8.4, 9.6, 10.8], (r) => r.glyph, '2n - 2c'],
  ['radio dot (0.56 box today)', [7.84, 8.96, 10.08], (r) => 2 * r.n - 4 * r.c, '2n - 4c'],
  ['switch thumb (box - 4 today)', [10, 12, 14], (r) => r.glyph, '2n - 2c'],
  ['switch track width (1.8 box today)', [25.2, 28.8, 32.4], (r) => 2 * r.glyph + 2 * r.c, '2 thumb + 2c'],
  ['switch track padding (widget-inset today)', [2, 2, 2], (r) => r.c, 'c'],
  ['field label gap (space-xs today)', [4, 4, 4], (r) => Math.ceil(r.n / 2), 'ceil(n/2)'],
  ['avatar, the skill\'s 2n', [24, 28, 36], (r) => r.icon, '2n'],
  ['avatar, the recommended icon-tile reading', [24, 28, 36], (r) => r.h, '4n'],
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
for (const [label, t, v] of [['height', 28, a.h], ['icon box', 18, a.icon], ['glyph box', 14, a.glyph], ['control type', 14, a.type.control], ['body', 14, a.type.body], ['button radius', 14, a.radius], ['card margin', 18, a.card.margin], ['card radius', 12, a.card.radius]]) {
  p(`- ${label}: ${t} → ${v} (${d(t, v)})`);
}

p('## 10. Check values (SKILL.md section 9) recomputed');
const pm = resolve('product', 'md', 'md'), ws = resolve('widget', 'md', 'sm'), bl = resolve('brand', 'lg', 'lg');
p(`- product md/md: n ${pm.n}, h ${pm.h}, c ${pm.c}, glyph ${pm.glyph}; type ${JSON.stringify(pm.type)}; card ${pm.card.margin}/${pm.card.gutter}/${pm.card.radius}`);
p(`- widget md/sm: n ${ws.n}, h ${ws.h}, c ${ws.c}, glyph ${ws.glyph}; body ${ws.type.body}, control ${ws.type.control}, field label ${ws.type.fieldLabel}, group kicker ${ws.type.groupKicker}`);
p(`- brand lg/lg: n ${bl.n}, h ${bl.h}, c ${bl.c}; display ${bl.type.display}, heading ${bl.type.heading}, subhead ${bl.type.subhead}, body ${bl.type.body}`);

console.log(out.join('\n'));
