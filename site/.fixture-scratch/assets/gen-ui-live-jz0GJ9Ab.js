const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/live-proxy-transport-sCpJwoL7.js","assets/ndjson-lines-kCVOoeRw.js"])))=>i.map(i=>d[i]);
import{c as e}from"./super-shell-D76CLu9A.js";import{t}from"./_page-DIBN49D1.js";/* empty css                              */import"./conversation-composer-DgwLynIs.js";import{a as n,i as r,n as i,o as a,r as o}from"./provider-mode-selection-CtomAe8P.js";import{t as s}from"./composer-options-7Qsye3Yp.js";import{r as c}from"./agent-runtime-CXDIA2SZ.js";import{n as l,t as u}from"./session-Dk4RmbSm.js";import{n as d}from"./meta-line-BkeCLQyf.js";import{n as f,t as p}from"./genui-line-Crpa9Q-C.js";import{n as m,t as h}from"./dogfood-assets-BW-34qeW.js";var g=`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 1.1rem 1rem; font-family: system-ui, sans-serif;
    background: var(--md-sys-color-neutral-surface, #fff); color: var(--md-sys-color-neutral-on-surface, #111); }
  h1 { font-size: 0.92rem; margin: 0 0 0.9rem; font-weight: 650; }
  .chart { display: flex; align-items: flex-end; gap: 0.85rem; height: 7.5rem; }
  .bar { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 0.35rem; height: 100%; justify-content: flex-end; }
  .bar-fill { width: 100%; border-radius: 6px 6px 0 0; background: var(--md-sys-color-primary, #4a67ff);
    animation: grow 0.7s ease-out; transform-origin: bottom; }
  @keyframes grow { from { transform: scaleY(0); } to { transform: scaleY(1); } }
  .bar-label { font-size: 0.68rem; color: var(--md-sys-color-neutral-on-surface-variant, #666); }
  .bar-value { font-size: 0.7rem; font-weight: 650; }
</style>
</head>
<body>
  <h1>Q3 revenue by region (thousands USD)</h1>
  <div class="chart">
    <div class="bar"><div class="bar-value">$182k</div><div class="bar-fill" style="height:78%"></div><div class="bar-label">NA</div></div>
    <div class="bar"><div class="bar-value">$94k</div><div class="bar-fill" style="height:40%"></div><div class="bar-label">EU</div></div>
    <div class="bar"><div class="bar-value">$146k</div><div class="bar-fill" style="height:62%"></div><div class="bar-label">APAC</div></div>
    <div class="bar"><div class="bar-value">$38k</div><div class="bar-fill" style="height:16%"></div><div class="bar-label">LATAM</div></div>
  </div>
</body>
</html>`,_=`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 1.1rem 1rem; font-family: system-ui, sans-serif;
    background: var(--md-sys-color-neutral-surface, #fff); color: var(--md-sys-color-neutral-on-surface, #111); }
  p { margin: 0 0 0.6rem; font-size: 0.85rem; }
  .stars { display: flex; gap: 0.2rem; }
  button.star { font-size: 1.5rem; line-height: 1; background: none; border: 0; cursor: pointer; padding: 0.15rem;
    color: var(--md-sys-color-neutral-outline, #999); }
  button.star[data-lit='true'] { color: var(--md-sys-color-primary, #4a67ff); }
  #thanks { margin-top: 0.7rem; font-size: 0.78rem; color: var(--md-sys-color-neutral-on-surface-variant, #666); display: none; }
</style>
</head>
<body>
  <p>How would you rate this mockup?</p>
  <div class="stars" id="stars"></div>
  <div id="thanks">Thanks — sending your rating back to the agent…</div>
  <script>
    var root = document.getElementById('stars');
    for (var i = 1; i <= 5; i++) {
      (function (n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'star';
        b.textContent = '\\u2605';
        b.setAttribute('aria-label', n + ' star' + (n > 1 ? 's' : ''));
        b.addEventListener('click', function () {
          for (var j = 0; j < root.children.length; j++) root.children[j].setAttribute('data-lit', j < n ? 'true' : 'false');
          document.getElementById('thanks').style.display = 'block';
          window.genui.action('rate', { stars: n });
        });
        root.appendChild(b);
      })(i);
    }
  <\/script>
</body>
</html>`,v=`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 1.15rem 1rem; font-family: system-ui, sans-serif;
    background: var(--md-sys-color-neutral-surface, #fff); color: var(--md-sys-color-neutral-on-surface, #111); }
  h1 { font-size: 0.9rem; margin: 0 0 1rem; font-weight: 650; }
  .pipeline { position: relative; display: flex; justify-content: space-between; align-items: center; height: 2.6rem; }
  .node { min-width: 5.2rem; padding: 0.4rem 0.5rem; border-radius: 8px; background: var(--md-sys-color-neutral-surface-high, #eee);
    border: 1px solid var(--md-sys-color-neutral-outline-variant, #ccc); font-size: 0.66rem; text-align: center; z-index: 1; }
  .track { position: absolute; left: 2.75rem; right: 2.75rem; top: 50%; height: 2px; background: var(--md-sys-color-neutral-outline-variant, #ccc); }
  .dot { position: absolute; top: 50%; width: 0.55rem; height: 0.55rem; margin-top: -0.275rem; margin-left: -0.275rem;
    border-radius: 50%; background: var(--md-sys-color-primary, #4a67ff); animation: travel 2.2s linear infinite; }
  @keyframes travel { 0% { left: 2.75rem; } 100% { left: calc(100% - 2.75rem); } }
  p { font-size: 0.72rem; color: var(--md-sys-color-neutral-on-surface-variant, #666); margin: 0.9rem 0 0; }
</style>
</head>
<body>
  <h1>How your rating just reached the agent</h1>
  <div class="pipeline">
    <div class="node">Sandbox frame</div>
    <div class="track"></div>
    <div class="dot"></div>
    <div class="node">Host bridge</div>
    <div class="node">Next turn</div>
  </div>
  <p><code>genui.action(name, payload)</code> posts one message out of the sandbox; the host frames it as the next turn — no other channel exists out.</p>
</body>
</html>`,y=`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 1.1rem 1rem; font-family: system-ui, sans-serif;
    background: var(--md-sys-color-neutral-surface, #fff); color: var(--md-sys-color-neutral-on-surface, #111); }
  h1 { font-size: 0.9rem; margin: 0 0 1rem; font-weight: 650; }
  .timeline { display: flex; }
  .stop { flex: 1; position: relative; display: flex; flex-direction: column; align-items: center; }
  .stop:not(:last-child)::after { content: ''; position: absolute; top: 0.5rem; left: 50%; width: 100%; height: 2px;
    background: var(--md-sys-color-neutral-outline-variant, #ccc); }
  .dot { width: 1rem; height: 1rem; border-radius: 50%; z-index: 1; border: 2px solid var(--md-sys-color-neutral-surface, #fff); box-sizing: border-box; }
  .dot.done { background: var(--md-sys-color-primary, #4a67ff); }
  .dot.next { background: var(--md-sys-color-neutral-surface, #fff); border-color: var(--md-sys-color-primary, #4a67ff); }
  .dot.later { background: var(--md-sys-color-neutral-outline-variant, #ccc); }
  .stop-label { font-size: 0.66rem; margin-top: 0.4rem; text-align: center; color: var(--md-sys-color-neutral-on-surface-variant, #666); }
</style>
</head>
<body>
  <h1>GenUI feature roadmap</h1>
  <div class="timeline">
    <div class="stop"><div class="dot done"></div><div class="stop-label">Wire spec</div></div>
    <div class="stop"><div class="dot done"></div><div class="stop-label">Sandbox frame</div></div>
    <div class="stop"><div class="dot next"></div><div class="stop-label">Wire + producer</div></div>
    <div class="stop"><div class="dot later"></div><div class="stop-label">Judged corpus</div></div>
  </div>
</body>
</html>`,b=[{stage:`sent`},{stage:`started`},{stage:`content`},{stage:`done`}],x={intent:`A chat prompting a recorded GenUI demo backbone (no live producer — B2 has not shipped).`,turns:[{lines:[p(`q3-revenue`,g)],note:`Here’s a quick data-viz mockup of Q3 revenue by region — a bespoke layout no fixed catalog enumerates.`,progress:b},{lines:[p(`feedback-widget`,_)],note:`Here’s a tiny interactive widget — rate it and your click comes back to me as the next turn.`,progress:b},{lines:[p(`flow-explainer`,v)],note:`Got your rating — thanks! Here’s a quick animated explainer of how that click just round-tripped back to me.`,progress:b},{lines:[p(`roadmap-preview`,y)],note:`One more bespoke layout — a roadmap timeline showing where the real wire lands next.`,progress:b}]},S=o(i),C={css:h,js:m},w=`gen-ui-live-dogfood`;function T(){try{return localStorage.getItem(w)===`true`}catch{return!1}}function E(e){try{localStorage.setItem(w,e?`true`:`false`)}catch{}}var D={enabled:!0,exclusive:!0,dogfood:T()},{content:ee}=t();function O(e,t){let n=document.createElement(e);return n.className=t,n}function k(e,t,n){let r=O(`header`,`pane-head`),i=O(`div`,`pane-head-text`),a=document.createElement(`h2`);a.className=`pane-title`,a.textContent=e;let o=O(`p`,`pane-blurb`);if(o.textContent=t,i.append(a,o),r.append(i),n){let e=O(`span`,`demo-badge`);e.textContent=n,r.append(e)}return r}function A(e){let t=N.querySelector(`.pane-head`);if(!t)return;let n=t.querySelector(`.demo-badge`);if(e===void 0){n?.remove();return}n||(n=O(`span`,`demo-badge`),t.append(n)),n.textContent=e}var j=document.createElement(`ui-super-shell`);j.setAttribute(`narrow-start`,`stack`);var M=document.createElement(`div`);M.setAttribute(`data-slot`,`nav-pane`),M.setAttribute(`data-landmark`,`complementary`),M.className=`chat-pane`;var N=document.createElement(`div`);N.setAttribute(`data-slot`,`content`),N.className=`render-pane`,j.append(M,N),ee.append(j),M.append(k(`Chat`,`Prompt the demo, then interact with the surface it renders.`));var P=O(`div`,`options-strip`),F=document.createElement(`ui-switch`);F.setAttribute(`aria-label`,`Use agent-ui components in the GenUI frame`),F.checked=D.dogfood;var I=O(`span`,`options-strip-label`);I.textContent=`Use agent-ui components`,F.addEventListener(`change`,()=>{D.dogfood=F.checked,E(F.checked)}),P.append(F,I),M.append(P);var L=O(`div`,`chat-log`);L.setAttribute(`aria-live`,`polite`),M.append(L);function R(e,t){let n=O(`div`,`msg`);n.dataset.role=e;let r=O(`span`,`msg-who`);r.textContent=e===`user`?`You`:e===`agent`?`Agent`:`System`;let i=O(`p`,`msg-body`);i.textContent=t,n.append(r,i),L.append(n),L.scrollTop=L.scrollHeight}var z=document.createElement(`ui-conversation-composer`);z.className=`chat-composer`,M.append(z),N.append(k(`GenUI render`,`Sandboxed, agent-authored HTML/CSS/JS — contained, never trusted.`,`Recorded demo`));var B=O(`div`,`surface-stack`);N.append(B);var V=new Map;function H(e){return e.split(`-`).map(e=>e.toUpperCase()===e?e:e.charAt(0).toUpperCase()+e.slice(1)).join(` `)}function U(e,t){let n=D.dogfood?C:void 0,r=V.get(e);if(r){r.host.assets=n??{},r.host.html=t;return}let i=O(`section`,`surface-card`),a=O(`div`,`surface-card-head`),o=document.createElement(`h3`);o.className=`surface-card-title`,o.textContent=H(e);let s=O(`span`,`surface-card-id`);s.textContent=e,a.append(o,s);let c=document.createElement(`ui-sandbox-frame`);c.surfaceId=e,c.addEventListener(`action`,e=>{let t=e.detail;ne(t)}),n!==void 0&&(c.assets=n),c.html=t,i.append(a,c),B.append(i),V.set(e,{host:c}),B.scrollTop=B.scrollHeight}var W=c(x),G=!1,K={turns:[]},q=!1;function J(e){q=e,z.busy=e}function Y(){let e=document.createElement(`ui-status-stream`);return e.setAttribute(`size`,`sm`),e.setAttribute(`label`,`Agent activity`),e.setAttribute(`header`,``),e.setAttribute(`oneline`,``),e.setAttribute(`receipt`,``),e.classList.add(`narration-strip`),e}var te={sent:{live:`Request sent`,done:`Request sent`},started:{live:`Generating…`,done:`Generated`},reasoning:{live:`Reasoning…`,done:`Reasoned`},content:{live:`Writing the response…`,done:`Wrote the response`},validating:{live:`Validating…`,done:`Validated`},retry:{live:`Self-correcting…`,done:`Self-corrected`},tool:{live:`Running an integration…`,done:`Ran an integration`},done:{live:`Done`,done:`Done`}};async function X(e){if(q)return;J(!0);let t=Y();L.append(t),L.scrollTop=L.scrollHeight;let n=new Set,r=new Map,i,a=e=>{let n=r.get(e);t.update(e,n===void 0?{status:`done`}:{status:`done`,label:n})},o=e=>{let o=te[e.stage];if(o===void 0)return;if(e.stage===`done`){i!==void 0&&a(i),i=void 0;return}let s=e.stage===`retry`?e.round===void 0?``:` (round ${e.round})`:e.stage===`tool`&&e.detail?` (${e.detail})`:``,c=`${o.live}${s}`,l=e.stage===`retry`?`progress-retry-${e.round??1}`:e.stage===`tool`?`progress-tool-${e.detail??`unknown`}`:`progress-${e.stage}`;r.set(l,`${o.done}${s}`),i!==void 0&&i!==l&&a(i),n.has(l)?t.update(l,{status:`active`,label:c}):(n.add(l),t.appendEntry({key:l,status:`active`,label:c})),i=l};try{let n=[],r,s;for await(let t of W.turn(e)){let e=d(t);if(e){e.a2uiMeta.progress!==void 0&&o(e.a2uiMeta.progress),e.a2uiMeta.note!==void 0&&(r=e.a2uiMeta.note),e.a2uiMeta.error!==void 0&&(s=e.a2uiMeta.error);continue}let i=f(t);i!==void 0&&(n.push(t),U(i.genui.surfaceId,i.genui.html))}if(s!==void 0){t.appendEntry({key:`progress-error`,status:`error`,label:`Turn failed — ${s}`}),t.fail(),R(`system`,`⚠ ${s}`);return}if(i!==void 0&&a(i),t.finalize(),n.length===0&&r===void 0){R(`system`,G?`The agent's turn produced no renderable output.`:`The agent has no further turns in this recorded transcript. Reset to start over.`);return}K=l(K,e.kind===`intent`?e.text:``),K=u(K,n.join(`
`)),R(`agent`,r??`Rendered ${n.length} GenUI surface(s) — see the render pane.`)}catch(e){t.appendEntry({key:`progress-error`,status:`error`,label:`Turn failed — ${e.message}`}),t.fail(),R(`system`,`⚠ ${e.message}`)}finally{J(!1)}}function ne(e){R(`system`,`Received action from "${e.surfaceId}" — ${e.name}(${JSON.stringify(e.payload??null)})`),X({kind:`intent`,text:`[GenUI action] surface=${e.surfaceId} name=${e.name} payload=${JSON.stringify(e.payload??null)}`,session:K})}z.onSubmit(e=>{R(`user`,e),X({kind:`intent`,text:e,session:K})});var Z=document.createElement(`ui-button`);Z.setAttribute(`variant`,`ghost`),Z.setAttribute(`tabindex`,`0`),Z.textContent=`Reset`,Z.addEventListener(`click`,()=>{B.replaceChildren(),V.clear(),K={turns:[]},W=c(x),G=!1,L.replaceChildren(),A(`Recorded demo`),R(`system`,`New conversation. Send a message to begin.`),$()});var Q=O(`div`,`reset-bar`);Q.append(Z),N.append(Q);function $(){(async()=>{try{let t=await e(()=>import(`./live-proxy-transport-sCpJwoL7.js`),__vite__mapDeps([0,1])),i=await t.probeLive();if(i.available){let e=r();z.models=S,z.model=e.model,z.efforts=s,z.effort=e.effort,z.onModelChange(t=>{e={...e,model:t,provider:a(t)??e.provider},z.model=t,n(e)}),z.onEffortChange(t=>{e={...e,effort:t},z.effort=t,n(e)}),W=t.createLiveProxyTransport({get:()=>e},D),G=!0,A(void 0),R(`system`,`Live agent connected (${i.providers} provider(s) available). Prompt it to render a real GenUI surface.`)}else A(`Recorded demo`),R(`system`,`Recorded demo. Send a message to begin — the demo advances one canned turn per message (it does not read what you type).`)}catch{A(`Recorded demo`),R(`system`,`Recorded backbone demo (live overlay unavailable).`)}})()}$();