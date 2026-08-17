import"./super-shell-D76CLu9A.js";import{n as e,r as t}from"./_page-DIBN49D1.js";import{a as n}from"./doc-page-H_CmxYv1.js";function r(e,t){let n=e.indexOf(`${t} {`);if(n<0)return``;let r=e.indexOf(`{`,n),i=e.indexOf(`
}`,r);return i<0?e.slice(r+1):e.slice(r+1,i)}var i=/^[\d-]+$/,a=/^scrim-\d+$/;function o(e){let t=r(e,`:root`),n=[];for(let e of t.matchAll(/--md-sys-color-([a-z]+)-([a-z0-9-]+):\s*([^;]+);/g)){let[,t,r,o]=e;i.test(r)||a.test(r)||n.push({family:t,role:r,varName:`--md-sys-color-${t}-${r}`,value:o.trim()})}return n}function s(e,t){let n=r(e,`:root`)+`
`+r(e,`*`),i=[],a=new Set,o=new RegExp(String.raw`--${t}-([a-z0-9]+):\s*([^;]+);`,`g`);for(let e of n.matchAll(o)){let[,t,n]=e;a.has(t)||(a.add(t),i.push({tier:t,value:n.trim()}))}return i}var c=/^\d+$/;function l(e){let t=r(e,`:root`),n=/--md-sys-color-([a-z]+)-([a-z0-9-]+):\s*([^;]+);/g,i=new Map;for(let e of t.matchAll(n)){let[,t,n,r]=e;if(!c.test(n))continue;let a=i.get(t)??[];a.push({family:t,step:n,varName:`--md-sys-color-${t}-${n}`,value:r.trim()}),i.set(t,a)}for(let e of i.values())e.sort((e,t)=>Number(e.step)-Number(t.step));return Object.fromEntries(i)}function u(e){let t=r(e,`:root`)+`
`+r(e,`*`),n=new Map,i=[];for(let e of t.matchAll(/--md-sys-typescale-([a-z]+)-(large|medium|small)-(size|weight|line-height|tracking):\s*([^;]+);/g)){let[,t,r,a,o]=e,s=`${t}/${r}`;i.includes(t)||i.push(t);let c=n.get(s)??{};c[a]=o.trim(),n.set(s,c)}let a=[];for(let e of i)for(let t of[`large`,`medium`,`small`]){let r=n.get(`${e}/${t}`);r?.size===void 0||r.weight===void 0||r[`line-height`]===void 0||r.tracking===void 0||a.push({role:e,size:t,sizeValue:r.size,weight:r.weight,lineHeight:r[`line-height`],tracking:r.tracking})}return a}function d(e){let t=[],n=new Set;for(let r of e)n.has(r.family)||(n.add(r.family),t.push(r.family));return t}var f=`:root {
  color-scheme: light dark;
  --md-sys-color-dialog-backdrop: oklch(0 0 0 / 80%);

  /* neutral — flat mode-independent primitives */
  --md-sys-color-neutral-100: oklch(0.9559 0.0011 17.18);
  --md-sys-color-neutral-125: oklch(0.9345 0.0017 67.8);
  --md-sys-color-neutral-150: oklch(0.913 0.0029 84.56);
  --md-sys-color-neutral-175: oklch(0.8914 0.0042 91.45);
  --md-sys-color-neutral-200: oklch(0.8696 0.0056 95.11);
  --md-sys-color-neutral-250: oklch(0.8236 0.0073 88.65);
  --md-sys-color-neutral-300: oklch(0.7799 0.0104 87.48);
  --md-sys-color-neutral-350: oklch(0.7368 0.0143 97.51);
  --md-sys-color-neutral-400: oklch(0.6921 0.0161 94.28);
  --md-sys-color-neutral-450: oklch(0.6469 0.0167 90.3);
  --md-sys-color-neutral-500: oklch(0.6035 0.017 90.31);
  --md-sys-color-neutral-550: oklch(0.5586 0.0155 93.1);
  --md-sys-color-neutral-600: oklch(0.5137 0.0144 91.63);
  --md-sys-color-neutral-650: oklch(0.4705 0.0128 95.33);
  --md-sys-color-neutral-700: oklch(0.4239 0.0101 91.6);
  --md-sys-color-neutral-750: oklch(0.3794 0.0088 88.73);
  --md-sys-color-neutral-800: oklch(0.3325 0.007 95.27);
  --md-sys-color-neutral-825: oklch(0.3091 0.0055 91.56);
  --md-sys-color-neutral-850: oklch(0.2853 0.0039 84.58);
  --md-sys-color-neutral-875: oklch(0.2606 0.004 84.58);
  --md-sys-color-neutral-900: oklch(0.2343 0.0038 106.69);
  --md-sys-color-neutral-925: oklch(0.2086 0.0019 106.57);
  --md-sys-color-neutral-950: oklch(0.1772 0.002 106.6);
  --md-sys-color-neutral-050: oklch(1 0 89.88);
  --md-sys-color-neutral-075: oklch(0.9789 0.0013 106.42);
  --md-sys-color-neutral-scrim-050: oklch(0.6035 0.017 90.31 / 5%);
  --md-sys-color-neutral-scrim-100: oklch(0.6035 0.017 90.31 / 10%);
  --md-sys-color-neutral-scrim-200: oklch(0.6035 0.017 90.31 / 20%);
  --md-sys-color-neutral-scrim-300: oklch(0.6035 0.017 90.31 / 30%);
  --md-sys-color-neutral-scrim-400: oklch(0.6035 0.017 90.31 / 40%);
  --md-sys-color-neutral-scrim-500: oklch(0.6035 0.017 90.31 / 50%);
  --md-sys-color-neutral-scrim-600: oklch(0.6035 0.017 90.31 / 60%);
  --md-sys-color-neutral-scrim-700: oklch(0.6035 0.017 90.31 / 70%);
  --md-sys-color-neutral-scrim-800: oklch(0.6035 0.017 90.31 / 80%);
  --md-sys-color-neutral-scrim-900: oklch(0.6035 0.017 90.31 / 90%);
  --md-sys-color-neutral-scrim-950: oklch(0.6035 0.017 90.31 / 95%);
  /* neutral — semantic roles */
  --md-sys-color-neutral: light-dark(var(--md-sys-color-neutral-550), var(--md-sys-color-neutral-450));
  --md-sys-color-neutral-dim: light-dark(var(--md-sys-color-neutral-650), var(--md-sys-color-neutral-700));
  --md-sys-color-neutral-bright: light-dark(var(--md-sys-color-neutral-350), var(--md-sys-color-neutral-400));
  --md-sys-color-neutral-low: light-dark(var(--md-sys-color-neutral-350), var(--md-sys-color-neutral-700));
  --md-sys-color-neutral-high: light-dark(var(--md-sys-color-neutral-650), var(--md-sys-color-neutral-400));
  --md-sys-color-neutral-hover: light-dark(var(--md-sys-color-neutral-650), var(--md-sys-color-neutral-350));
  --md-sys-color-neutral-active: light-dark(var(--md-sys-color-neutral-750), var(--md-sys-color-neutral-250));
  --md-sys-color-neutral-disabled: light-dark(var(--md-sys-color-neutral-scrim-600), var(--md-sys-color-neutral-scrim-600));
  --md-sys-color-neutral-on-neutral: light-dark(var(--md-sys-color-neutral-050), var(--md-sys-color-neutral-050));
  --md-sys-color-neutral-on-neutral-variant: light-dark(var(--md-sys-color-neutral-200), var(--md-sys-color-neutral-200));
  --md-sys-color-neutral-on-neutral-hover: light-dark(var(--md-sys-color-neutral-050), var(--md-sys-color-neutral-050));
  --md-sys-color-neutral-on-neutral-active: light-dark(var(--md-sys-color-neutral-050), var(--md-sys-color-neutral-050));
  --md-sys-color-neutral-on-neutral-disabled: light-dark(var(--md-sys-color-neutral-scrim-400), var(--md-sys-color-neutral-scrim-400));
  --md-sys-color-neutral-on-surface: light-dark(var(--md-sys-color-neutral-950), var(--md-sys-color-neutral-050));
  --md-sys-color-neutral-on-surface-variant: light-dark(var(--md-sys-color-neutral-750), var(--md-sys-color-neutral-250));
  --md-sys-color-neutral-on-surface-hover: light-dark(var(--md-sys-color-neutral-950), var(--md-sys-color-neutral-050));
  --md-sys-color-neutral-on-surface-active: light-dark(var(--md-sys-color-neutral-950), var(--md-sys-color-neutral-050));
  --md-sys-color-neutral-on-surface-disabled: light-dark(var(--md-sys-color-neutral-scrim-400), var(--md-sys-color-neutral-scrim-400));
  --md-sys-color-neutral-placeholder: light-dark(var(--md-sys-color-neutral-650), var(--md-sys-color-neutral-350));
  --md-sys-color-neutral-outline: light-dark(var(--md-sys-color-neutral-scrim-600), var(--md-sys-color-neutral-scrim-600));
  --md-sys-color-neutral-outline-variant: light-dark(var(--md-sys-color-neutral-scrim-300), var(--md-sys-color-neutral-scrim-300));
  --md-sys-color-neutral-outline-hover: light-dark(var(--md-sys-color-neutral-scrim-700), var(--md-sys-color-neutral-scrim-700));
  --md-sys-color-neutral-outline-active: light-dark(var(--md-sys-color-neutral-scrim-800), var(--md-sys-color-neutral-scrim-800));
  --md-sys-color-neutral-outline-disabled: light-dark(var(--md-sys-color-neutral-scrim-400), var(--md-sys-color-neutral-scrim-400));
  --md-sys-color-neutral-container: light-dark(var(--md-sys-color-neutral-scrim-200), var(--md-sys-color-neutral-scrim-200));
  --md-sys-color-neutral-container-low: light-dark(var(--md-sys-color-neutral-scrim-100), var(--md-sys-color-neutral-scrim-100));
  --md-sys-color-neutral-container-high: light-dark(var(--md-sys-color-neutral-scrim-300), var(--md-sys-color-neutral-scrim-300));
  --md-sys-color-neutral-container-hover: light-dark(var(--md-sys-color-neutral-scrim-300), var(--md-sys-color-neutral-scrim-300));
  --md-sys-color-neutral-container-active: light-dark(var(--md-sys-color-neutral-scrim-400), var(--md-sys-color-neutral-scrim-400));
  --md-sys-color-neutral-container-disabled: light-dark(var(--md-sys-color-neutral-scrim-100), var(--md-sys-color-neutral-scrim-100));
  --md-sys-color-neutral-inverse-surface: light-dark(var(--md-sys-color-neutral-900), var(--md-sys-color-neutral-100));
  --md-sys-color-neutral-inverse-on-surface: light-dark(var(--md-sys-color-neutral-050), var(--md-sys-color-neutral-950));
  --md-sys-color-neutral-background: light-dark(var(--md-sys-color-neutral-100), var(--md-sys-color-neutral-900));
  --md-sys-color-neutral-surface: light-dark(var(--md-sys-color-neutral-125), var(--md-sys-color-neutral-875));
  --md-sys-color-neutral-surface-dimmest: light-dark(var(--md-sys-color-neutral-200), var(--md-sys-color-neutral-950));
  --md-sys-color-neutral-surface-dimmer: light-dark(var(--md-sys-color-neutral-175), var(--md-sys-color-neutral-925));
  --md-sys-color-neutral-surface-dim: light-dark(var(--md-sys-color-neutral-150), var(--md-sys-color-neutral-900));
  --md-sys-color-neutral-surface-bright: light-dark(var(--md-sys-color-neutral-100), var(--md-sys-color-neutral-850));
  --md-sys-color-neutral-surface-brighter: light-dark(var(--md-sys-color-neutral-075), var(--md-sys-color-neutral-825));
  --md-sys-color-neutral-surface-brightest: light-dark(var(--md-sys-color-neutral-050), var(--md-sys-color-neutral-800));
  --md-sys-color-neutral-surface-lowest: light-dark(var(--md-sys-color-neutral-050), var(--md-sys-color-neutral-950));
  --md-sys-color-neutral-surface-lower: light-dark(var(--md-sys-color-neutral-075), var(--md-sys-color-neutral-925));
  --md-sys-color-neutral-surface-low: light-dark(var(--md-sys-color-neutral-100), var(--md-sys-color-neutral-900));
  --md-sys-color-neutral-surface-high: light-dark(var(--md-sys-color-neutral-150), var(--md-sys-color-neutral-850));
  --md-sys-color-neutral-surface-higher: light-dark(var(--md-sys-color-neutral-175), var(--md-sys-color-neutral-825));
  --md-sys-color-neutral-surface-highest: light-dark(var(--md-sys-color-neutral-200), var(--md-sys-color-neutral-800));
  --md-sys-color-neutral-scrim-weakest: light-dark(var(--md-sys-color-neutral-scrim-050), var(--md-sys-color-neutral-scrim-050));
  --md-sys-color-neutral-scrim-weaker: light-dark(var(--md-sys-color-neutral-scrim-100), var(--md-sys-color-neutral-scrim-100));
  --md-sys-color-neutral-scrim-weak: light-dark(var(--md-sys-color-neutral-scrim-200), var(--md-sys-color-neutral-scrim-200));
  --md-sys-color-neutral-scrim: light-dark(var(--md-sys-color-neutral-scrim-300), var(--md-sys-color-neutral-scrim-300));
  --md-sys-color-neutral-scrim-strong: light-dark(var(--md-sys-color-neutral-scrim-400), var(--md-sys-color-neutral-scrim-400));
  --md-sys-color-neutral-scrim-stronger: light-dark(var(--md-sys-color-neutral-scrim-500), var(--md-sys-color-neutral-scrim-500));
  --md-sys-color-neutral-scrim-strongest: light-dark(var(--md-sys-color-neutral-scrim-600), var(--md-sys-color-neutral-scrim-600));
  /* neutral — retained key colors (exact, OKLCH) */
  --md-sys-color-neutral-key-dominant: oklch(0.66 0.018 93.66);

  /* primary — flat mode-independent primitives */
  --md-sys-color-primary-100: oklch(0.9567 0.0052 247.88);
  --md-sys-color-primary-125: oklch(0.935 0.0097 252.81);
  --md-sys-color-primary-150: oklch(0.9131 0.0144 254.61);
  --md-sys-color-primary-175: oklch(0.8905 0.0197 252.89);
  --md-sys-color-primary-200: oklch(0.8688 0.0257 255.57);
  --md-sys-color-primary-250: oklch(0.8241 0.0404 256.6);
  --md-sys-color-primary-300: oklch(0.7813 0.0547 255.45);
  --md-sys-color-primary-350: oklch(0.7365 0.0701 256.11);
  --md-sys-color-primary-400: oklch(0.6912 0.0847 256.1);
  --md-sys-color-primary-450: oklch(0.6486 0.095 255.5);
  --md-sys-color-primary-500: oklch(0.6037 0.101 256.19);
  --md-sys-color-primary-550: oklch(0.5596 0.0962 255.73);
  --md-sys-color-primary-600: oklch(0.5147 0.0858 255.52);
  --md-sys-color-primary-650: oklch(0.4695 0.0745 255.92);
  --md-sys-color-primary-700: oklch(0.4256 0.0617 255.01);
  --md-sys-color-primary-750: oklch(0.3781 0.0495 255.54);
  --md-sys-color-primary-800: oklch(0.3325 0.0371 254.97);
  --md-sys-color-primary-825: oklch(0.3098 0.0311 256.26);
  --md-sys-color-primary-850: oklch(0.286 0.0255 255.73);
  --md-sys-color-primary-875: oklch(0.2617 0.0197 254.84);
  --md-sys-color-primary-900: oklch(0.2331 0.0155 256.81);
  --md-sys-color-primary-925: oklch(0.2071 0.0117 254.09);
  --md-sys-color-primary-950: oklch(0.1768 0.007 258.37);
  --md-sys-color-primary-050: oklch(1 0 89.88);
  --md-sys-color-primary-075: oklch(0.9787 0.0017 247.84);
  --md-sys-color-primary-scrim-050: oklch(0.6037 0.101 256.19 / 5%);
  --md-sys-color-primary-scrim-100: oklch(0.6037 0.101 256.19 / 10%);
  --md-sys-color-primary-scrim-200: oklch(0.6037 0.101 256.19 / 20%);
  --md-sys-color-primary-scrim-300: oklch(0.6037 0.101 256.19 / 30%);
  --md-sys-color-primary-scrim-400: oklch(0.6037 0.101 256.19 / 40%);
  --md-sys-color-primary-scrim-500: oklch(0.6037 0.101 256.19 / 50%);
  --md-sys-color-primary-scrim-600: oklch(0.6037 0.101 256.19 / 60%);
  --md-sys-color-primary-scrim-700: oklch(0.6037 0.101 256.19 / 70%);
  --md-sys-color-primary-scrim-800: oklch(0.6037 0.101 256.19 / 80%);
  --md-sys-color-primary-scrim-900: oklch(0.6037 0.101 256.19 / 90%);
  --md-sys-color-primary-scrim-950: oklch(0.6037 0.101 256.19 / 95%);
  /* primary — semantic roles */
  --md-sys-color-primary: light-dark(var(--md-sys-color-primary-550), var(--md-sys-color-primary-450));
  --md-sys-color-primary-dim: light-dark(var(--md-sys-color-primary-650), var(--md-sys-color-primary-700));
  --md-sys-color-primary-bright: light-dark(var(--md-sys-color-primary-350), var(--md-sys-color-primary-400));
  --md-sys-color-primary-low: light-dark(var(--md-sys-color-primary-350), var(--md-sys-color-primary-700));
  --md-sys-color-primary-high: light-dark(var(--md-sys-color-primary-650), var(--md-sys-color-primary-400));
  --md-sys-color-primary-hover: light-dark(var(--md-sys-color-primary-650), var(--md-sys-color-primary-350));
  --md-sys-color-primary-active: light-dark(var(--md-sys-color-primary-750), var(--md-sys-color-primary-250));
  --md-sys-color-primary-disabled: light-dark(var(--md-sys-color-primary-scrim-600), var(--md-sys-color-primary-scrim-600));
  --md-sys-color-primary-on-primary: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-050));
  --md-sys-color-primary-on-primary-variant: light-dark(var(--md-sys-color-primary-200), var(--md-sys-color-primary-200));
  --md-sys-color-primary-on-primary-hover: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-050));
  --md-sys-color-primary-on-primary-active: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-050));
  --md-sys-color-primary-on-primary-disabled: light-dark(var(--md-sys-color-primary-scrim-400), var(--md-sys-color-primary-scrim-400));
  --md-sys-color-primary-on-surface: light-dark(var(--md-sys-color-primary-950), var(--md-sys-color-primary-050));
  --md-sys-color-primary-on-surface-variant: light-dark(var(--md-sys-color-primary-750), var(--md-sys-color-primary-250));
  --md-sys-color-primary-on-surface-hover: light-dark(var(--md-sys-color-primary-950), var(--md-sys-color-primary-050));
  --md-sys-color-primary-on-surface-active: light-dark(var(--md-sys-color-primary-950), var(--md-sys-color-primary-050));
  --md-sys-color-primary-on-surface-disabled: light-dark(var(--md-sys-color-primary-scrim-400), var(--md-sys-color-primary-scrim-400));
  --md-sys-color-primary-placeholder: light-dark(var(--md-sys-color-primary-650), var(--md-sys-color-primary-350));
  --md-sys-color-primary-outline: light-dark(var(--md-sys-color-primary-scrim-600), var(--md-sys-color-primary-scrim-600));
  --md-sys-color-primary-outline-variant: light-dark(var(--md-sys-color-primary-scrim-300), var(--md-sys-color-primary-scrim-300));
  --md-sys-color-primary-outline-hover: light-dark(var(--md-sys-color-primary-scrim-700), var(--md-sys-color-primary-scrim-700));
  --md-sys-color-primary-outline-active: light-dark(var(--md-sys-color-primary-scrim-800), var(--md-sys-color-primary-scrim-800));
  --md-sys-color-primary-outline-disabled: light-dark(var(--md-sys-color-primary-scrim-400), var(--md-sys-color-primary-scrim-400));
  --md-sys-color-primary-container: light-dark(var(--md-sys-color-primary-scrim-200), var(--md-sys-color-primary-scrim-200));
  --md-sys-color-primary-container-low: light-dark(var(--md-sys-color-primary-scrim-100), var(--md-sys-color-primary-scrim-100));
  --md-sys-color-primary-container-high: light-dark(var(--md-sys-color-primary-scrim-300), var(--md-sys-color-primary-scrim-300));
  --md-sys-color-primary-container-hover: light-dark(var(--md-sys-color-primary-scrim-300), var(--md-sys-color-primary-scrim-300));
  --md-sys-color-primary-container-active: light-dark(var(--md-sys-color-primary-scrim-400), var(--md-sys-color-primary-scrim-400));
  --md-sys-color-primary-container-disabled: light-dark(var(--md-sys-color-primary-scrim-100), var(--md-sys-color-primary-scrim-100));
  --md-sys-color-primary-inverse-surface: light-dark(var(--md-sys-color-primary-900), var(--md-sys-color-primary-100));
  --md-sys-color-primary-inverse-on-surface: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-950));
  --md-sys-color-primary-background: light-dark(var(--md-sys-color-primary-100), var(--md-sys-color-primary-900));
  --md-sys-color-primary-surface: light-dark(var(--md-sys-color-primary-125), var(--md-sys-color-primary-875));
  --md-sys-color-primary-surface-dimmest: light-dark(var(--md-sys-color-primary-200), var(--md-sys-color-primary-950));
  --md-sys-color-primary-surface-dimmer: light-dark(var(--md-sys-color-primary-175), var(--md-sys-color-primary-925));
  --md-sys-color-primary-surface-dim: light-dark(var(--md-sys-color-primary-150), var(--md-sys-color-primary-900));
  --md-sys-color-primary-surface-bright: light-dark(var(--md-sys-color-primary-100), var(--md-sys-color-primary-850));
  --md-sys-color-primary-surface-brighter: light-dark(var(--md-sys-color-primary-075), var(--md-sys-color-primary-825));
  --md-sys-color-primary-surface-brightest: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-800));
  --md-sys-color-primary-surface-lowest: light-dark(var(--md-sys-color-primary-050), var(--md-sys-color-primary-950));
  --md-sys-color-primary-surface-lower: light-dark(var(--md-sys-color-primary-075), var(--md-sys-color-primary-925));
  --md-sys-color-primary-surface-low: light-dark(var(--md-sys-color-primary-100), var(--md-sys-color-primary-900));
  --md-sys-color-primary-surface-high: light-dark(var(--md-sys-color-primary-150), var(--md-sys-color-primary-850));
  --md-sys-color-primary-surface-higher: light-dark(var(--md-sys-color-primary-175), var(--md-sys-color-primary-825));
  --md-sys-color-primary-surface-highest: light-dark(var(--md-sys-color-primary-200), var(--md-sys-color-primary-800));
  --md-sys-color-primary-scrim-weakest: light-dark(var(--md-sys-color-primary-scrim-050), var(--md-sys-color-primary-scrim-050));
  --md-sys-color-primary-scrim-weaker: light-dark(var(--md-sys-color-primary-scrim-100), var(--md-sys-color-primary-scrim-100));
  --md-sys-color-primary-scrim-weak: light-dark(var(--md-sys-color-primary-scrim-200), var(--md-sys-color-primary-scrim-200));
  --md-sys-color-primary-scrim: light-dark(var(--md-sys-color-primary-scrim-300), var(--md-sys-color-primary-scrim-300));
  --md-sys-color-primary-scrim-strong: light-dark(var(--md-sys-color-primary-scrim-400), var(--md-sys-color-primary-scrim-400));
  --md-sys-color-primary-scrim-stronger: light-dark(var(--md-sys-color-primary-scrim-500), var(--md-sys-color-primary-scrim-500));
  --md-sys-color-primary-scrim-strongest: light-dark(var(--md-sys-color-primary-scrim-600), var(--md-sys-color-primary-scrim-600));
  /* primary — retained key colors (exact, OKLCH) */
  --md-sys-color-primary-key-dominant: oklch(0.382 0.082 256);

  /* primary-muted — flat mode-independent primitives */
  --md-sys-color-primary-muted-100: oklch(0.9554 0.0045 214.33);
  --md-sys-color-primary-muted-125: oklch(0.9343 0.0087 205.89);
  --md-sys-color-primary-muted-150: oklch(0.9114 0.0125 215.83);
  --md-sys-color-primary-muted-175: oklch(0.8902 0.0167 211.04);
  --md-sys-color-primary-muted-200: oklch(0.8678 0.0232 210.4);
  --md-sys-color-primary-muted-250: oklch(0.8243 0.0342 210.65);
  --md-sys-color-primary-muted-300: oklch(0.7812 0.0437 209.39);
  --md-sys-color-primary-muted-350: oklch(0.7364 0.0515 210.69);
  --md-sys-color-primary-muted-400: oklch(0.6924 0.0555 209.68);
  --md-sys-color-primary-muted-450: oklch(0.6468 0.0572 210.97);
  --md-sys-color-primary-muted-500: oklch(0.6036 0.0571 209.61);
  --md-sys-color-primary-muted-550: oklch(0.5595 0.053 211.01);
  --md-sys-color-primary-muted-600: oklch(0.5146 0.0474 211.24);
  --md-sys-color-primary-muted-650: oklch(0.4688 0.0418 211.55);
  --md-sys-color-primary-muted-700: oklch(0.425 0.0354 209.41);
  --md-sys-color-primary-muted-750: oklch(0.3779 0.0286 213.33);
  --md-sys-color-primary-muted-800: oklch(0.3318 0.0215 210.35);
  --md-sys-color-primary-muted-825: oklch(0.3093 0.019 207.06);
  --md-sys-color-primary-muted-850: oklch(0.2837 0.0155 209.88);
  --md-sys-color-primary-muted-875: oklch(0.2604 0.0128 204.71);
  --md-sys-color-primary-muted-900: oklch(0.2341 0.0096 219.91);
  --md-sys-color-primary-muted-925: oklch(0.2082 0.0076 196.58);
  --md-sys-color-primary-muted-950: oklch(0.1789 0.0048 196.73);
  --md-sys-color-primary-muted-050: oklch(1 0 89.88);
  --md-sys-color-primary-muted-075: oklch(0.9776 0.0021 197.12);
  --md-sys-color-primary-muted-scrim-050: oklch(0.6036 0.0571 209.61 / 5%);
  --md-sys-color-primary-muted-scrim-100: oklch(0.6036 0.0571 209.61 / 10%);
  --md-sys-color-primary-muted-scrim-200: oklch(0.6036 0.0571 209.61 / 20%);
  --md-sys-color-primary-muted-scrim-300: oklch(0.6036 0.0571 209.61 / 30%);
  --md-sys-color-primary-muted-scrim-400: oklch(0.6036 0.0571 209.61 / 40%);
  --md-sys-color-primary-muted-scrim-500: oklch(0.6036 0.0571 209.61 / 50%);
  --md-sys-color-primary-muted-scrim-600: oklch(0.6036 0.0571 209.61 / 60%);
  --md-sys-color-primary-muted-scrim-700: oklch(0.6036 0.0571 209.61 / 70%);
  --md-sys-color-primary-muted-scrim-800: oklch(0.6036 0.0571 209.61 / 80%);
  --md-sys-color-primary-muted-scrim-900: oklch(0.6036 0.0571 209.61 / 90%);
  --md-sys-color-primary-muted-scrim-950: oklch(0.6036 0.0571 209.61 / 95%);
  /* primary-muted — semantic roles */
  --md-sys-color-primary-muted: light-dark(var(--md-sys-color-primary-muted-550), var(--md-sys-color-primary-muted-450));
  --md-sys-color-primary-muted-dim: light-dark(var(--md-sys-color-primary-muted-650), var(--md-sys-color-primary-muted-700));
  --md-sys-color-primary-muted-bright: light-dark(var(--md-sys-color-primary-muted-350), var(--md-sys-color-primary-muted-400));
  --md-sys-color-primary-muted-low: light-dark(var(--md-sys-color-primary-muted-350), var(--md-sys-color-primary-muted-700));
  --md-sys-color-primary-muted-high: light-dark(var(--md-sys-color-primary-muted-650), var(--md-sys-color-primary-muted-400));
  --md-sys-color-primary-muted-hover: light-dark(var(--md-sys-color-primary-muted-650), var(--md-sys-color-primary-muted-350));
  --md-sys-color-primary-muted-active: light-dark(var(--md-sys-color-primary-muted-750), var(--md-sys-color-primary-muted-250));
  --md-sys-color-primary-muted-disabled: light-dark(var(--md-sys-color-primary-muted-scrim-600), var(--md-sys-color-primary-muted-scrim-600));
  --md-sys-color-primary-muted-on-primary-muted: light-dark(var(--md-sys-color-primary-muted-050), var(--md-sys-color-primary-muted-050));
  --md-sys-color-primary-muted-on-primary-muted-variant: light-dark(var(--md-sys-color-primary-muted-200), var(--md-sys-color-primary-muted-200));
  --md-sys-color-primary-muted-on-primary-muted-hover: light-dark(var(--md-sys-color-primary-muted-050), var(--md-sys-color-primary-muted-050));
  --md-sys-color-primary-muted-on-primary-muted-active: light-dark(var(--md-sys-color-primary-muted-050), var(--md-sys-color-primary-muted-050));
  --md-sys-color-primary-muted-on-primary-muted-disabled: light-dark(var(--md-sys-color-primary-muted-scrim-400), var(--md-sys-color-primary-muted-scrim-400));
  --md-sys-color-primary-muted-on-surface: light-dark(var(--md-sys-color-primary-muted-950), var(--md-sys-color-primary-muted-050));
  --md-sys-color-primary-muted-on-surface-variant: light-dark(var(--md-sys-color-primary-muted-750), var(--md-sys-color-primary-muted-250));
  --md-sys-color-primary-muted-on-surface-hover: light-dark(var(--md-sys-color-primary-muted-950), var(--md-sys-color-primary-muted-050));
  --md-sys-color-primary-muted-on-surface-active: light-dark(var(--md-sys-color-primary-muted-950), var(--md-sys-color-primary-muted-050));
  --md-sys-color-primary-muted-on-surface-disabled: light-dark(var(--md-sys-color-primary-muted-scrim-400), var(--md-sys-color-primary-muted-scrim-400));
  --md-sys-color-primary-muted-placeholder: light-dark(var(--md-sys-color-primary-muted-650), var(--md-sys-color-primary-muted-350));
  --md-sys-color-primary-muted-outline: light-dark(var(--md-sys-color-primary-muted-scrim-600), var(--md-sys-color-primary-muted-scrim-600));
  --md-sys-color-primary-muted-outline-variant: light-dark(var(--md-sys-color-primary-muted-scrim-300), var(--md-sys-color-primary-muted-scrim-300));
  --md-sys-color-primary-muted-outline-hover: light-dark(var(--md-sys-color-primary-muted-scrim-700), var(--md-sys-color-primary-muted-scrim-700));
  --md-sys-color-primary-muted-outline-active: light-dark(var(--md-sys-color-primary-muted-scrim-800), var(--md-sys-color-primary-muted-scrim-800));
  --md-sys-color-primary-muted-outline-disabled: light-dark(var(--md-sys-color-primary-muted-scrim-400), var(--md-sys-color-primary-muted-scrim-400));
  --md-sys-color-primary-muted-container: light-dark(var(--md-sys-color-primary-muted-scrim-200), var(--md-sys-color-primary-muted-scrim-200));
  --md-sys-color-primary-muted-container-low: light-dark(var(--md-sys-color-primary-muted-scrim-100), var(--md-sys-color-primary-muted-scrim-100));
  --md-sys-color-primary-muted-container-high: light-dark(var(--md-sys-color-primary-muted-scrim-300), var(--md-sys-color-primary-muted-scrim-300));
  --md-sys-color-primary-muted-container-hover: light-dark(var(--md-sys-color-primary-muted-scrim-300), var(--md-sys-color-primary-muted-scrim-300));
  --md-sys-color-primary-muted-container-active: light-dark(var(--md-sys-color-primary-muted-scrim-400), var(--md-sys-color-primary-muted-scrim-400));
  --md-sys-color-primary-muted-container-disabled: light-dark(var(--md-sys-color-primary-muted-scrim-100), var(--md-sys-color-primary-muted-scrim-100));
  --md-sys-color-primary-muted-inverse-surface: light-dark(var(--md-sys-color-primary-muted-900), var(--md-sys-color-primary-muted-100));
  --md-sys-color-primary-muted-inverse-on-surface: light-dark(var(--md-sys-color-primary-muted-050), var(--md-sys-color-primary-muted-950));
  --md-sys-color-primary-muted-background: light-dark(var(--md-sys-color-primary-muted-100), var(--md-sys-color-primary-muted-900));
  --md-sys-color-primary-muted-surface: light-dark(var(--md-sys-color-primary-muted-125), var(--md-sys-color-primary-muted-875));
  --md-sys-color-primary-muted-surface-dimmest: light-dark(var(--md-sys-color-primary-muted-200), var(--md-sys-color-primary-muted-950));
  --md-sys-color-primary-muted-surface-dimmer: light-dark(var(--md-sys-color-primary-muted-175), var(--md-sys-color-primary-muted-925));
  --md-sys-color-primary-muted-surface-dim: light-dark(var(--md-sys-color-primary-muted-150), var(--md-sys-color-primary-muted-900));
  --md-sys-color-primary-muted-surface-bright: light-dark(var(--md-sys-color-primary-muted-100), var(--md-sys-color-primary-muted-850));
  --md-sys-color-primary-muted-surface-brighter: light-dark(var(--md-sys-color-primary-muted-075), var(--md-sys-color-primary-muted-825));
  --md-sys-color-primary-muted-surface-brightest: light-dark(var(--md-sys-color-primary-muted-050), var(--md-sys-color-primary-muted-800));
  --md-sys-color-primary-muted-surface-lowest: light-dark(var(--md-sys-color-primary-muted-050), var(--md-sys-color-primary-muted-950));
  --md-sys-color-primary-muted-surface-lower: light-dark(var(--md-sys-color-primary-muted-075), var(--md-sys-color-primary-muted-925));
  --md-sys-color-primary-muted-surface-low: light-dark(var(--md-sys-color-primary-muted-100), var(--md-sys-color-primary-muted-900));
  --md-sys-color-primary-muted-surface-high: light-dark(var(--md-sys-color-primary-muted-150), var(--md-sys-color-primary-muted-850));
  --md-sys-color-primary-muted-surface-higher: light-dark(var(--md-sys-color-primary-muted-175), var(--md-sys-color-primary-muted-825));
  --md-sys-color-primary-muted-surface-highest: light-dark(var(--md-sys-color-primary-muted-200), var(--md-sys-color-primary-muted-800));
  --md-sys-color-primary-muted-scrim-weakest: light-dark(var(--md-sys-color-primary-muted-scrim-050), var(--md-sys-color-primary-muted-scrim-050));
  --md-sys-color-primary-muted-scrim-weaker: light-dark(var(--md-sys-color-primary-muted-scrim-100), var(--md-sys-color-primary-muted-scrim-100));
  --md-sys-color-primary-muted-scrim-weak: light-dark(var(--md-sys-color-primary-muted-scrim-200), var(--md-sys-color-primary-muted-scrim-200));
  --md-sys-color-primary-muted-scrim: light-dark(var(--md-sys-color-primary-muted-scrim-300), var(--md-sys-color-primary-muted-scrim-300));
  --md-sys-color-primary-muted-scrim-strong: light-dark(var(--md-sys-color-primary-muted-scrim-400), var(--md-sys-color-primary-muted-scrim-400));
  --md-sys-color-primary-muted-scrim-stronger: light-dark(var(--md-sys-color-primary-muted-scrim-500), var(--md-sys-color-primary-muted-scrim-500));
  --md-sys-color-primary-muted-scrim-strongest: light-dark(var(--md-sys-color-primary-muted-scrim-600), var(--md-sys-color-primary-muted-scrim-600));
  /* primary-muted — retained key colors (exact, OKLCH) */
  --md-sys-color-primary-muted-key-dominant: oklch(0.412 0.052 210);

  /* secondary — flat mode-independent primitives */
  --md-sys-color-secondary-100: oklch(0.9556 0.0057 84.57);
  --md-sys-color-secondary-125: oklch(0.9352 0.0103 81.79);
  --md-sys-color-secondary-150: oklch(0.9117 0.0149 80.71);
  --md-sys-color-secondary-175: oklch(0.8906 0.022 83.26);
  --md-sys-color-secondary-200: oklch(0.8684 0.0289 79.46);
  --md-sys-color-secondary-250: oklch(0.8237 0.0436 81.08);
  --md-sys-color-secondary-300: oklch(0.7803 0.0565 79.52);
  --md-sys-color-secondary-350: oklch(0.7373 0.0666 80.49);
  --md-sys-color-secondary-400: oklch(0.6926 0.0721 81.42);
  --md-sys-color-secondary-450: oklch(0.6479 0.0744 80.83);
  --md-sys-color-secondary-500: oklch(0.6041 0.0733 81.04);
  --md-sys-color-secondary-550: oklch(0.5591 0.0675 80.26);
  --md-sys-color-secondary-600: oklch(0.5156 0.061 80.42);
  --md-sys-color-secondary-650: oklch(0.4702 0.0526 81.27);
  --md-sys-color-secondary-700: oklch(0.4249 0.0444 80.82);
  --md-sys-color-secondary-750: oklch(0.3783 0.0358 80.06);
  --md-sys-color-secondary-800: oklch(0.3329 0.0273 82.97);
  --md-sys-color-secondary-825: oklch(0.3089 0.0228 81.01);
  --md-sys-color-secondary-850: oklch(0.2843 0.0195 80.4);
  --md-sys-color-secondary-875: oklch(0.259 0.0162 79.49);
  --md-sys-color-secondary-900: oklch(0.2332 0.0127 78);
  --md-sys-color-secondary-925: oklch(0.2066 0.0091 75.12);
  --md-sys-color-secondary-950: oklch(0.1776 0.0062 91.67);
  --md-sys-color-secondary-050: oklch(1 0 89.88);
  --md-sys-color-secondary-075: oklch(0.9786 0.0026 106.45);
  --md-sys-color-secondary-scrim-050: oklch(0.6041 0.0733 81.04 / 5%);
  --md-sys-color-secondary-scrim-100: oklch(0.6041 0.0733 81.04 / 10%);
  --md-sys-color-secondary-scrim-200: oklch(0.6041 0.0733 81.04 / 20%);
  --md-sys-color-secondary-scrim-300: oklch(0.6041 0.0733 81.04 / 30%);
  --md-sys-color-secondary-scrim-400: oklch(0.6041 0.0733 81.04 / 40%);
  --md-sys-color-secondary-scrim-500: oklch(0.6041 0.0733 81.04 / 50%);
  --md-sys-color-secondary-scrim-600: oklch(0.6041 0.0733 81.04 / 60%);
  --md-sys-color-secondary-scrim-700: oklch(0.6041 0.0733 81.04 / 70%);
  --md-sys-color-secondary-scrim-800: oklch(0.6041 0.0733 81.04 / 80%);
  --md-sys-color-secondary-scrim-900: oklch(0.6041 0.0733 81.04 / 90%);
  --md-sys-color-secondary-scrim-950: oklch(0.6041 0.0733 81.04 / 95%);
  /* secondary — semantic roles */
  --md-sys-color-secondary: light-dark(var(--md-sys-color-secondary-550), var(--md-sys-color-secondary-450));
  --md-sys-color-secondary-dim: light-dark(var(--md-sys-color-secondary-650), var(--md-sys-color-secondary-700));
  --md-sys-color-secondary-bright: light-dark(var(--md-sys-color-secondary-350), var(--md-sys-color-secondary-400));
  --md-sys-color-secondary-low: light-dark(var(--md-sys-color-secondary-350), var(--md-sys-color-secondary-700));
  --md-sys-color-secondary-high: light-dark(var(--md-sys-color-secondary-650), var(--md-sys-color-secondary-400));
  --md-sys-color-secondary-hover: light-dark(var(--md-sys-color-secondary-650), var(--md-sys-color-secondary-350));
  --md-sys-color-secondary-active: light-dark(var(--md-sys-color-secondary-750), var(--md-sys-color-secondary-250));
  --md-sys-color-secondary-disabled: light-dark(var(--md-sys-color-secondary-scrim-600), var(--md-sys-color-secondary-scrim-600));
  --md-sys-color-secondary-on-secondary: light-dark(var(--md-sys-color-secondary-050), var(--md-sys-color-secondary-050));
  --md-sys-color-secondary-on-secondary-variant: light-dark(var(--md-sys-color-secondary-200), var(--md-sys-color-secondary-200));
  --md-sys-color-secondary-on-secondary-hover: light-dark(var(--md-sys-color-secondary-050), var(--md-sys-color-secondary-050));
  --md-sys-color-secondary-on-secondary-active: light-dark(var(--md-sys-color-secondary-050), var(--md-sys-color-secondary-050));
  --md-sys-color-secondary-on-secondary-disabled: light-dark(var(--md-sys-color-secondary-scrim-400), var(--md-sys-color-secondary-scrim-400));
  --md-sys-color-secondary-on-surface: light-dark(var(--md-sys-color-secondary-950), var(--md-sys-color-secondary-050));
  --md-sys-color-secondary-on-surface-variant: light-dark(var(--md-sys-color-secondary-750), var(--md-sys-color-secondary-250));
  --md-sys-color-secondary-on-surface-hover: light-dark(var(--md-sys-color-secondary-950), var(--md-sys-color-secondary-050));
  --md-sys-color-secondary-on-surface-active: light-dark(var(--md-sys-color-secondary-950), var(--md-sys-color-secondary-050));
  --md-sys-color-secondary-on-surface-disabled: light-dark(var(--md-sys-color-secondary-scrim-400), var(--md-sys-color-secondary-scrim-400));
  --md-sys-color-secondary-placeholder: light-dark(var(--md-sys-color-secondary-650), var(--md-sys-color-secondary-350));
  --md-sys-color-secondary-outline: light-dark(var(--md-sys-color-secondary-scrim-600), var(--md-sys-color-secondary-scrim-600));
  --md-sys-color-secondary-outline-variant: light-dark(var(--md-sys-color-secondary-scrim-300), var(--md-sys-color-secondary-scrim-300));
  --md-sys-color-secondary-outline-hover: light-dark(var(--md-sys-color-secondary-scrim-700), var(--md-sys-color-secondary-scrim-700));
  --md-sys-color-secondary-outline-active: light-dark(var(--md-sys-color-secondary-scrim-800), var(--md-sys-color-secondary-scrim-800));
  --md-sys-color-secondary-outline-disabled: light-dark(var(--md-sys-color-secondary-scrim-400), var(--md-sys-color-secondary-scrim-400));
  --md-sys-color-secondary-container: light-dark(var(--md-sys-color-secondary-scrim-200), var(--md-sys-color-secondary-scrim-200));
  --md-sys-color-secondary-container-low: light-dark(var(--md-sys-color-secondary-scrim-100), var(--md-sys-color-secondary-scrim-100));
  --md-sys-color-secondary-container-high: light-dark(var(--md-sys-color-secondary-scrim-300), var(--md-sys-color-secondary-scrim-300));
  --md-sys-color-secondary-container-hover: light-dark(var(--md-sys-color-secondary-scrim-300), var(--md-sys-color-secondary-scrim-300));
  --md-sys-color-secondary-container-active: light-dark(var(--md-sys-color-secondary-scrim-400), var(--md-sys-color-secondary-scrim-400));
  --md-sys-color-secondary-container-disabled: light-dark(var(--md-sys-color-secondary-scrim-100), var(--md-sys-color-secondary-scrim-100));
  --md-sys-color-secondary-inverse-surface: light-dark(var(--md-sys-color-secondary-900), var(--md-sys-color-secondary-100));
  --md-sys-color-secondary-inverse-on-surface: light-dark(var(--md-sys-color-secondary-050), var(--md-sys-color-secondary-950));
  --md-sys-color-secondary-background: light-dark(var(--md-sys-color-secondary-100), var(--md-sys-color-secondary-900));
  --md-sys-color-secondary-surface: light-dark(var(--md-sys-color-secondary-125), var(--md-sys-color-secondary-875));
  --md-sys-color-secondary-surface-dimmest: light-dark(var(--md-sys-color-secondary-200), var(--md-sys-color-secondary-950));
  --md-sys-color-secondary-surface-dimmer: light-dark(var(--md-sys-color-secondary-175), var(--md-sys-color-secondary-925));
  --md-sys-color-secondary-surface-dim: light-dark(var(--md-sys-color-secondary-150), var(--md-sys-color-secondary-900));
  --md-sys-color-secondary-surface-bright: light-dark(var(--md-sys-color-secondary-100), var(--md-sys-color-secondary-850));
  --md-sys-color-secondary-surface-brighter: light-dark(var(--md-sys-color-secondary-075), var(--md-sys-color-secondary-825));
  --md-sys-color-secondary-surface-brightest: light-dark(var(--md-sys-color-secondary-050), var(--md-sys-color-secondary-800));
  --md-sys-color-secondary-surface-lowest: light-dark(var(--md-sys-color-secondary-050), var(--md-sys-color-secondary-950));
  --md-sys-color-secondary-surface-lower: light-dark(var(--md-sys-color-secondary-075), var(--md-sys-color-secondary-925));
  --md-sys-color-secondary-surface-low: light-dark(var(--md-sys-color-secondary-100), var(--md-sys-color-secondary-900));
  --md-sys-color-secondary-surface-high: light-dark(var(--md-sys-color-secondary-150), var(--md-sys-color-secondary-850));
  --md-sys-color-secondary-surface-higher: light-dark(var(--md-sys-color-secondary-175), var(--md-sys-color-secondary-825));
  --md-sys-color-secondary-surface-highest: light-dark(var(--md-sys-color-secondary-200), var(--md-sys-color-secondary-800));
  --md-sys-color-secondary-scrim-weakest: light-dark(var(--md-sys-color-secondary-scrim-050), var(--md-sys-color-secondary-scrim-050));
  --md-sys-color-secondary-scrim-weaker: light-dark(var(--md-sys-color-secondary-scrim-100), var(--md-sys-color-secondary-scrim-100));
  --md-sys-color-secondary-scrim-weak: light-dark(var(--md-sys-color-secondary-scrim-200), var(--md-sys-color-secondary-scrim-200));
  --md-sys-color-secondary-scrim: light-dark(var(--md-sys-color-secondary-scrim-300), var(--md-sys-color-secondary-scrim-300));
  --md-sys-color-secondary-scrim-strong: light-dark(var(--md-sys-color-secondary-scrim-400), var(--md-sys-color-secondary-scrim-400));
  --md-sys-color-secondary-scrim-stronger: light-dark(var(--md-sys-color-secondary-scrim-500), var(--md-sys-color-secondary-scrim-500));
  --md-sys-color-secondary-scrim-strongest: light-dark(var(--md-sys-color-secondary-scrim-600), var(--md-sys-color-secondary-scrim-600));
  /* secondary — retained key colors (exact, OKLCH) */
  --md-sys-color-secondary-key-dominant: oklch(0.682 0.092 80);

  /* secondary-muted — flat mode-independent primitives */
  --md-sys-color-secondary-muted-100: oklch(0.9574 0.0011 197.14);
  --md-sys-color-secondary-muted-125: oklch(0.9335 0.0017 247.84);
  --md-sys-color-secondary-muted-150: oklch(0.9118 0.0035 247.86);
  --md-sys-color-secondary-muted-175: oklch(0.8897 0.0043 236.5);
  --md-sys-color-secondary-muted-200: oklch(0.8677 0.006 239.83);
  --md-sys-color-secondary-muted-250: oklch(0.8251 0.0088 225.1);
  --md-sys-color-secondary-muted-300: oklch(0.7802 0.0123 231.71);
  --md-sys-color-secondary-muted-350: oklch(0.7368 0.0161 229.05);
  --md-sys-color-secondary-muted-400: oklch(0.6919 0.0172 233.15);
  --md-sys-color-secondary-muted-450: oklch(0.6477 0.0193 229.17);
  --md-sys-color-secondary-muted-500: oklch(0.6043 0.0196 229.21);
  --md-sys-color-secondary-muted-550: oklch(0.5582 0.018 233.27);
  --md-sys-color-secondary-muted-600: oklch(0.5139 0.0175 235.66);
  --md-sys-color-secondary-muted-650: oklch(0.4691 0.0149 236.91);
  --md-sys-color-secondary-muted-700: oklch(0.4256 0.0122 229.16);
  --md-sys-color-secondary-muted-750: oklch(0.3784 0.0095 229.1);
  --md-sys-color-secondary-muted-800: oklch(0.3328 0.0077 223.65);
  --md-sys-color-secondary-muted-825: oklch(0.31 0.0067 229.04);
  --md-sys-color-secondary-muted-850: oklch(0.2838 0.0047 247.99);
  --md-sys-color-secondary-muted-875: oklch(0.2591 0.0048 248.01);
  --md-sys-color-secondary-muted-900: oklch(0.2333 0.0036 228.96);
  --md-sys-color-secondary-muted-925: oklch(0.2079 0.0016 197.04);
  --md-sys-color-secondary-muted-950: oklch(0.1769 0.0026 247.98);
  --md-sys-color-secondary-muted-050: oklch(1 0 89.88);
  --md-sys-color-secondary-muted-075: oklch(0.9784 0.0011 197.14);
  --md-sys-color-secondary-muted-scrim-050: oklch(0.6043 0.0196 229.21 / 5%);
  --md-sys-color-secondary-muted-scrim-100: oklch(0.6043 0.0196 229.21 / 10%);
  --md-sys-color-secondary-muted-scrim-200: oklch(0.6043 0.0196 229.21 / 20%);
  --md-sys-color-secondary-muted-scrim-300: oklch(0.6043 0.0196 229.21 / 30%);
  --md-sys-color-secondary-muted-scrim-400: oklch(0.6043 0.0196 229.21 / 40%);
  --md-sys-color-secondary-muted-scrim-500: oklch(0.6043 0.0196 229.21 / 50%);
  --md-sys-color-secondary-muted-scrim-600: oklch(0.6043 0.0196 229.21 / 60%);
  --md-sys-color-secondary-muted-scrim-700: oklch(0.6043 0.0196 229.21 / 70%);
  --md-sys-color-secondary-muted-scrim-800: oklch(0.6043 0.0196 229.21 / 80%);
  --md-sys-color-secondary-muted-scrim-900: oklch(0.6043 0.0196 229.21 / 90%);
  --md-sys-color-secondary-muted-scrim-950: oklch(0.6043 0.0196 229.21 / 95%);
  /* secondary-muted — semantic roles */
  --md-sys-color-secondary-muted: light-dark(var(--md-sys-color-secondary-muted-550), var(--md-sys-color-secondary-muted-450));
  --md-sys-color-secondary-muted-dim: light-dark(var(--md-sys-color-secondary-muted-650), var(--md-sys-color-secondary-muted-700));
  --md-sys-color-secondary-muted-bright: light-dark(var(--md-sys-color-secondary-muted-350), var(--md-sys-color-secondary-muted-400));
  --md-sys-color-secondary-muted-low: light-dark(var(--md-sys-color-secondary-muted-350), var(--md-sys-color-secondary-muted-700));
  --md-sys-color-secondary-muted-high: light-dark(var(--md-sys-color-secondary-muted-650), var(--md-sys-color-secondary-muted-400));
  --md-sys-color-secondary-muted-hover: light-dark(var(--md-sys-color-secondary-muted-650), var(--md-sys-color-secondary-muted-350));
  --md-sys-color-secondary-muted-active: light-dark(var(--md-sys-color-secondary-muted-750), var(--md-sys-color-secondary-muted-250));
  --md-sys-color-secondary-muted-disabled: light-dark(var(--md-sys-color-secondary-muted-scrim-600), var(--md-sys-color-secondary-muted-scrim-600));
  --md-sys-color-secondary-muted-on-secondary-muted: light-dark(var(--md-sys-color-secondary-muted-050), var(--md-sys-color-secondary-muted-050));
  --md-sys-color-secondary-muted-on-secondary-muted-variant: light-dark(var(--md-sys-color-secondary-muted-200), var(--md-sys-color-secondary-muted-200));
  --md-sys-color-secondary-muted-on-secondary-muted-hover: light-dark(var(--md-sys-color-secondary-muted-050), var(--md-sys-color-secondary-muted-050));
  --md-sys-color-secondary-muted-on-secondary-muted-active: light-dark(var(--md-sys-color-secondary-muted-050), var(--md-sys-color-secondary-muted-050));
  --md-sys-color-secondary-muted-on-secondary-muted-disabled: light-dark(var(--md-sys-color-secondary-muted-scrim-400), var(--md-sys-color-secondary-muted-scrim-400));
  --md-sys-color-secondary-muted-on-surface: light-dark(var(--md-sys-color-secondary-muted-950), var(--md-sys-color-secondary-muted-050));
  --md-sys-color-secondary-muted-on-surface-variant: light-dark(var(--md-sys-color-secondary-muted-750), var(--md-sys-color-secondary-muted-250));
  --md-sys-color-secondary-muted-on-surface-hover: light-dark(var(--md-sys-color-secondary-muted-950), var(--md-sys-color-secondary-muted-050));
  --md-sys-color-secondary-muted-on-surface-active: light-dark(var(--md-sys-color-secondary-muted-950), var(--md-sys-color-secondary-muted-050));
  --md-sys-color-secondary-muted-on-surface-disabled: light-dark(var(--md-sys-color-secondary-muted-scrim-400), var(--md-sys-color-secondary-muted-scrim-400));
  --md-sys-color-secondary-muted-placeholder: light-dark(var(--md-sys-color-secondary-muted-650), var(--md-sys-color-secondary-muted-350));
  --md-sys-color-secondary-muted-outline: light-dark(var(--md-sys-color-secondary-muted-scrim-600), var(--md-sys-color-secondary-muted-scrim-600));
  --md-sys-color-secondary-muted-outline-variant: light-dark(var(--md-sys-color-secondary-muted-scrim-300), var(--md-sys-color-secondary-muted-scrim-300));
  --md-sys-color-secondary-muted-outline-hover: light-dark(var(--md-sys-color-secondary-muted-scrim-700), var(--md-sys-color-secondary-muted-scrim-700));
  --md-sys-color-secondary-muted-outline-active: light-dark(var(--md-sys-color-secondary-muted-scrim-800), var(--md-sys-color-secondary-muted-scrim-800));
  --md-sys-color-secondary-muted-outline-disabled: light-dark(var(--md-sys-color-secondary-muted-scrim-400), var(--md-sys-color-secondary-muted-scrim-400));
  --md-sys-color-secondary-muted-container: light-dark(var(--md-sys-color-secondary-muted-scrim-200), var(--md-sys-color-secondary-muted-scrim-200));
  --md-sys-color-secondary-muted-container-low: light-dark(var(--md-sys-color-secondary-muted-scrim-100), var(--md-sys-color-secondary-muted-scrim-100));
  --md-sys-color-secondary-muted-container-high: light-dark(var(--md-sys-color-secondary-muted-scrim-300), var(--md-sys-color-secondary-muted-scrim-300));
  --md-sys-color-secondary-muted-container-hover: light-dark(var(--md-sys-color-secondary-muted-scrim-300), var(--md-sys-color-secondary-muted-scrim-300));
  --md-sys-color-secondary-muted-container-active: light-dark(var(--md-sys-color-secondary-muted-scrim-400), var(--md-sys-color-secondary-muted-scrim-400));
  --md-sys-color-secondary-muted-container-disabled: light-dark(var(--md-sys-color-secondary-muted-scrim-100), var(--md-sys-color-secondary-muted-scrim-100));
  --md-sys-color-secondary-muted-inverse-surface: light-dark(var(--md-sys-color-secondary-muted-900), var(--md-sys-color-secondary-muted-100));
  --md-sys-color-secondary-muted-inverse-on-surface: light-dark(var(--md-sys-color-secondary-muted-050), var(--md-sys-color-secondary-muted-950));
  --md-sys-color-secondary-muted-background: light-dark(var(--md-sys-color-secondary-muted-100), var(--md-sys-color-secondary-muted-900));
  --md-sys-color-secondary-muted-surface: light-dark(var(--md-sys-color-secondary-muted-125), var(--md-sys-color-secondary-muted-875));
  --md-sys-color-secondary-muted-surface-dimmest: light-dark(var(--md-sys-color-secondary-muted-200), var(--md-sys-color-secondary-muted-950));
  --md-sys-color-secondary-muted-surface-dimmer: light-dark(var(--md-sys-color-secondary-muted-175), var(--md-sys-color-secondary-muted-925));
  --md-sys-color-secondary-muted-surface-dim: light-dark(var(--md-sys-color-secondary-muted-150), var(--md-sys-color-secondary-muted-900));
  --md-sys-color-secondary-muted-surface-bright: light-dark(var(--md-sys-color-secondary-muted-100), var(--md-sys-color-secondary-muted-850));
  --md-sys-color-secondary-muted-surface-brighter: light-dark(var(--md-sys-color-secondary-muted-075), var(--md-sys-color-secondary-muted-825));
  --md-sys-color-secondary-muted-surface-brightest: light-dark(var(--md-sys-color-secondary-muted-050), var(--md-sys-color-secondary-muted-800));
  --md-sys-color-secondary-muted-surface-lowest: light-dark(var(--md-sys-color-secondary-muted-050), var(--md-sys-color-secondary-muted-950));
  --md-sys-color-secondary-muted-surface-lower: light-dark(var(--md-sys-color-secondary-muted-075), var(--md-sys-color-secondary-muted-925));
  --md-sys-color-secondary-muted-surface-low: light-dark(var(--md-sys-color-secondary-muted-100), var(--md-sys-color-secondary-muted-900));
  --md-sys-color-secondary-muted-surface-high: light-dark(var(--md-sys-color-secondary-muted-150), var(--md-sys-color-secondary-muted-850));
  --md-sys-color-secondary-muted-surface-higher: light-dark(var(--md-sys-color-secondary-muted-175), var(--md-sys-color-secondary-muted-825));
  --md-sys-color-secondary-muted-surface-highest: light-dark(var(--md-sys-color-secondary-muted-200), var(--md-sys-color-secondary-muted-800));
  --md-sys-color-secondary-muted-scrim-weakest: light-dark(var(--md-sys-color-secondary-muted-scrim-050), var(--md-sys-color-secondary-muted-scrim-050));
  --md-sys-color-secondary-muted-scrim-weaker: light-dark(var(--md-sys-color-secondary-muted-scrim-100), var(--md-sys-color-secondary-muted-scrim-100));
  --md-sys-color-secondary-muted-scrim-weak: light-dark(var(--md-sys-color-secondary-muted-scrim-200), var(--md-sys-color-secondary-muted-scrim-200));
  --md-sys-color-secondary-muted-scrim: light-dark(var(--md-sys-color-secondary-muted-scrim-300), var(--md-sys-color-secondary-muted-scrim-300));
  --md-sys-color-secondary-muted-scrim-strong: light-dark(var(--md-sys-color-secondary-muted-scrim-400), var(--md-sys-color-secondary-muted-scrim-400));
  --md-sys-color-secondary-muted-scrim-stronger: light-dark(var(--md-sys-color-secondary-muted-scrim-500), var(--md-sys-color-secondary-muted-scrim-500));
  --md-sys-color-secondary-muted-scrim-strongest: light-dark(var(--md-sys-color-secondary-muted-scrim-600), var(--md-sys-color-secondary-muted-scrim-600));
  /* secondary-muted — retained key colors (exact, OKLCH) */
  --md-sys-color-secondary-muted-key-dominant: oklch(0.602 0.01 230);

  /* accent — flat mode-independent primitives */
  --md-sys-color-accent-100: oklch(0.9558 0.0045 78.3);
  --md-sys-color-accent-125: oklch(0.9347 0.0087 84.57);
  --md-sys-color-accent-150: oklch(0.9122 0.0126 75.36);
  --md-sys-color-accent-175: oklch(0.8914 0.0184 78.23);
  --md-sys-color-accent-200: oklch(0.8686 0.0237 75.84);
  --md-sys-color-accent-250: oklch(0.8241 0.0373 78.08);
  --md-sys-color-accent-300: oklch(0.7798 0.0486 77.52);
  --md-sys-color-accent-350: oklch(0.7369 0.0577 78.4);
  --md-sys-color-accent-400: oklch(0.6911 0.0624 76.55);
  --md-sys-color-accent-450: oklch(0.6481 0.0663 78.21);
  --md-sys-color-accent-500: oklch(0.6021 0.0649 76.84);
  --md-sys-color-accent-550: oklch(0.5591 0.0605 77.85);
  --md-sys-color-accent-600: oklch(0.5154 0.0549 78.37);
  --md-sys-color-accent-650: oklch(0.471 0.0479 78.22);
  --md-sys-color-accent-700: oklch(0.4257 0.0395 76.9);
  --md-sys-color-accent-750: oklch(0.379 0.0319 76.16);
  --md-sys-color-accent-800: oklch(0.3334 0.0245 79.75);
  --md-sys-color-accent-825: oklch(0.3092 0.0213 78.99);
  --md-sys-color-accent-850: oklch(0.2845 0.0181 77.9);
  --md-sys-color-accent-875: oklch(0.2593 0.0147 76.24);
  --md-sys-color-accent-900: oklch(0.2335 0.0112 73.38);
  --md-sys-color-accent-925: oklch(0.207 0.0075 67.39);
  --md-sys-color-accent-950: oklch(0.178 0.0043 84.59);
  --md-sys-color-accent-050: oklch(1 0 89.88);
  --md-sys-color-accent-075: oklch(0.9786 0.0026 106.45);
  --md-sys-color-accent-scrim-050: oklch(0.6021 0.0649 76.84 / 5%);
  --md-sys-color-accent-scrim-100: oklch(0.6021 0.0649 76.84 / 10%);
  --md-sys-color-accent-scrim-200: oklch(0.6021 0.0649 76.84 / 20%);
  --md-sys-color-accent-scrim-300: oklch(0.6021 0.0649 76.84 / 30%);
  --md-sys-color-accent-scrim-400: oklch(0.6021 0.0649 76.84 / 40%);
  --md-sys-color-accent-scrim-500: oklch(0.6021 0.0649 76.84 / 50%);
  --md-sys-color-accent-scrim-600: oklch(0.6021 0.0649 76.84 / 60%);
  --md-sys-color-accent-scrim-700: oklch(0.6021 0.0649 76.84 / 70%);
  --md-sys-color-accent-scrim-800: oklch(0.6021 0.0649 76.84 / 80%);
  --md-sys-color-accent-scrim-900: oklch(0.6021 0.0649 76.84 / 90%);
  --md-sys-color-accent-scrim-950: oklch(0.6021 0.0649 76.84 / 95%);
  /* accent — semantic roles */
  --md-sys-color-accent: light-dark(var(--md-sys-color-accent-550), var(--md-sys-color-accent-450));
  --md-sys-color-accent-dim: light-dark(var(--md-sys-color-accent-650), var(--md-sys-color-accent-700));
  --md-sys-color-accent-bright: light-dark(var(--md-sys-color-accent-350), var(--md-sys-color-accent-400));
  --md-sys-color-accent-low: light-dark(var(--md-sys-color-accent-350), var(--md-sys-color-accent-700));
  --md-sys-color-accent-high: light-dark(var(--md-sys-color-accent-650), var(--md-sys-color-accent-400));
  --md-sys-color-accent-hover: light-dark(var(--md-sys-color-accent-650), var(--md-sys-color-accent-350));
  --md-sys-color-accent-active: light-dark(var(--md-sys-color-accent-750), var(--md-sys-color-accent-250));
  --md-sys-color-accent-disabled: light-dark(var(--md-sys-color-accent-scrim-600), var(--md-sys-color-accent-scrim-600));
  --md-sys-color-accent-on-accent: light-dark(var(--md-sys-color-accent-050), var(--md-sys-color-accent-050));
  --md-sys-color-accent-on-accent-variant: light-dark(var(--md-sys-color-accent-200), var(--md-sys-color-accent-200));
  --md-sys-color-accent-on-accent-hover: light-dark(var(--md-sys-color-accent-050), var(--md-sys-color-accent-050));
  --md-sys-color-accent-on-accent-active: light-dark(var(--md-sys-color-accent-050), var(--md-sys-color-accent-050));
  --md-sys-color-accent-on-accent-disabled: light-dark(var(--md-sys-color-accent-scrim-400), var(--md-sys-color-accent-scrim-400));
  --md-sys-color-accent-on-surface: light-dark(var(--md-sys-color-accent-950), var(--md-sys-color-accent-050));
  --md-sys-color-accent-on-surface-variant: light-dark(var(--md-sys-color-accent-750), var(--md-sys-color-accent-250));
  --md-sys-color-accent-on-surface-hover: light-dark(var(--md-sys-color-accent-950), var(--md-sys-color-accent-050));
  --md-sys-color-accent-on-surface-active: light-dark(var(--md-sys-color-accent-950), var(--md-sys-color-accent-050));
  --md-sys-color-accent-on-surface-disabled: light-dark(var(--md-sys-color-accent-scrim-400), var(--md-sys-color-accent-scrim-400));
  --md-sys-color-accent-placeholder: light-dark(var(--md-sys-color-accent-650), var(--md-sys-color-accent-350));
  --md-sys-color-accent-outline: light-dark(var(--md-sys-color-accent-scrim-600), var(--md-sys-color-accent-scrim-600));
  --md-sys-color-accent-outline-variant: light-dark(var(--md-sys-color-accent-scrim-300), var(--md-sys-color-accent-scrim-300));
  --md-sys-color-accent-outline-hover: light-dark(var(--md-sys-color-accent-scrim-700), var(--md-sys-color-accent-scrim-700));
  --md-sys-color-accent-outline-active: light-dark(var(--md-sys-color-accent-scrim-800), var(--md-sys-color-accent-scrim-800));
  --md-sys-color-accent-outline-disabled: light-dark(var(--md-sys-color-accent-scrim-400), var(--md-sys-color-accent-scrim-400));
  --md-sys-color-accent-container: light-dark(var(--md-sys-color-accent-scrim-200), var(--md-sys-color-accent-scrim-200));
  --md-sys-color-accent-container-low: light-dark(var(--md-sys-color-accent-scrim-100), var(--md-sys-color-accent-scrim-100));
  --md-sys-color-accent-container-high: light-dark(var(--md-sys-color-accent-scrim-300), var(--md-sys-color-accent-scrim-300));
  --md-sys-color-accent-container-hover: light-dark(var(--md-sys-color-accent-scrim-300), var(--md-sys-color-accent-scrim-300));
  --md-sys-color-accent-container-active: light-dark(var(--md-sys-color-accent-scrim-400), var(--md-sys-color-accent-scrim-400));
  --md-sys-color-accent-container-disabled: light-dark(var(--md-sys-color-accent-scrim-100), var(--md-sys-color-accent-scrim-100));
  --md-sys-color-accent-inverse-surface: light-dark(var(--md-sys-color-accent-900), var(--md-sys-color-accent-100));
  --md-sys-color-accent-inverse-on-surface: light-dark(var(--md-sys-color-accent-050), var(--md-sys-color-accent-950));
  --md-sys-color-accent-background: light-dark(var(--md-sys-color-accent-100), var(--md-sys-color-accent-900));
  --md-sys-color-accent-surface: light-dark(var(--md-sys-color-accent-125), var(--md-sys-color-accent-875));
  --md-sys-color-accent-surface-dimmest: light-dark(var(--md-sys-color-accent-200), var(--md-sys-color-accent-950));
  --md-sys-color-accent-surface-dimmer: light-dark(var(--md-sys-color-accent-175), var(--md-sys-color-accent-925));
  --md-sys-color-accent-surface-dim: light-dark(var(--md-sys-color-accent-150), var(--md-sys-color-accent-900));
  --md-sys-color-accent-surface-bright: light-dark(var(--md-sys-color-accent-100), var(--md-sys-color-accent-850));
  --md-sys-color-accent-surface-brighter: light-dark(var(--md-sys-color-accent-075), var(--md-sys-color-accent-825));
  --md-sys-color-accent-surface-brightest: light-dark(var(--md-sys-color-accent-050), var(--md-sys-color-accent-800));
  --md-sys-color-accent-surface-lowest: light-dark(var(--md-sys-color-accent-050), var(--md-sys-color-accent-950));
  --md-sys-color-accent-surface-lower: light-dark(var(--md-sys-color-accent-075), var(--md-sys-color-accent-925));
  --md-sys-color-accent-surface-low: light-dark(var(--md-sys-color-accent-100), var(--md-sys-color-accent-900));
  --md-sys-color-accent-surface-high: light-dark(var(--md-sys-color-accent-150), var(--md-sys-color-accent-850));
  --md-sys-color-accent-surface-higher: light-dark(var(--md-sys-color-accent-175), var(--md-sys-color-accent-825));
  --md-sys-color-accent-surface-highest: light-dark(var(--md-sys-color-accent-200), var(--md-sys-color-accent-800));
  --md-sys-color-accent-scrim-weakest: light-dark(var(--md-sys-color-accent-scrim-050), var(--md-sys-color-accent-scrim-050));
  --md-sys-color-accent-scrim-weaker: light-dark(var(--md-sys-color-accent-scrim-100), var(--md-sys-color-accent-scrim-100));
  --md-sys-color-accent-scrim-weak: light-dark(var(--md-sys-color-accent-scrim-200), var(--md-sys-color-accent-scrim-200));
  --md-sys-color-accent-scrim: light-dark(var(--md-sys-color-accent-scrim-300), var(--md-sys-color-accent-scrim-300));
  --md-sys-color-accent-scrim-strong: light-dark(var(--md-sys-color-accent-scrim-400), var(--md-sys-color-accent-scrim-400));
  --md-sys-color-accent-scrim-stronger: light-dark(var(--md-sys-color-accent-scrim-500), var(--md-sys-color-accent-scrim-500));
  --md-sys-color-accent-scrim-strongest: light-dark(var(--md-sys-color-accent-scrim-600), var(--md-sys-color-accent-scrim-600));
  /* accent — retained key colors (exact, OKLCH) */
  --md-sys-color-accent-key-dominant: oklch(0.702 0.082 76);

  /* accent-muted — flat mode-independent primitives */
  --md-sys-color-accent-muted-100: oklch(0.9561 0.0034 67.78);
  --md-sys-color-accent-muted-125: oklch(0.9335 0.0051 48.68);
  --md-sys-color-accent-muted-150: oklch(0.9133 0.0085 56.31);
  --md-sys-color-accent-muted-175: oklch(0.89 0.012 59.55);
  --md-sys-color-accent-muted-200: oklch(0.8676 0.0156 54.9);
  --md-sys-color-accent-muted-250: oklch(0.8243 0.0237 56.89);
  --md-sys-color-accent-muted-300: oklch(0.7814 0.0329 56.48);
  --md-sys-color-accent-muted-350: oklch(0.7367 0.0398 56.73);
  --md-sys-color-accent-muted-400: oklch(0.6918 0.046 55.51);
  --md-sys-color-accent-muted-450: oklch(0.6478 0.0496 54.93);
  --md-sys-color-accent-muted-500: oklch(0.6034 0.0503 56.95);
  --md-sys-color-accent-muted-550: oklch(0.5578 0.0475 56.14);
  --md-sys-color-accent-muted-600: oklch(0.5139 0.0426 54.73);
  --md-sys-color-accent-muted-650: oklch(0.4701 0.0364 57.23);
  --md-sys-color-accent-muted-700: oklch(0.4242 0.0312 55.4);
  --md-sys-color-accent-muted-750: oklch(0.3796 0.0246 54.54);
  --md-sys-color-accent-muted-800: oklch(0.3335 0.0187 57.01);
  --md-sys-color-accent-muted-825: oklch(0.3079 0.0157 59.01);
  --md-sys-color-accent-muted-850: oklch(0.2832 0.0127 51.66);
  --md-sys-color-accent-muted-875: oklch(0.2603 0.0105 61);
  --md-sys-color-accent-muted-900: oklch(0.2342 0.0084 59.24);
  --md-sys-color-accent-muted-925: oklch(0.2074 0.0062 56.02);
  --md-sys-color-accent-muted-950: oklch(0.178 0.0043 84.59);
  --md-sys-color-accent-muted-050: oklch(1 0 89.88);
  --md-sys-color-accent-muted-075: oklch(0.9769 0.0011 17.18);
  --md-sys-color-accent-muted-scrim-050: oklch(0.6034 0.0503 56.95 / 5%);
  --md-sys-color-accent-muted-scrim-100: oklch(0.6034 0.0503 56.95 / 10%);
  --md-sys-color-accent-muted-scrim-200: oklch(0.6034 0.0503 56.95 / 20%);
  --md-sys-color-accent-muted-scrim-300: oklch(0.6034 0.0503 56.95 / 30%);
  --md-sys-color-accent-muted-scrim-400: oklch(0.6034 0.0503 56.95 / 40%);
  --md-sys-color-accent-muted-scrim-500: oklch(0.6034 0.0503 56.95 / 50%);
  --md-sys-color-accent-muted-scrim-600: oklch(0.6034 0.0503 56.95 / 60%);
  --md-sys-color-accent-muted-scrim-700: oklch(0.6034 0.0503 56.95 / 70%);
  --md-sys-color-accent-muted-scrim-800: oklch(0.6034 0.0503 56.95 / 80%);
  --md-sys-color-accent-muted-scrim-900: oklch(0.6034 0.0503 56.95 / 90%);
  --md-sys-color-accent-muted-scrim-950: oklch(0.6034 0.0503 56.95 / 95%);
  /* accent-muted — semantic roles */
  --md-sys-color-accent-muted: light-dark(var(--md-sys-color-accent-muted-550), var(--md-sys-color-accent-muted-450));
  --md-sys-color-accent-muted-dim: light-dark(var(--md-sys-color-accent-muted-650), var(--md-sys-color-accent-muted-700));
  --md-sys-color-accent-muted-bright: light-dark(var(--md-sys-color-accent-muted-350), var(--md-sys-color-accent-muted-400));
  --md-sys-color-accent-muted-low: light-dark(var(--md-sys-color-accent-muted-350), var(--md-sys-color-accent-muted-700));
  --md-sys-color-accent-muted-high: light-dark(var(--md-sys-color-accent-muted-650), var(--md-sys-color-accent-muted-400));
  --md-sys-color-accent-muted-hover: light-dark(var(--md-sys-color-accent-muted-650), var(--md-sys-color-accent-muted-350));
  --md-sys-color-accent-muted-active: light-dark(var(--md-sys-color-accent-muted-750), var(--md-sys-color-accent-muted-250));
  --md-sys-color-accent-muted-disabled: light-dark(var(--md-sys-color-accent-muted-scrim-600), var(--md-sys-color-accent-muted-scrim-600));
  --md-sys-color-accent-muted-on-accent-muted: light-dark(var(--md-sys-color-accent-muted-050), var(--md-sys-color-accent-muted-050));
  --md-sys-color-accent-muted-on-accent-muted-variant: light-dark(var(--md-sys-color-accent-muted-200), var(--md-sys-color-accent-muted-200));
  --md-sys-color-accent-muted-on-accent-muted-hover: light-dark(var(--md-sys-color-accent-muted-050), var(--md-sys-color-accent-muted-050));
  --md-sys-color-accent-muted-on-accent-muted-active: light-dark(var(--md-sys-color-accent-muted-050), var(--md-sys-color-accent-muted-050));
  --md-sys-color-accent-muted-on-accent-muted-disabled: light-dark(var(--md-sys-color-accent-muted-scrim-400), var(--md-sys-color-accent-muted-scrim-400));
  --md-sys-color-accent-muted-on-surface: light-dark(var(--md-sys-color-accent-muted-950), var(--md-sys-color-accent-muted-050));
  --md-sys-color-accent-muted-on-surface-variant: light-dark(var(--md-sys-color-accent-muted-750), var(--md-sys-color-accent-muted-250));
  --md-sys-color-accent-muted-on-surface-hover: light-dark(var(--md-sys-color-accent-muted-950), var(--md-sys-color-accent-muted-050));
  --md-sys-color-accent-muted-on-surface-active: light-dark(var(--md-sys-color-accent-muted-950), var(--md-sys-color-accent-muted-050));
  --md-sys-color-accent-muted-on-surface-disabled: light-dark(var(--md-sys-color-accent-muted-scrim-400), var(--md-sys-color-accent-muted-scrim-400));
  --md-sys-color-accent-muted-placeholder: light-dark(var(--md-sys-color-accent-muted-650), var(--md-sys-color-accent-muted-350));
  --md-sys-color-accent-muted-outline: light-dark(var(--md-sys-color-accent-muted-scrim-600), var(--md-sys-color-accent-muted-scrim-600));
  --md-sys-color-accent-muted-outline-variant: light-dark(var(--md-sys-color-accent-muted-scrim-300), var(--md-sys-color-accent-muted-scrim-300));
  --md-sys-color-accent-muted-outline-hover: light-dark(var(--md-sys-color-accent-muted-scrim-700), var(--md-sys-color-accent-muted-scrim-700));
  --md-sys-color-accent-muted-outline-active: light-dark(var(--md-sys-color-accent-muted-scrim-800), var(--md-sys-color-accent-muted-scrim-800));
  --md-sys-color-accent-muted-outline-disabled: light-dark(var(--md-sys-color-accent-muted-scrim-400), var(--md-sys-color-accent-muted-scrim-400));
  --md-sys-color-accent-muted-container: light-dark(var(--md-sys-color-accent-muted-scrim-200), var(--md-sys-color-accent-muted-scrim-200));
  --md-sys-color-accent-muted-container-low: light-dark(var(--md-sys-color-accent-muted-scrim-100), var(--md-sys-color-accent-muted-scrim-100));
  --md-sys-color-accent-muted-container-high: light-dark(var(--md-sys-color-accent-muted-scrim-300), var(--md-sys-color-accent-muted-scrim-300));
  --md-sys-color-accent-muted-container-hover: light-dark(var(--md-sys-color-accent-muted-scrim-300), var(--md-sys-color-accent-muted-scrim-300));
  --md-sys-color-accent-muted-container-active: light-dark(var(--md-sys-color-accent-muted-scrim-400), var(--md-sys-color-accent-muted-scrim-400));
  --md-sys-color-accent-muted-container-disabled: light-dark(var(--md-sys-color-accent-muted-scrim-100), var(--md-sys-color-accent-muted-scrim-100));
  --md-sys-color-accent-muted-inverse-surface: light-dark(var(--md-sys-color-accent-muted-900), var(--md-sys-color-accent-muted-100));
  --md-sys-color-accent-muted-inverse-on-surface: light-dark(var(--md-sys-color-accent-muted-050), var(--md-sys-color-accent-muted-950));
  --md-sys-color-accent-muted-background: light-dark(var(--md-sys-color-accent-muted-100), var(--md-sys-color-accent-muted-900));
  --md-sys-color-accent-muted-surface: light-dark(var(--md-sys-color-accent-muted-125), var(--md-sys-color-accent-muted-875));
  --md-sys-color-accent-muted-surface-dimmest: light-dark(var(--md-sys-color-accent-muted-200), var(--md-sys-color-accent-muted-950));
  --md-sys-color-accent-muted-surface-dimmer: light-dark(var(--md-sys-color-accent-muted-175), var(--md-sys-color-accent-muted-925));
  --md-sys-color-accent-muted-surface-dim: light-dark(var(--md-sys-color-accent-muted-150), var(--md-sys-color-accent-muted-900));
  --md-sys-color-accent-muted-surface-bright: light-dark(var(--md-sys-color-accent-muted-100), var(--md-sys-color-accent-muted-850));
  --md-sys-color-accent-muted-surface-brighter: light-dark(var(--md-sys-color-accent-muted-075), var(--md-sys-color-accent-muted-825));
  --md-sys-color-accent-muted-surface-brightest: light-dark(var(--md-sys-color-accent-muted-050), var(--md-sys-color-accent-muted-800));
  --md-sys-color-accent-muted-surface-lowest: light-dark(var(--md-sys-color-accent-muted-050), var(--md-sys-color-accent-muted-950));
  --md-sys-color-accent-muted-surface-lower: light-dark(var(--md-sys-color-accent-muted-075), var(--md-sys-color-accent-muted-925));
  --md-sys-color-accent-muted-surface-low: light-dark(var(--md-sys-color-accent-muted-100), var(--md-sys-color-accent-muted-900));
  --md-sys-color-accent-muted-surface-high: light-dark(var(--md-sys-color-accent-muted-150), var(--md-sys-color-accent-muted-850));
  --md-sys-color-accent-muted-surface-higher: light-dark(var(--md-sys-color-accent-muted-175), var(--md-sys-color-accent-muted-825));
  --md-sys-color-accent-muted-surface-highest: light-dark(var(--md-sys-color-accent-muted-200), var(--md-sys-color-accent-muted-800));
  --md-sys-color-accent-muted-scrim-weakest: light-dark(var(--md-sys-color-accent-muted-scrim-050), var(--md-sys-color-accent-muted-scrim-050));
  --md-sys-color-accent-muted-scrim-weaker: light-dark(var(--md-sys-color-accent-muted-scrim-100), var(--md-sys-color-accent-muted-scrim-100));
  --md-sys-color-accent-muted-scrim-weak: light-dark(var(--md-sys-color-accent-muted-scrim-200), var(--md-sys-color-accent-muted-scrim-200));
  --md-sys-color-accent-muted-scrim: light-dark(var(--md-sys-color-accent-muted-scrim-300), var(--md-sys-color-accent-muted-scrim-300));
  --md-sys-color-accent-muted-scrim-strong: light-dark(var(--md-sys-color-accent-muted-scrim-400), var(--md-sys-color-accent-muted-scrim-400));
  --md-sys-color-accent-muted-scrim-stronger: light-dark(var(--md-sys-color-accent-muted-scrim-500), var(--md-sys-color-accent-muted-scrim-500));
  --md-sys-color-accent-muted-scrim-strongest: light-dark(var(--md-sys-color-accent-muted-scrim-600), var(--md-sys-color-accent-muted-scrim-600));
  /* accent-muted — retained key colors (exact, OKLCH) */
  --md-sys-color-accent-muted-key-dominant: oklch(0.452 0.052 56);

  /* info — flat mode-independent primitives */
  --md-sys-color-info-100: oklch(0.9565 0.008 253.85);
  --md-sys-color-info-125: oklch(0.9348 0.0126 255.51);
  --md-sys-color-info-150: oklch(0.9118 0.0196 252.89);
  --md-sys-color-info-175: oklch(0.8898 0.0273 255.1);
  --md-sys-color-info-200: oklch(0.8671 0.0357 254.88);
  --md-sys-color-info-250: oklch(0.8244 0.0545 254.5);
  --md-sys-color-info-300: oklch(0.7797 0.0763 255.42);
  --md-sys-color-info-350: oklch(0.7373 0.0981 254.62);
  --md-sys-color-info-400: oklch(0.6906 0.1192 255.04);
  --md-sys-color-info-450: oklch(0.6472 0.1357 255.05);
  --md-sys-color-info-500: oklch(0.6028 0.1427 254.94);
  --md-sys-color-info-550: oklch(0.5596 0.1362 255.02);
  --md-sys-color-info-600: oklch(0.5139 0.1215 254.85);
  --md-sys-color-info-650: oklch(0.4704 0.1044 254.64);
  --md-sys-color-info-700: oklch(0.4238 0.0876 255.37);
  --md-sys-color-info-750: oklch(0.3787 0.0688 255.47);
  --md-sys-color-info-800: oklch(0.3321 0.0515 254.55);
  --md-sys-color-info-825: oklch(0.3093 0.0437 255.53);
  --md-sys-color-info-850: oklch(0.2854 0.0362 255.4);
  --md-sys-color-info-875: oklch(0.2612 0.0284 255.21);
  --md-sys-color-info-900: oklch(0.2328 0.022 257.28);
  --md-sys-color-info-925: oklch(0.2072 0.0159 256.82);
  --md-sys-color-info-950: oklch(0.1767 0.0114 260.64);
  --md-sys-color-info-050: oklch(1 0 89.88);
  --md-sys-color-info-075: oklch(0.9782 0.0034 247.86);
  --md-sys-color-info-scrim-050: oklch(0.6028 0.1427 254.94 / 5%);
  --md-sys-color-info-scrim-100: oklch(0.6028 0.1427 254.94 / 10%);
  --md-sys-color-info-scrim-200: oklch(0.6028 0.1427 254.94 / 20%);
  --md-sys-color-info-scrim-300: oklch(0.6028 0.1427 254.94 / 30%);
  --md-sys-color-info-scrim-400: oklch(0.6028 0.1427 254.94 / 40%);
  --md-sys-color-info-scrim-500: oklch(0.6028 0.1427 254.94 / 50%);
  --md-sys-color-info-scrim-600: oklch(0.6028 0.1427 254.94 / 60%);
  --md-sys-color-info-scrim-700: oklch(0.6028 0.1427 254.94 / 70%);
  --md-sys-color-info-scrim-800: oklch(0.6028 0.1427 254.94 / 80%);
  --md-sys-color-info-scrim-900: oklch(0.6028 0.1427 254.94 / 90%);
  --md-sys-color-info-scrim-950: oklch(0.6028 0.1427 254.94 / 95%);
  /* info — semantic roles */
  --md-sys-color-info: light-dark(var(--md-sys-color-info-550), var(--md-sys-color-info-450));
  --md-sys-color-info-dim: light-dark(var(--md-sys-color-info-650), var(--md-sys-color-info-700));
  --md-sys-color-info-bright: light-dark(var(--md-sys-color-info-350), var(--md-sys-color-info-400));
  --md-sys-color-info-low: light-dark(var(--md-sys-color-info-350), var(--md-sys-color-info-700));
  --md-sys-color-info-high: light-dark(var(--md-sys-color-info-650), var(--md-sys-color-info-400));
  --md-sys-color-info-hover: light-dark(var(--md-sys-color-info-650), var(--md-sys-color-info-350));
  --md-sys-color-info-active: light-dark(var(--md-sys-color-info-750), var(--md-sys-color-info-250));
  --md-sys-color-info-disabled: light-dark(var(--md-sys-color-info-scrim-600), var(--md-sys-color-info-scrim-600));
  --md-sys-color-info-on-info: light-dark(var(--md-sys-color-info-050), var(--md-sys-color-info-050));
  --md-sys-color-info-on-info-variant: light-dark(var(--md-sys-color-info-200), var(--md-sys-color-info-200));
  --md-sys-color-info-on-info-hover: light-dark(var(--md-sys-color-info-050), var(--md-sys-color-info-050));
  --md-sys-color-info-on-info-active: light-dark(var(--md-sys-color-info-050), var(--md-sys-color-info-050));
  --md-sys-color-info-on-info-disabled: light-dark(var(--md-sys-color-info-scrim-400), var(--md-sys-color-info-scrim-400));
  --md-sys-color-info-on-surface: light-dark(var(--md-sys-color-info-950), var(--md-sys-color-info-050));
  --md-sys-color-info-on-surface-variant: light-dark(var(--md-sys-color-info-750), var(--md-sys-color-info-250));
  --md-sys-color-info-on-surface-hover: light-dark(var(--md-sys-color-info-950), var(--md-sys-color-info-050));
  --md-sys-color-info-on-surface-active: light-dark(var(--md-sys-color-info-950), var(--md-sys-color-info-050));
  --md-sys-color-info-on-surface-disabled: light-dark(var(--md-sys-color-info-scrim-400), var(--md-sys-color-info-scrim-400));
  --md-sys-color-info-placeholder: light-dark(var(--md-sys-color-info-650), var(--md-sys-color-info-350));
  --md-sys-color-info-outline: light-dark(var(--md-sys-color-info-scrim-600), var(--md-sys-color-info-scrim-600));
  --md-sys-color-info-outline-variant: light-dark(var(--md-sys-color-info-scrim-300), var(--md-sys-color-info-scrim-300));
  --md-sys-color-info-outline-hover: light-dark(var(--md-sys-color-info-scrim-700), var(--md-sys-color-info-scrim-700));
  --md-sys-color-info-outline-active: light-dark(var(--md-sys-color-info-scrim-800), var(--md-sys-color-info-scrim-800));
  --md-sys-color-info-outline-disabled: light-dark(var(--md-sys-color-info-scrim-400), var(--md-sys-color-info-scrim-400));
  --md-sys-color-info-container: light-dark(var(--md-sys-color-info-scrim-200), var(--md-sys-color-info-scrim-200));
  --md-sys-color-info-container-low: light-dark(var(--md-sys-color-info-scrim-100), var(--md-sys-color-info-scrim-100));
  --md-sys-color-info-container-high: light-dark(var(--md-sys-color-info-scrim-300), var(--md-sys-color-info-scrim-300));
  --md-sys-color-info-container-hover: light-dark(var(--md-sys-color-info-scrim-300), var(--md-sys-color-info-scrim-300));
  --md-sys-color-info-container-active: light-dark(var(--md-sys-color-info-scrim-400), var(--md-sys-color-info-scrim-400));
  --md-sys-color-info-container-disabled: light-dark(var(--md-sys-color-info-scrim-100), var(--md-sys-color-info-scrim-100));
  --md-sys-color-info-inverse-surface: light-dark(var(--md-sys-color-info-900), var(--md-sys-color-info-100));
  --md-sys-color-info-inverse-on-surface: light-dark(var(--md-sys-color-info-050), var(--md-sys-color-info-950));
  --md-sys-color-info-background: light-dark(var(--md-sys-color-info-100), var(--md-sys-color-info-900));
  --md-sys-color-info-surface: light-dark(var(--md-sys-color-info-125), var(--md-sys-color-info-875));
  --md-sys-color-info-surface-dimmest: light-dark(var(--md-sys-color-info-200), var(--md-sys-color-info-950));
  --md-sys-color-info-surface-dimmer: light-dark(var(--md-sys-color-info-175), var(--md-sys-color-info-925));
  --md-sys-color-info-surface-dim: light-dark(var(--md-sys-color-info-150), var(--md-sys-color-info-900));
  --md-sys-color-info-surface-bright: light-dark(var(--md-sys-color-info-100), var(--md-sys-color-info-850));
  --md-sys-color-info-surface-brighter: light-dark(var(--md-sys-color-info-075), var(--md-sys-color-info-825));
  --md-sys-color-info-surface-brightest: light-dark(var(--md-sys-color-info-050), var(--md-sys-color-info-800));
  --md-sys-color-info-surface-lowest: light-dark(var(--md-sys-color-info-050), var(--md-sys-color-info-950));
  --md-sys-color-info-surface-lower: light-dark(var(--md-sys-color-info-075), var(--md-sys-color-info-925));
  --md-sys-color-info-surface-low: light-dark(var(--md-sys-color-info-100), var(--md-sys-color-info-900));
  --md-sys-color-info-surface-high: light-dark(var(--md-sys-color-info-150), var(--md-sys-color-info-850));
  --md-sys-color-info-surface-higher: light-dark(var(--md-sys-color-info-175), var(--md-sys-color-info-825));
  --md-sys-color-info-surface-highest: light-dark(var(--md-sys-color-info-200), var(--md-sys-color-info-800));
  --md-sys-color-info-scrim-weakest: light-dark(var(--md-sys-color-info-scrim-050), var(--md-sys-color-info-scrim-050));
  --md-sys-color-info-scrim-weaker: light-dark(var(--md-sys-color-info-scrim-100), var(--md-sys-color-info-scrim-100));
  --md-sys-color-info-scrim-weak: light-dark(var(--md-sys-color-info-scrim-200), var(--md-sys-color-info-scrim-200));
  --md-sys-color-info-scrim: light-dark(var(--md-sys-color-info-scrim-300), var(--md-sys-color-info-scrim-300));
  --md-sys-color-info-scrim-strong: light-dark(var(--md-sys-color-info-scrim-400), var(--md-sys-color-info-scrim-400));
  --md-sys-color-info-scrim-stronger: light-dark(var(--md-sys-color-info-scrim-500), var(--md-sys-color-info-scrim-500));
  --md-sys-color-info-scrim-strongest: light-dark(var(--md-sys-color-info-scrim-600), var(--md-sys-color-info-scrim-600));
  /* info — retained key colors (exact, OKLCH) */
  --md-sys-color-info-key-dominant: oklch(0.54 0.13 255);

  /* success — flat mode-independent primitives */
  --md-sys-color-success-100: oklch(0.9555 0.0083 157.09);
  --md-sys-color-success-125: oklch(0.9333 0.0151 151.76);
  --md-sys-color-success-150: oklch(0.9124 0.0244 151.16);
  --md-sys-color-success-175: oklch(0.89 0.0353 153.19);
  --md-sys-color-success-200: oklch(0.8683 0.0464 152.07);
  --md-sys-color-success-250: oklch(0.8241 0.0693 152.53);
  --md-sys-color-success-300: oklch(0.7803 0.0873 151.92);
  --md-sys-color-success-350: oklch(0.7365 0.0992 152.24);
  --md-sys-color-success-400: oklch(0.6928 0.1047 152.22);
  --md-sys-color-success-450: oklch(0.648 0.1057 151.89);
  --md-sys-color-success-500: oklch(0.6039 0.1033 151.92);
  --md-sys-color-success-550: oklch(0.5595 0.0931 152.27);
  --md-sys-color-success-600: oklch(0.5145 0.0831 151.67);
  --md-sys-color-success-650: oklch(0.469 0.0704 152.37);
  --md-sys-color-success-700: oklch(0.4251 0.0601 152.02);
  --md-sys-color-success-750: oklch(0.38 0.0494 151.39);
  --md-sys-color-success-800: oklch(0.3331 0.0388 151.29);
  --md-sys-color-success-825: oklch(0.3096 0.0322 151.45);
  --md-sys-color-success-850: oklch(0.2846 0.0276 150.9);
  --md-sys-color-success-875: oklch(0.2594 0.0214 153.18);
  --md-sys-color-success-900: oklch(0.2333 0.0163 152.62);
  --md-sys-color-success-925: oklch(0.2066 0.0109 151.19);
  --md-sys-color-success-950: oklch(0.1766 0.0088 153);
  --md-sys-color-success-050: oklch(1 0 89.88);
  --md-sys-color-success-075: oklch(0.9773 0.0025 165.08);
  --md-sys-color-success-scrim-050: oklch(0.6039 0.1033 151.92 / 5%);
  --md-sys-color-success-scrim-100: oklch(0.6039 0.1033 151.92 / 10%);
  --md-sys-color-success-scrim-200: oklch(0.6039 0.1033 151.92 / 20%);
  --md-sys-color-success-scrim-300: oklch(0.6039 0.1033 151.92 / 30%);
  --md-sys-color-success-scrim-400: oklch(0.6039 0.1033 151.92 / 40%);
  --md-sys-color-success-scrim-500: oklch(0.6039 0.1033 151.92 / 50%);
  --md-sys-color-success-scrim-600: oklch(0.6039 0.1033 151.92 / 60%);
  --md-sys-color-success-scrim-700: oklch(0.6039 0.1033 151.92 / 70%);
  --md-sys-color-success-scrim-800: oklch(0.6039 0.1033 151.92 / 80%);
  --md-sys-color-success-scrim-900: oklch(0.6039 0.1033 151.92 / 90%);
  --md-sys-color-success-scrim-950: oklch(0.6039 0.1033 151.92 / 95%);
  /* success — semantic roles */
  --md-sys-color-success: light-dark(var(--md-sys-color-success-550), var(--md-sys-color-success-450));
  --md-sys-color-success-dim: light-dark(var(--md-sys-color-success-650), var(--md-sys-color-success-700));
  --md-sys-color-success-bright: light-dark(var(--md-sys-color-success-350), var(--md-sys-color-success-400));
  --md-sys-color-success-low: light-dark(var(--md-sys-color-success-350), var(--md-sys-color-success-700));
  --md-sys-color-success-high: light-dark(var(--md-sys-color-success-650), var(--md-sys-color-success-400));
  --md-sys-color-success-hover: light-dark(var(--md-sys-color-success-650), var(--md-sys-color-success-350));
  --md-sys-color-success-active: light-dark(var(--md-sys-color-success-750), var(--md-sys-color-success-250));
  --md-sys-color-success-disabled: light-dark(var(--md-sys-color-success-scrim-600), var(--md-sys-color-success-scrim-600));
  --md-sys-color-success-on-success: light-dark(var(--md-sys-color-success-050), var(--md-sys-color-success-050));
  --md-sys-color-success-on-success-variant: light-dark(var(--md-sys-color-success-200), var(--md-sys-color-success-200));
  --md-sys-color-success-on-success-hover: light-dark(var(--md-sys-color-success-050), var(--md-sys-color-success-050));
  --md-sys-color-success-on-success-active: light-dark(var(--md-sys-color-success-050), var(--md-sys-color-success-050));
  --md-sys-color-success-on-success-disabled: light-dark(var(--md-sys-color-success-scrim-400), var(--md-sys-color-success-scrim-400));
  --md-sys-color-success-on-surface: light-dark(var(--md-sys-color-success-950), var(--md-sys-color-success-050));
  --md-sys-color-success-on-surface-variant: light-dark(var(--md-sys-color-success-750), var(--md-sys-color-success-250));
  --md-sys-color-success-on-surface-hover: light-dark(var(--md-sys-color-success-950), var(--md-sys-color-success-050));
  --md-sys-color-success-on-surface-active: light-dark(var(--md-sys-color-success-950), var(--md-sys-color-success-050));
  --md-sys-color-success-on-surface-disabled: light-dark(var(--md-sys-color-success-scrim-400), var(--md-sys-color-success-scrim-400));
  --md-sys-color-success-placeholder: light-dark(var(--md-sys-color-success-650), var(--md-sys-color-success-350));
  --md-sys-color-success-outline: light-dark(var(--md-sys-color-success-scrim-600), var(--md-sys-color-success-scrim-600));
  --md-sys-color-success-outline-variant: light-dark(var(--md-sys-color-success-scrim-300), var(--md-sys-color-success-scrim-300));
  --md-sys-color-success-outline-hover: light-dark(var(--md-sys-color-success-scrim-700), var(--md-sys-color-success-scrim-700));
  --md-sys-color-success-outline-active: light-dark(var(--md-sys-color-success-scrim-800), var(--md-sys-color-success-scrim-800));
  --md-sys-color-success-outline-disabled: light-dark(var(--md-sys-color-success-scrim-400), var(--md-sys-color-success-scrim-400));
  --md-sys-color-success-container: light-dark(var(--md-sys-color-success-scrim-200), var(--md-sys-color-success-scrim-200));
  --md-sys-color-success-container-low: light-dark(var(--md-sys-color-success-scrim-100), var(--md-sys-color-success-scrim-100));
  --md-sys-color-success-container-high: light-dark(var(--md-sys-color-success-scrim-300), var(--md-sys-color-success-scrim-300));
  --md-sys-color-success-container-hover: light-dark(var(--md-sys-color-success-scrim-300), var(--md-sys-color-success-scrim-300));
  --md-sys-color-success-container-active: light-dark(var(--md-sys-color-success-scrim-400), var(--md-sys-color-success-scrim-400));
  --md-sys-color-success-container-disabled: light-dark(var(--md-sys-color-success-scrim-100), var(--md-sys-color-success-scrim-100));
  --md-sys-color-success-inverse-surface: light-dark(var(--md-sys-color-success-900), var(--md-sys-color-success-100));
  --md-sys-color-success-inverse-on-surface: light-dark(var(--md-sys-color-success-050), var(--md-sys-color-success-950));
  --md-sys-color-success-background: light-dark(var(--md-sys-color-success-100), var(--md-sys-color-success-900));
  --md-sys-color-success-surface: light-dark(var(--md-sys-color-success-125), var(--md-sys-color-success-875));
  --md-sys-color-success-surface-dimmest: light-dark(var(--md-sys-color-success-200), var(--md-sys-color-success-950));
  --md-sys-color-success-surface-dimmer: light-dark(var(--md-sys-color-success-175), var(--md-sys-color-success-925));
  --md-sys-color-success-surface-dim: light-dark(var(--md-sys-color-success-150), var(--md-sys-color-success-900));
  --md-sys-color-success-surface-bright: light-dark(var(--md-sys-color-success-100), var(--md-sys-color-success-850));
  --md-sys-color-success-surface-brighter: light-dark(var(--md-sys-color-success-075), var(--md-sys-color-success-825));
  --md-sys-color-success-surface-brightest: light-dark(var(--md-sys-color-success-050), var(--md-sys-color-success-800));
  --md-sys-color-success-surface-lowest: light-dark(var(--md-sys-color-success-050), var(--md-sys-color-success-950));
  --md-sys-color-success-surface-lower: light-dark(var(--md-sys-color-success-075), var(--md-sys-color-success-925));
  --md-sys-color-success-surface-low: light-dark(var(--md-sys-color-success-100), var(--md-sys-color-success-900));
  --md-sys-color-success-surface-high: light-dark(var(--md-sys-color-success-150), var(--md-sys-color-success-850));
  --md-sys-color-success-surface-higher: light-dark(var(--md-sys-color-success-175), var(--md-sys-color-success-825));
  --md-sys-color-success-surface-highest: light-dark(var(--md-sys-color-success-200), var(--md-sys-color-success-800));
  --md-sys-color-success-scrim-weakest: light-dark(var(--md-sys-color-success-scrim-050), var(--md-sys-color-success-scrim-050));
  --md-sys-color-success-scrim-weaker: light-dark(var(--md-sys-color-success-scrim-100), var(--md-sys-color-success-scrim-100));
  --md-sys-color-success-scrim-weak: light-dark(var(--md-sys-color-success-scrim-200), var(--md-sys-color-success-scrim-200));
  --md-sys-color-success-scrim: light-dark(var(--md-sys-color-success-scrim-300), var(--md-sys-color-success-scrim-300));
  --md-sys-color-success-scrim-strong: light-dark(var(--md-sys-color-success-scrim-400), var(--md-sys-color-success-scrim-400));
  --md-sys-color-success-scrim-stronger: light-dark(var(--md-sys-color-success-scrim-500), var(--md-sys-color-success-scrim-500));
  --md-sys-color-success-scrim-strongest: light-dark(var(--md-sys-color-success-scrim-600), var(--md-sys-color-success-scrim-600));
  /* success — retained key colors (exact, OKLCH) */
  --md-sys-color-success-key-dominant: oklch(0.56 0.115 152);

  /* warning — flat mode-independent primitives */
  --md-sys-color-warning-100: oklch(0.9568 0.0079 73.74);
  --md-sys-color-warning-125: oklch(0.9348 0.0149 70.88);
  --md-sys-color-warning-150: oklch(0.9125 0.0229 71.77);
  --md-sys-color-warning-175: oklch(0.8907 0.0328 71.88);
  --md-sys-color-warning-200: oklch(0.8688 0.0437 72.86);
  --md-sys-color-warning-250: oklch(0.8241 0.0669 71.91);
  --md-sys-color-warning-300: oklch(0.7803 0.0874 72.82);
  --md-sys-color-warning-350: oklch(0.7359 0.1009 72);
  --md-sys-color-warning-400: oklch(0.6928 0.1083 72.84);
  --md-sys-color-warning-450: oklch(0.648 0.109 72.47);
  --md-sys-color-warning-500: oklch(0.6037 0.1059 72.21);
  --md-sys-color-warning-550: oklch(0.559 0.0967 71.98);
  --md-sys-color-warning-600: oklch(0.5145 0.0851 72.85);
  --md-sys-color-warning-650: oklch(0.4704 0.0737 73.01);
  --md-sys-color-warning-700: oklch(0.4251 0.0625 73.7);
  --md-sys-color-warning-750: oklch(0.38 0.0514 73.19);
  --md-sys-color-warning-800: oklch(0.3336 0.0394 72.01);
  --md-sys-color-warning-825: oklch(0.3085 0.0335 69.8);
  --md-sys-color-warning-850: oklch(0.2853 0.0289 72.96);
  --md-sys-color-warning-875: oklch(0.2592 0.0224 69.54);
  --md-sys-color-warning-900: oklch(0.235 0.0173 74.74);
  --md-sys-color-warning-925: oklch(0.2072 0.0131 77.91);
  --md-sys-color-warning-950: oklch(0.1785 0.0086 84.57);
  --md-sys-color-warning-050: oklch(1 0 89.88);
  --md-sys-color-warning-075: oklch(0.9771 0.0034 67.78);
  --md-sys-color-warning-scrim-050: oklch(0.6037 0.1059 72.21 / 5%);
  --md-sys-color-warning-scrim-100: oklch(0.6037 0.1059 72.21 / 10%);
  --md-sys-color-warning-scrim-200: oklch(0.6037 0.1059 72.21 / 20%);
  --md-sys-color-warning-scrim-300: oklch(0.6037 0.1059 72.21 / 30%);
  --md-sys-color-warning-scrim-400: oklch(0.6037 0.1059 72.21 / 40%);
  --md-sys-color-warning-scrim-500: oklch(0.6037 0.1059 72.21 / 50%);
  --md-sys-color-warning-scrim-600: oklch(0.6037 0.1059 72.21 / 60%);
  --md-sys-color-warning-scrim-700: oklch(0.6037 0.1059 72.21 / 70%);
  --md-sys-color-warning-scrim-800: oklch(0.6037 0.1059 72.21 / 80%);
  --md-sys-color-warning-scrim-900: oklch(0.6037 0.1059 72.21 / 90%);
  --md-sys-color-warning-scrim-950: oklch(0.6037 0.1059 72.21 / 95%);
  /* warning — semantic roles */
  --md-sys-color-warning: light-dark(var(--md-sys-color-warning-550), var(--md-sys-color-warning-450));
  --md-sys-color-warning-dim: light-dark(var(--md-sys-color-warning-650), var(--md-sys-color-warning-700));
  --md-sys-color-warning-bright: light-dark(var(--md-sys-color-warning-350), var(--md-sys-color-warning-400));
  --md-sys-color-warning-low: light-dark(var(--md-sys-color-warning-350), var(--md-sys-color-warning-700));
  --md-sys-color-warning-high: light-dark(var(--md-sys-color-warning-650), var(--md-sys-color-warning-400));
  --md-sys-color-warning-hover: light-dark(var(--md-sys-color-warning-650), var(--md-sys-color-warning-350));
  --md-sys-color-warning-active: light-dark(var(--md-sys-color-warning-750), var(--md-sys-color-warning-250));
  --md-sys-color-warning-disabled: light-dark(var(--md-sys-color-warning-scrim-600), var(--md-sys-color-warning-scrim-600));
  --md-sys-color-warning-on-warning: light-dark(var(--md-sys-color-warning-050), var(--md-sys-color-warning-050));
  --md-sys-color-warning-on-warning-variant: light-dark(var(--md-sys-color-warning-200), var(--md-sys-color-warning-200));
  --md-sys-color-warning-on-warning-hover: light-dark(var(--md-sys-color-warning-050), var(--md-sys-color-warning-050));
  --md-sys-color-warning-on-warning-active: light-dark(var(--md-sys-color-warning-050), var(--md-sys-color-warning-050));
  --md-sys-color-warning-on-warning-disabled: light-dark(var(--md-sys-color-warning-scrim-400), var(--md-sys-color-warning-scrim-400));
  --md-sys-color-warning-on-surface: light-dark(var(--md-sys-color-warning-950), var(--md-sys-color-warning-050));
  --md-sys-color-warning-on-surface-variant: light-dark(var(--md-sys-color-warning-750), var(--md-sys-color-warning-250));
  --md-sys-color-warning-on-surface-hover: light-dark(var(--md-sys-color-warning-950), var(--md-sys-color-warning-050));
  --md-sys-color-warning-on-surface-active: light-dark(var(--md-sys-color-warning-950), var(--md-sys-color-warning-050));
  --md-sys-color-warning-on-surface-disabled: light-dark(var(--md-sys-color-warning-scrim-400), var(--md-sys-color-warning-scrim-400));
  --md-sys-color-warning-placeholder: light-dark(var(--md-sys-color-warning-650), var(--md-sys-color-warning-350));
  --md-sys-color-warning-outline: light-dark(var(--md-sys-color-warning-scrim-600), var(--md-sys-color-warning-scrim-600));
  --md-sys-color-warning-outline-variant: light-dark(var(--md-sys-color-warning-scrim-300), var(--md-sys-color-warning-scrim-300));
  --md-sys-color-warning-outline-hover: light-dark(var(--md-sys-color-warning-scrim-700), var(--md-sys-color-warning-scrim-700));
  --md-sys-color-warning-outline-active: light-dark(var(--md-sys-color-warning-scrim-800), var(--md-sys-color-warning-scrim-800));
  --md-sys-color-warning-outline-disabled: light-dark(var(--md-sys-color-warning-scrim-400), var(--md-sys-color-warning-scrim-400));
  --md-sys-color-warning-container: light-dark(var(--md-sys-color-warning-scrim-200), var(--md-sys-color-warning-scrim-200));
  --md-sys-color-warning-container-low: light-dark(var(--md-sys-color-warning-scrim-100), var(--md-sys-color-warning-scrim-100));
  --md-sys-color-warning-container-high: light-dark(var(--md-sys-color-warning-scrim-300), var(--md-sys-color-warning-scrim-300));
  --md-sys-color-warning-container-hover: light-dark(var(--md-sys-color-warning-scrim-300), var(--md-sys-color-warning-scrim-300));
  --md-sys-color-warning-container-active: light-dark(var(--md-sys-color-warning-scrim-400), var(--md-sys-color-warning-scrim-400));
  --md-sys-color-warning-container-disabled: light-dark(var(--md-sys-color-warning-scrim-100), var(--md-sys-color-warning-scrim-100));
  --md-sys-color-warning-inverse-surface: light-dark(var(--md-sys-color-warning-900), var(--md-sys-color-warning-100));
  --md-sys-color-warning-inverse-on-surface: light-dark(var(--md-sys-color-warning-050), var(--md-sys-color-warning-950));
  --md-sys-color-warning-background: light-dark(var(--md-sys-color-warning-100), var(--md-sys-color-warning-900));
  --md-sys-color-warning-surface: light-dark(var(--md-sys-color-warning-125), var(--md-sys-color-warning-875));
  --md-sys-color-warning-surface-dimmest: light-dark(var(--md-sys-color-warning-200), var(--md-sys-color-warning-950));
  --md-sys-color-warning-surface-dimmer: light-dark(var(--md-sys-color-warning-175), var(--md-sys-color-warning-925));
  --md-sys-color-warning-surface-dim: light-dark(var(--md-sys-color-warning-150), var(--md-sys-color-warning-900));
  --md-sys-color-warning-surface-bright: light-dark(var(--md-sys-color-warning-100), var(--md-sys-color-warning-850));
  --md-sys-color-warning-surface-brighter: light-dark(var(--md-sys-color-warning-075), var(--md-sys-color-warning-825));
  --md-sys-color-warning-surface-brightest: light-dark(var(--md-sys-color-warning-050), var(--md-sys-color-warning-800));
  --md-sys-color-warning-surface-lowest: light-dark(var(--md-sys-color-warning-050), var(--md-sys-color-warning-950));
  --md-sys-color-warning-surface-lower: light-dark(var(--md-sys-color-warning-075), var(--md-sys-color-warning-925));
  --md-sys-color-warning-surface-low: light-dark(var(--md-sys-color-warning-100), var(--md-sys-color-warning-900));
  --md-sys-color-warning-surface-high: light-dark(var(--md-sys-color-warning-150), var(--md-sys-color-warning-850));
  --md-sys-color-warning-surface-higher: light-dark(var(--md-sys-color-warning-175), var(--md-sys-color-warning-825));
  --md-sys-color-warning-surface-highest: light-dark(var(--md-sys-color-warning-200), var(--md-sys-color-warning-800));
  --md-sys-color-warning-scrim-weakest: light-dark(var(--md-sys-color-warning-scrim-050), var(--md-sys-color-warning-scrim-050));
  --md-sys-color-warning-scrim-weaker: light-dark(var(--md-sys-color-warning-scrim-100), var(--md-sys-color-warning-scrim-100));
  --md-sys-color-warning-scrim-weak: light-dark(var(--md-sys-color-warning-scrim-200), var(--md-sys-color-warning-scrim-200));
  --md-sys-color-warning-scrim: light-dark(var(--md-sys-color-warning-scrim-300), var(--md-sys-color-warning-scrim-300));
  --md-sys-color-warning-scrim-strong: light-dark(var(--md-sys-color-warning-scrim-400), var(--md-sys-color-warning-scrim-400));
  --md-sys-color-warning-scrim-stronger: light-dark(var(--md-sys-color-warning-scrim-500), var(--md-sys-color-warning-scrim-500));
  --md-sys-color-warning-scrim-strongest: light-dark(var(--md-sys-color-warning-scrim-600), var(--md-sys-color-warning-scrim-600));
  /* warning — retained key colors (exact, OKLCH) */
  --md-sys-color-warning-key-dominant: oklch(0.62 0.118 73);

  /* danger — flat mode-independent primitives */
  --md-sys-color-danger-100: oklch(0.9567 0.0109 24.32);
  --md-sys-color-danger-125: oklch(0.9346 0.0191 29.55);
  --md-sys-color-danger-150: oklch(0.9119 0.0292 25.57);
  --md-sys-color-danger-175: oklch(0.8891 0.0399 25.63);
  --md-sys-color-danger-200: oklch(0.8681 0.0533 26.87);
  --md-sys-color-danger-250: oklch(0.8238 0.0835 27.22);
  --md-sys-color-danger-300: oklch(0.7812 0.1195 27);
  --md-sys-color-danger-350: oklch(0.7372 0.1606 27.05);
  --md-sys-color-danger-400: oklch(0.692 0.1978 27.04);
  --md-sys-color-danger-450: oklch(0.6481 0.2377 27.04);
  --md-sys-color-danger-500: oklch(0.6045 0.2464 27.04);
  --md-sys-color-danger-550: oklch(0.5588 0.2277 26.92);
  --md-sys-color-danger-600: oklch(0.514 0.2095 26.96);
  --md-sys-color-danger-650: oklch(0.4693 0.1898 26.87);
  --md-sys-color-danger-700: oklch(0.4233 0.147 26.95);
  --md-sys-color-danger-750: oklch(0.3785 0.1123 27.39);
  --md-sys-color-danger-800: oklch(0.3323 0.0851 26.7);
  --md-sys-color-danger-825: oklch(0.3095 0.0705 26.96);
  --md-sys-color-danger-850: oklch(0.285 0.0566 27.72);
  --md-sys-color-danger-875: oklch(0.2603 0.045 27.03);
  --md-sys-color-danger-900: oklch(0.233 0.0345 25.9);
  --md-sys-color-danger-925: oklch(0.2066 0.0255 27.81);
  --md-sys-color-danger-950: oklch(0.1771 0.0174 25.39);
  --md-sys-color-danger-050: oklch(1 0 89.88);
  --md-sys-color-danger-075: oklch(0.9789 0.0045 34.31);
  --md-sys-color-danger-scrim-050: oklch(0.6045 0.2464 27.04 / 5%);
  --md-sys-color-danger-scrim-100: oklch(0.6045 0.2464 27.04 / 10%);
  --md-sys-color-danger-scrim-200: oklch(0.6045 0.2464 27.04 / 20%);
  --md-sys-color-danger-scrim-300: oklch(0.6045 0.2464 27.04 / 30%);
  --md-sys-color-danger-scrim-400: oklch(0.6045 0.2464 27.04 / 40%);
  --md-sys-color-danger-scrim-500: oklch(0.6045 0.2464 27.04 / 50%);
  --md-sys-color-danger-scrim-600: oklch(0.6045 0.2464 27.04 / 60%);
  --md-sys-color-danger-scrim-700: oklch(0.6045 0.2464 27.04 / 70%);
  --md-sys-color-danger-scrim-800: oklch(0.6045 0.2464 27.04 / 80%);
  --md-sys-color-danger-scrim-900: oklch(0.6045 0.2464 27.04 / 90%);
  --md-sys-color-danger-scrim-950: oklch(0.6045 0.2464 27.04 / 95%);
  /* danger — semantic roles */
  --md-sys-color-danger: light-dark(var(--md-sys-color-danger-550), var(--md-sys-color-danger-450));
  --md-sys-color-danger-dim: light-dark(var(--md-sys-color-danger-650), var(--md-sys-color-danger-700));
  --md-sys-color-danger-bright: light-dark(var(--md-sys-color-danger-350), var(--md-sys-color-danger-400));
  --md-sys-color-danger-low: light-dark(var(--md-sys-color-danger-350), var(--md-sys-color-danger-700));
  --md-sys-color-danger-high: light-dark(var(--md-sys-color-danger-650), var(--md-sys-color-danger-400));
  --md-sys-color-danger-hover: light-dark(var(--md-sys-color-danger-650), var(--md-sys-color-danger-350));
  --md-sys-color-danger-active: light-dark(var(--md-sys-color-danger-750), var(--md-sys-color-danger-250));
  --md-sys-color-danger-disabled: light-dark(var(--md-sys-color-danger-scrim-600), var(--md-sys-color-danger-scrim-600));
  --md-sys-color-danger-on-danger: light-dark(var(--md-sys-color-danger-050), var(--md-sys-color-danger-050));
  --md-sys-color-danger-on-danger-variant: light-dark(var(--md-sys-color-danger-200), var(--md-sys-color-danger-200));
  --md-sys-color-danger-on-danger-hover: light-dark(var(--md-sys-color-danger-050), var(--md-sys-color-danger-050));
  --md-sys-color-danger-on-danger-active: light-dark(var(--md-sys-color-danger-050), var(--md-sys-color-danger-050));
  --md-sys-color-danger-on-danger-disabled: light-dark(var(--md-sys-color-danger-scrim-400), var(--md-sys-color-danger-scrim-400));
  --md-sys-color-danger-on-surface: light-dark(var(--md-sys-color-danger-950), var(--md-sys-color-danger-050));
  --md-sys-color-danger-on-surface-variant: light-dark(var(--md-sys-color-danger-750), var(--md-sys-color-danger-250));
  --md-sys-color-danger-on-surface-hover: light-dark(var(--md-sys-color-danger-950), var(--md-sys-color-danger-050));
  --md-sys-color-danger-on-surface-active: light-dark(var(--md-sys-color-danger-950), var(--md-sys-color-danger-050));
  --md-sys-color-danger-on-surface-disabled: light-dark(var(--md-sys-color-danger-scrim-400), var(--md-sys-color-danger-scrim-400));
  --md-sys-color-danger-placeholder: light-dark(var(--md-sys-color-danger-650), var(--md-sys-color-danger-350));
  --md-sys-color-danger-outline: light-dark(var(--md-sys-color-danger-scrim-600), var(--md-sys-color-danger-scrim-600));
  --md-sys-color-danger-outline-variant: light-dark(var(--md-sys-color-danger-scrim-300), var(--md-sys-color-danger-scrim-300));
  --md-sys-color-danger-outline-hover: light-dark(var(--md-sys-color-danger-scrim-700), var(--md-sys-color-danger-scrim-700));
  --md-sys-color-danger-outline-active: light-dark(var(--md-sys-color-danger-scrim-800), var(--md-sys-color-danger-scrim-800));
  --md-sys-color-danger-outline-disabled: light-dark(var(--md-sys-color-danger-scrim-400), var(--md-sys-color-danger-scrim-400));
  --md-sys-color-danger-container: light-dark(var(--md-sys-color-danger-scrim-200), var(--md-sys-color-danger-scrim-200));
  --md-sys-color-danger-container-low: light-dark(var(--md-sys-color-danger-scrim-100), var(--md-sys-color-danger-scrim-100));
  --md-sys-color-danger-container-high: light-dark(var(--md-sys-color-danger-scrim-300), var(--md-sys-color-danger-scrim-300));
  --md-sys-color-danger-container-hover: light-dark(var(--md-sys-color-danger-scrim-300), var(--md-sys-color-danger-scrim-300));
  --md-sys-color-danger-container-active: light-dark(var(--md-sys-color-danger-scrim-400), var(--md-sys-color-danger-scrim-400));
  --md-sys-color-danger-container-disabled: light-dark(var(--md-sys-color-danger-scrim-100), var(--md-sys-color-danger-scrim-100));
  --md-sys-color-danger-inverse-surface: light-dark(var(--md-sys-color-danger-900), var(--md-sys-color-danger-100));
  --md-sys-color-danger-inverse-on-surface: light-dark(var(--md-sys-color-danger-050), var(--md-sys-color-danger-950));
  --md-sys-color-danger-background: light-dark(var(--md-sys-color-danger-100), var(--md-sys-color-danger-900));
  --md-sys-color-danger-surface: light-dark(var(--md-sys-color-danger-125), var(--md-sys-color-danger-875));
  --md-sys-color-danger-surface-dimmest: light-dark(var(--md-sys-color-danger-200), var(--md-sys-color-danger-950));
  --md-sys-color-danger-surface-dimmer: light-dark(var(--md-sys-color-danger-175), var(--md-sys-color-danger-925));
  --md-sys-color-danger-surface-dim: light-dark(var(--md-sys-color-danger-150), var(--md-sys-color-danger-900));
  --md-sys-color-danger-surface-bright: light-dark(var(--md-sys-color-danger-100), var(--md-sys-color-danger-850));
  --md-sys-color-danger-surface-brighter: light-dark(var(--md-sys-color-danger-075), var(--md-sys-color-danger-825));
  --md-sys-color-danger-surface-brightest: light-dark(var(--md-sys-color-danger-050), var(--md-sys-color-danger-800));
  --md-sys-color-danger-surface-lowest: light-dark(var(--md-sys-color-danger-050), var(--md-sys-color-danger-950));
  --md-sys-color-danger-surface-lower: light-dark(var(--md-sys-color-danger-075), var(--md-sys-color-danger-925));
  --md-sys-color-danger-surface-low: light-dark(var(--md-sys-color-danger-100), var(--md-sys-color-danger-900));
  --md-sys-color-danger-surface-high: light-dark(var(--md-sys-color-danger-150), var(--md-sys-color-danger-850));
  --md-sys-color-danger-surface-higher: light-dark(var(--md-sys-color-danger-175), var(--md-sys-color-danger-825));
  --md-sys-color-danger-surface-highest: light-dark(var(--md-sys-color-danger-200), var(--md-sys-color-danger-800));
  --md-sys-color-danger-scrim-weakest: light-dark(var(--md-sys-color-danger-scrim-050), var(--md-sys-color-danger-scrim-050));
  --md-sys-color-danger-scrim-weaker: light-dark(var(--md-sys-color-danger-scrim-100), var(--md-sys-color-danger-scrim-100));
  --md-sys-color-danger-scrim-weak: light-dark(var(--md-sys-color-danger-scrim-200), var(--md-sys-color-danger-scrim-200));
  --md-sys-color-danger-scrim: light-dark(var(--md-sys-color-danger-scrim-300), var(--md-sys-color-danger-scrim-300));
  --md-sys-color-danger-scrim-strong: light-dark(var(--md-sys-color-danger-scrim-400), var(--md-sys-color-danger-scrim-400));
  --md-sys-color-danger-scrim-stronger: light-dark(var(--md-sys-color-danger-scrim-500), var(--md-sys-color-danger-scrim-500));
  --md-sys-color-danger-scrim-strongest: light-dark(var(--md-sys-color-danger-scrim-600), var(--md-sys-color-danger-scrim-600));
  /* danger — retained key colors (exact, OKLCH) */
  --md-sys-color-danger-key-dominant: oklch(0.52 0.176 27);

  /* ⓪ Dedicated focus-ring role (ADR-0009) — a DISTINCT role, never \`--md-sys-color-primary\` reused, so
        the keyboard ring can be tuned independently of the accent fill. SC 1.4.11 non-text 3:1 (a ring,
        not a text-bearing fill — the AA-4.5 rule does not apply). Hand-authored + re-added VERBATIM after
        regeneration (the generator emits only the \`@media (forced-colors)\` \`Highlight\` leg below, not this
        :root base). Pinned by tokens.test.ts. */
  --md-sys-color-focus-ring: light-dark(var(--md-sys-color-primary-550), var(--md-sys-color-primary-400));

  /* ① Elevation brightness-wash system (G9 · ADR-0015 cl.3) — scheme-invariant translucent black/white
        overlays composited over a solid base plane. The generator's \`-scrim-NNN\` alphas are GREY
        (chroma ~0.03), only darken, and have no bright/lift leg, so they cannot stand in — these six
        roles + their black/white alpha primitives are HAND-AUTHORED and re-added VERBATIM after every
        regeneration until the generator emits them (the regenerated \`@media (forced-colors)\` block below
        already references the six tint roles, so the generator is aware of them but drops their :root
        definitions). Consumed by _surface/container.css (all six) + combo-box.css / command-modal.css
        (-dim, active-descendant highlighting — NOT row-hover, which reads the solid, scheme-inverting
        \`-surface-high\` role instead, per the 2026-07-07 menu.css convergence, menu.css:87-96). Pinned by
        tokens.test.ts. */
  --md-sys-color-neutral-050-50: oklch(1 0 89.88 / 5%);
  --md-sys-color-neutral-050-100: oklch(1 0 89.88 / 10%);
  --md-sys-color-neutral-050-140: oklch(1 0 89.88 / 14%);
  --md-sys-color-neutral-950-50: oklch(0.1774 0.0044 264.46 / 5%);
  --md-sys-color-neutral-950-100: oklch(0.1774 0.0044 264.46 / 10%);
  --md-sys-color-neutral-950-140: oklch(0.1774 0.0044 264.46 / 14%);
  --md-sys-color-neutral-tint-dim: light-dark(var(--md-sys-color-neutral-950-50), var(--md-sys-color-neutral-950-50));
  --md-sys-color-neutral-tint-dimmer: light-dark(var(--md-sys-color-neutral-950-100), var(--md-sys-color-neutral-950-100));
  --md-sys-color-neutral-tint-dimmest: light-dark(var(--md-sys-color-neutral-950-140), var(--md-sys-color-neutral-950-140));
  --md-sys-color-neutral-tint-bright: light-dark(var(--md-sys-color-neutral-050-50), var(--md-sys-color-neutral-050-50));
  --md-sys-color-neutral-tint-brighter: light-dark(var(--md-sys-color-neutral-050-100), var(--md-sys-color-neutral-050-100));
  --md-sys-color-neutral-tint-brightest: light-dark(var(--md-sys-color-neutral-050-140), var(--md-sys-color-neutral-050-140));

  /* ② Solid low-contrast rail (ADR-0059) — the OFF-track/unfilled-rail of switch/slider/progress. A
        SC 1.4.11 role held ≥3:1 against every surface plane; must be OPAQUE (the generated container /
        outline roles are translucent alphas; the neutral steps here — 600/400/700/300 — survive). */
  --md-sys-color-neutral-track: light-dark(var(--md-sys-color-neutral-600), var(--md-sys-color-neutral-400));
  --md-sys-color-neutral-track-hover: light-dark(var(--md-sys-color-neutral-700), var(--md-sys-color-neutral-300));

  /* ③ Persistent-SELECTED accent fill (ADR-0048) — the calendar selected-day + segmented-control
        selected-segment fill. Both legs clear WCAG-AA (≥4.5:1) against on-primary WHITE text, which
        the plain \`primary\` anchor (500) does NOT in dark. The generated ladder has no "selected" rung
        (hover/active shift the wrong way for a fill that always bears white text). Pinned by tokens.test.ts.
        RE-DERIVED for the new ramp (was 550/600): the regenerated primary mid-tones are lighter, so
        primary-550 fell to 3.85:1 vs white — below AA. primary-600 is the lightest stop clearing 4.5:1
        (4.73:1) against on-primary white, so BOTH legs pin to 600. This is the one dropped role whose
        exact stops the ramp change forced to move; the visual shift is one step darker in light mode. */
  --md-sys-color-primary-selected: light-dark(var(--md-sys-color-primary-600), var(--md-sys-color-primary-600));

  /* ④ Scrollbar-thumb affordance (GH #867) — the shared unobtrusive-scroll idiom: a thumb painted only on
        hover/focus-within (transparent at rest, so nothing chunky ever paints while idle), reusing the ②
        rail role's own ≥3:1 SC 1.4.11 contrast target rather than minting a new ramp step — a scrollbar
        thumb is the same "off-track, low-emphasis affordance" role as a switch/slider rail. Named under the
        \`neutral\` family (\`--md-sys-color-neutral-scrollbar-*\`), NOT a bare \`--md-sys-color-scrollbar-*\` —
        the family/role parse (site/lib/token-parse.ts's \`familiesOf\`) would otherwise mint a genuinely NEW
        11th palette family for what is really just two more neutral roles (the tokens-doc.test.ts "exactly
        ten families" gate is the live proof this reasoning is load-bearing, not stylistic). */
  --md-sys-color-neutral-scrollbar-thumb: var(--md-sys-color-neutral-track);
  --md-sys-color-neutral-scrollbar-thumb-hover: var(--md-sys-color-neutral-track-hover);

  /* ⑤ Answered/settled choice pair (ADR-0196, GH #1065) — the fleet-wide \`:state(answered)\` treatment's
        ONE token pair, both PURE ALIASES of existing neutral roles (zero new literals, the ADR's own
        clause 2): a role-repoint (the TKT-0047/TKT-0062 canon), never an opacity dim — the settled
        control's UNSELECTED options + frame step back to this quieter bg/ink pair while the selected
        indicator keeps its full-contrast selected tokens. Consumed only through each choice control's
        own --ui-{name}-* chain inside its \`:state(answered)\` rule (interaction-states.md §6). */
  --ui-answered-bg: var(--md-sys-color-neutral-container-low);
  --ui-answered-ink: var(--md-sys-color-neutral-on-surface-variant);

  /* ⑥ Working/live-surface-mutation color (ADR-0199, GH #1104) — the fleet-wide \`:state(working)\`
        breathing inner-shadow treatment's ONE color, a PURE ALIAS of the primary role (zero new
        literals, the ADR's own clause 4): the alive signal is accent-family by intent (activity, not
        neutrality); rendered strength is governed entirely by the \`--ui-working-opacity-*\` rungs
        (dimensions.css), which at max keep the effective surface tint under the G9 14%-alpha ceiling
        across the diffused inset falloff. Consumed only through a consuming control's own
        --ui-{name}-* chain inside its \`:state(working)\` rule (interaction-states.md §7). */
  --ui-working-color: var(--md-sys-color-primary);

}

/* Forced-colors (WHCM) — roles carry the WHCM mapping in the token layer (tokens.md), so components survive
   forced-colors for free. The focus ring maps to the system focus colour \`Highlight\`, so the keyboard ring
   stays visible under forced-colors with zero per-control rules (ADR-0009). */
@media (forced-colors: active) {
  :root {
    --md-sys-color-focus-ring: Highlight;
    /* The brightness wash drops out under forced-colors: a translucent gradient overlay would paint OVER
       the UA-forced system \`Canvas\` base and defeat it, so each tint role goes \`transparent\` and the
       container surface resolves to the system colour for free (ADR-0015 cl.3 — forced-colors-safe). */
    --md-sys-color-neutral-tint-dim: transparent;
    --md-sys-color-neutral-tint-dimmer: transparent;
    --md-sys-color-neutral-tint-dimmest: transparent;
    --md-sys-color-neutral-tint-bright: transparent;
    --md-sys-color-neutral-tint-brighter: transparent;
    --md-sys-color-neutral-tint-brightest: transparent;
  }
}
`,p=`/* dimensions.css — the dimensional token ramp (geometry.md, the law; values from geometry-sizing-spec.md
 * §1, the hand-tabled ramp). The CONTROL band: per-size height + font for sm/md/lg, plus the two global
 * multipliers the geometry consumes — [scale] (the frame size) and [density] (the rhythm).
 *
 * The two families (geometry.md): FRAME ∝ height (height, inline-pad, min-inline-size, radius) and RHYTHM
 * ∝ font (gap = font/2, caret = font). [scale] multiplies BOTH the frame and the font; [density] multiplies
 * the RHYTHM ONLY (the gap) — never the frame, since scaling the frame un-centers the glyph and breaks the
 * square. So height/font carry \`var(--md-sys-scale)\`; the gap carries \`var(--md-sys-density)\` (and font, hence scale).
 *
 * Loaded AFTER tokens.css (color) in the foundation CSS stack; consumed by a control's \`:where(ui-{cmp})\`
 * block (e.g. button.css repoints \`--ui-button-height: var(--md-sys-height-md)\` etc.). Pure tokens — no imports.
 */

:root {
  /* The two global multipliers. Default = 1; an ancestor [scale]/[density] repoints them for its subtree
     (custom properties inherit, so the nearest ancestor wins by cascade proximity). */
  --md-sys-scale: 1;
  --md-sys-density: 1;

  /* --md-sys-compact-* — the WIDGET-BOX ramp (ADR-0041; Kim's 8-value ramp 12·14·16·18·20·22·24·28). The box of
     the Indicator (checkbox/switch/radio) + Range (slider) classes — a SEPARATE size system from the Control
     height (geometry-sizing-spec §5.1), so NOT --md-sys-height-*. Same explicit lookup as ADR-0038: a LITERAL
     per-[scale] table (:root default + the [scale] selectors re-table it; [size] picks sm/md/lg), NO --md-sys-scale
     multiplier — so it can't ride \`*\` (a literal on \`*\` re-declares per descendant and defeats subtree
     inheritance). ui-md default 14·16·18 (byte-identical to the §5.2 default). Unlike the control fonts, the 6
     tiers are ALL-DISTINCT (the widget ramp is dense/linear — no content-sm ≡ ui-md overlap). */
  --md-sys-compact-sm: 14px;
  --md-sys-compact-md: 16px;
  --md-sys-compact-lg: 18px;

  /* --md-sys-widget-inset (ADR-0041 cl.3) — the THUMB inset law for thumbed widgets (switch knob, slider handle):
     thumb = box − 2×inset, track = the widget box. A FLAT fleet CONSTANT (like a 1px border / --md-sys-shape-corner-base),
     NOT box-scaled — 2px reads correctly from the 12-box to the 28-box. Geometric (frame family) → density-
     INVARIANT (density rides the gap, never the inset). On :root, not the \`*\` ramp. */
  --md-sys-widget-inset: 2px;

  /* Control-band HEIGHT + FONT + ICON — Kim's explicit (scale × size) → §1-row LOOKUP (ADR-0038, supersedes
     the MULTIPLIER: ADR-0007's control leg + ADR-0032's 0.875…1.75 ladder; re-tables ADR-0035's non-default
     font/icon). The ui-md default triples (height 24·28·36, font 13·14·16, icon 16·18·20 — byte-identical to
     today); each [scale] tier re-tables ALL THREE below to its §1 row — height picks the row, font/icon/caret/
     gap/pad all derive from that ONE row (the consistency the multiplier broke). NO multiplier: \`× var(--md-sys-
     scale)\` LEAVES the control path entirely; --md-sys-scale survives for --md-sys-typescale-*-size DISPLAY only (below). LITERALS,
     so they sit on :root (default) + the [scale] selectors, NEVER \`*\` (a literal on \`*\` re-declares per
     descendant and defeats subtree inheritance — the #25 --md-sys-compact proof). gap = font/2 (on \`*\`, reads the
     inherited --md-sys-font) + caret = font follow for free. Kim's band overlap: content-sm ≡ ui-md, content-md ≡
     ui-lg (the 6 [scale] names render 4 distinct registers). */
  --md-sys-height-sm: 24px;
  --md-sys-height-md: 28px;
  --md-sys-height-lg: 36px;

  --md-sys-font-sm: 13px;
  --md-sys-font-md: 14px;
  --md-sys-font-lg: 16px;

  --md-sys-icon-sm: 16px;
  --md-sys-icon-md: 18px;
  --md-sys-icon-lg: 20px;

  /* Single-line control line-height (ADR-0036) — a CONSTANT 1: a control glyph is ONE line centred in the
     frame by the h/2 law, so line-height 1 keeps the text box = the font box (a >1 leading would inflate the
     line box and fight the square-centring). Controls read \`line-height: var(--md-sys-control-line-height)\` on
     :scope. Not [scale]/[density]-derived → :root, like the focus-ring / motion constants. */
  --md-sys-control-line-height: 1;

  /* Focus-ring geometry (ADR-0009) — CONSTANTS, not derived via a subtree-repointable multiplier, so they
     stay on :root, NOT on \`*\`: ADR-0007's universal-selector rule covers only DERIVED tokens (a var() over
     --md-sys-scale/--md-sys-density that must re-substitute per element); a constant on \`*\` would be needless churn.
     2px width / 2px offset — the shared ring every control's \`:focus-visible\` outline reads. */
  --md-sys-state-focus-ring-width: 2px;
  --md-sys-state-focus-ring-offset: 2px;

  /* Unobtrusive-scrollbar affordance (GH #867) — the shared thin/auto-hiding scroll-surface geometry: a
     CONSTANT (no [scale]/[density] multiplier — a scrollbar gutter does not resize with the control ramp),
     so it sits on :root like the focus-ring geometry above, NOT the \`*\` ramp. Feeds BOTH engines' knobs from
     ONE number: Firefox's \`scrollbar-width: thin\` keyword (unitless, reads no token) plus \`::-webkit-
     scrollbar { width/height }\` (Chromium/WebKit, which has no "thin" keyword of its own) — so this constant
     is the WebKit leg's own thin-ness, and the thumb radius derives from it (half the gutter) rather than a
     second hand-tuned number. A component mints its own-chain \`--ui-{cmp}-scrollbar-size\` from this in its
     \`:where()\` token block and consumes THAT in \`@scope\`, same as every other dimensional constant here. */
  --md-sys-scrollbar-size: 8px;

  /* Motion (the interaction-states standard) — state-transition timing. CONSTANTS (no var() over a
     subtree-repointable multiplier), so on :root like the focus-ring geometry, NOT the \`*\` ramp. A control's
     \`@scope\` block transitions its state-PAINT properties (background/colour/border) over --md-sys-motion-duration-fast —
     and one non-paint exception: state-driven \`transform\` (a moving selection indicator, e.g.
     ui-segmented-control's \`::before\` that slides between segments, ADR-0095 — the presentation ADR-0086
     originally minted on \`ui-radio-group[variant='segmented']\`, since promoted to its own standalone tag).
     That is exempt because it is compositor-only — it causes no reflow and the indicator's SIZE still snaps;
     only its POSITION animates, so it does not fight the sizing law. Still NEVER a [scale]/[density]/[size]
     sizing-ramp change (those must snap — animating the ramp fights the sizing law). prefers-reduced-motion is
     honoured at the consumption site (the control zeroes the transition). */
  --md-sys-motion-duration-fast: 300ms;
  --md-sys-motion-easing-standard: cubic-bezier(0.25, 0.1, 0.25, 1); /* Apple "smooth" easing */

  /* Pending/stale-content convention (ADR-0191, GH #974's companion styling half; booked repair GH #999) —
     the fleet-wide \`:state(pending)\` host custom state's own token pair (TKT-0062's filled-state-law SHAPE
     re-applied to async staleness — interaction-states.md §5). \`--ui-pending-duration\` ALIASES
     \`--md-sys-motion-duration-fast\` (no new motion token — the ui-drawer/ADR-0188 cl.5 precedent applied
     here too) — a plain :root CONSTANT, like the motion pair above (no [scale]/[density] multiplier).
     \`--ui-pending-opacity\` is a genuinely NEW literal (\`0.6\`) — the stale-content DIM step (never a
     recolor: TKT-0062's bg/border/ink law stays untouched under it; pending content can be arbitrary,
     unknown-depth DOM, which a role-repoint cannot reach in general), grounded in TKT-0047's disabled-
     opacity multi-layer-stacking exception, NOT a nonexistent "disabled defaults to opacity" convention
     (the fleet's disabled canon is role-repoint). Both are \`--ui-*\` fleet-wide constants, NOT on the
     sanctioned direct-read list (tokens.md's Consumption invariants, TKT-0066 item 5) — a component routes
     them through its OWN \`--ui-{cmp}-*\` chain, e.g.
     \`--ui-status-stream-pending-opacity: var(--ui-pending-opacity);\` in the control's \`:where()\` block. */
  --ui-pending-duration: var(--md-sys-motion-duration-fast);
  --ui-pending-opacity: 0.6;

  /* Working/live-surface-mutation convention (ADR-0199, GH #1104) — the fleet-wide \`:state(working)\`
     breathing treatment's constants (interaction-states.md §7). \`--ui-working-duration\` is the fleet's
     FIRST LOOP-motion literal, deliberately NOT an alias of \`--md-sys-motion-duration-fast\` (300ms is a
     state-TRANSITION duration; a breathing half-cycle at 300ms is a strobe, not a breath — ADR-0199
     cl.4): ~1.6s per half-cycle (≈3.2s full breath, ≈0.3Hz, the calm-ambient band). The opacity pair is
     the breath's two rungs on the ::after overlay (the overlay's OPACITY animates — compositor-only —
     never the box-shadow value itself); \`--ui-working-blur\` is the "large diffused" inset spread, a
     paint constant like the focus-ring width (no [scale] ramp participation — it never animates). All
     :root CONSTANTS, and NOT on the sanctioned direct-read list (TKT-0066 item 5) — a consuming control
     routes them through its OWN chain, e.g. \`--ui-surface-host-working-duration:
     var(--ui-working-duration);\` in the control's \`:where()\` block. The color half of the treatment
     (\`--ui-working-color\`) lives in tokens.css. */
  --ui-working-duration: 1600ms;
  --ui-working-opacity-min: 0.15;
  --ui-working-opacity-max: 0.55;
  --ui-working-blur: 24px;

  /* Container radius (ADR-0015 cl.5) — ONE shared fleet radius. A CONSTANT on :root, NOT the \`*\` ramp:
     unlike a control's pill radius (frame family ∝ height, scaled), a container's corner radius is fixed
     regardless of [scale] (the ADR is explicit — "not subtree-derived"). A root container reads
     \`border-radius: var(--ui-card-radius, var(--md-sys-shape-corner-base))\`; it seeds the one-level nested-radius
     chain (ADR-0018: child = max(0px, radius − padding)) and is the radius the ui-text-field follow-up
     (#71) adopts — one referent serving controls and containers. */
  --md-sys-shape-corner-base: 12px;

  /* Monospace family — the shared typeface CONSTANT for code/figure surfaces (code blocks, inline-code
     chips, captions). A :root constant like the focus-ring / radius constants, NOT the \`*\` ramp: a
     font-family carries no [scale]/[density] multiplier (it has no scheme/AA/forced-colors dimension
     either — it is a typeface, not a colour role). Named --md-sys-typeface-mono (NOT --md-sys-font-*) to stay clear of the
     --md-sys-font-{sm,md,lg} SIZE namespace and the :root \`--md-sys-font\` guard (dimensions.test.ts). */
  --md-sys-typeface-mono: ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Sans (UI) family — the shared typeface constant for everything else: the document base layer
     (base.css) and any host chrome consume it, so the fleet's one sans stack has ONE home (it was
     previously hand-rolled in the docs shell's _page.css only, and a shell-less page fell back to the
     UA serif). Same constant class + naming rationale as --md-sys-typeface-mono above. */
  --md-sys-typeface-sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

  /* Type scale (ADR-0078 cl.2/cl.2b — retires ADR-0025 cl.3's --ui-type-*) — the fleet typographic ramp,
     now the M3 typescale namespace: --md-sys-typescale-{role}-{size}-{property}, role ∈ display/headline/
     title/body/label (M3-verbatim, cl.2) + kicker/overline/quote/lead (editorial extensions, cl.2b), size ∈
     large/medium/small (M3 spelling, NOT lg/md/sm — the sm/md/lg ↔ large/medium/small mapping is text.css's
     job). -weight/-line-height/-tracking are CONSTANTS on :root (like the focus-ring / motion constants),
     NOT the \`*\` ramp: none rides [scale]/[density] — a subtree theme rescales the -size leg only (below).
     -line-height is UNITLESS (M3 line-height-px ÷ M3 size-px, 3dp — so it scales WITH the already-scaled
     -size). -tracking is EM (M3 tracking-px ÷ M3 size-px, 3dp; literal 0 where M3 tracking is 0 — letter-
     spacing rides font-size naturally under [scale]). A control never reads these — ui-text reads
     --ui-text-* (text.css), which repoints to this family. The 15 M3-core rows are verbatim against the
     canonical MD3 default type scale (m3.material.io / material-web tokens v0.192 — verified 2026-07-04);
     the 12 extension rows are marked, each derived from an M3 anchor (ADR-0078 cl.2b). */
  --md-sys-typescale-display-large-weight: 400;
  --md-sys-typescale-display-large-line-height: 1.123;
  --md-sys-typescale-display-large-tracking: -0.004em;
  --md-sys-typescale-display-medium-weight: 400;
  --md-sys-typescale-display-medium-line-height: 1.156;
  --md-sys-typescale-display-medium-tracking: 0;
  --md-sys-typescale-display-small-weight: 400;
  --md-sys-typescale-display-small-line-height: 1.222;
  --md-sys-typescale-display-small-tracking: 0;

  --md-sys-typescale-headline-large-weight: 400;
  --md-sys-typescale-headline-large-line-height: 1.25;
  --md-sys-typescale-headline-large-tracking: 0;
  --md-sys-typescale-headline-medium-weight: 400;
  --md-sys-typescale-headline-medium-line-height: 1.286;
  --md-sys-typescale-headline-medium-tracking: 0;
  --md-sys-typescale-headline-small-weight: 400;
  --md-sys-typescale-headline-small-line-height: 1.333;
  --md-sys-typescale-headline-small-tracking: 0;

  --md-sys-typescale-title-large-weight: 400;
  --md-sys-typescale-title-large-line-height: 1.273;
  --md-sys-typescale-title-large-tracking: 0;
  --md-sys-typescale-title-medium-weight: 500;
  --md-sys-typescale-title-medium-line-height: 1.5;
  --md-sys-typescale-title-medium-tracking: 0.009em;
  --md-sys-typescale-title-small-weight: 500;
  --md-sys-typescale-title-small-line-height: 1.429;
  --md-sys-typescale-title-small-tracking: 0.007em;

  --md-sys-typescale-body-large-weight: 400;
  --md-sys-typescale-body-large-line-height: 1.5;
  --md-sys-typescale-body-large-tracking: 0.031em;
  --md-sys-typescale-body-medium-weight: 400;
  --md-sys-typescale-body-medium-line-height: 1.429;
  --md-sys-typescale-body-medium-tracking: 0.018em;
  --md-sys-typescale-body-small-weight: 400;
  --md-sys-typescale-body-small-line-height: 1.333;
  --md-sys-typescale-body-small-tracking: 0.033em;

  --md-sys-typescale-label-large-weight: 500;
  --md-sys-typescale-label-large-line-height: 1.429;
  --md-sys-typescale-label-large-tracking: 0.007em;
  --md-sys-typescale-label-medium-weight: 500;
  --md-sys-typescale-label-medium-line-height: 1.333;
  --md-sys-typescale-label-medium-tracking: 0.042em;
  --md-sys-typescale-label-small-weight: 500;
  --md-sys-typescale-label-small-line-height: 1.455;
  --md-sys-typescale-label-small-tracking: 0.045em;

  /* GH #370, Kim's ruling 2026-07-30 (option (a) — "the role itself changes"): the kicker role's weight
     700 → 400 and tracking 0.08em → 0.2em ("all caps, 20% letter-spaced, 400 weight" — a kicker that is
     tightly tracked and BOLDER than the rows it eyebrows was never a kicker). All THREE sizes move
     together: a role whose sizes disagree on weight is not a role. Casing stays at the CONSUMER
     (text.css's \`[variant='kicker']\` uppercase treatment; nav-rail.css's context-label now matches it) —
     these are dimension tokens, so no transform axis was minted.
     THE RECORD: cl.2b's own table (and its overline row's "distinct from kicker by weight (500 vs 700)")
     described the pre-ruling values, and is corrected by an append-only amendment — see **ADR-0078
     REV 2026-07-30**, which restates the kicker row, records that overline is now the HEAVIER of the
     editorial pair, and carries the rest of this ruling's consequences. */
  /* extension — not MD3 (cl.2b): the headline eyebrow — label metrics at REGULAR weight, WIDELY tracked,
     + uppercase (text.css). Ink stays the one neutral on-surface role (ADR-0057 — color is not the
     load-bearing signifier). */
  --md-sys-typescale-kicker-large-weight: 400;
  --md-sys-typescale-kicker-large-line-height: 1.429;
  --md-sys-typescale-kicker-large-tracking: 0.2em;
  --md-sys-typescale-kicker-medium-weight: 400;
  --md-sys-typescale-kicker-medium-line-height: 1.333;
  --md-sys-typescale-kicker-medium-tracking: 0.2em;
  --md-sys-typescale-kicker-small-weight: 400;
  --md-sys-typescale-kicker-small-line-height: 1.455;
  --md-sys-typescale-kicker-small-tracking: 0.2em;

  /* extension — not MD3 (cl.2b): M2's overline heritage (10px/1.5px ≡ 0.15em, which M3 dropped) mapped
     onto label metrics + uppercase (text.css); distinct from kicker by weight (500 vs 400 since GH #370)
     + tracking (0.15em vs kicker's wider 0.2em). */
  --md-sys-typescale-overline-large-weight: 500;
  --md-sys-typescale-overline-large-line-height: 1.429;
  --md-sys-typescale-overline-large-tracking: 0.15em;
  --md-sys-typescale-overline-medium-weight: 500;
  --md-sys-typescale-overline-medium-line-height: 1.333;
  --md-sys-typescale-overline-medium-tracking: 0.15em;
  --md-sys-typescale-overline-small-weight: 500;
  --md-sys-typescale-overline-small-line-height: 1.455;
  --md-sys-typescale-overline-small-tracking: 0.15em;

  /* extension — not MD3 (cl.2b): the enlarged opening paragraph — body at title-class sizes with body's
     weight (lg borrows title-large's 22px at weight 400; sm ≡ body-large; md the midpoint). */
  --md-sys-typescale-lead-large-weight: 400;
  --md-sys-typescale-lead-large-line-height: 1.455;
  --md-sys-typescale-lead-large-tracking: 0;
  --md-sys-typescale-lead-medium-weight: 400;
  --md-sys-typescale-lead-medium-line-height: 1.444;
  --md-sys-typescale-lead-medium-tracking: 0;
  --md-sys-typescale-lead-small-weight: 400;
  --md-sys-typescale-lead-small-line-height: 1.5;
  --md-sys-typescale-lead-small-tracking: 0.031em;

  /* extension — not MD3 (cl.2b): block quotation — ≡ lead rows (own tokens, changeable independently);
     italic + rule + indent are text.css treatments, not typescale properties. */
  --md-sys-typescale-quote-large-weight: 400;
  --md-sys-typescale-quote-large-line-height: 1.455;
  --md-sys-typescale-quote-large-tracking: 0;
  --md-sys-typescale-quote-medium-weight: 400;
  --md-sys-typescale-quote-medium-line-height: 1.444;
  --md-sys-typescale-quote-medium-tracking: 0;
  --md-sys-typescale-quote-small-weight: 400;
  --md-sys-typescale-quote-small-line-height: 1.5;
  --md-sys-typescale-quote-small-tracking: 0.031em;
}

/* The DERIVED ramp lives on \`*\` (universal), NOT \`:root\` — deliberately. A var() inside a custom-property
   value is substituted where the property is DECLARED, not where it is read: declared on :root, every ramp
   token would freeze the :root values of --md-sys-scale/--md-sys-density (= 1) into a literal, so a SUBTREE
   [scale]/[density] (on a wrapper, not <html>) would repoint the multiplier but the ramp would never
   re-multiply — subtree scale/density would be dead. Declaring the ramp on \`*\` makes EACH element
   re-substitute the --md-sys-scale/--md-sys-density IT inherits, so subtree repointing works. Do NOT "simplify"
   this back onto :root — that re-breaks subtree scale/density. (~9 inheritable custom-prop declarations per
   element; declarations don't trigger layout/paint, so the cost is negligible.) */
* {
  /* Control HEIGHT + FONT + ICON are NO LONGER on this \`*\` ramp — ADR-0038 makes all three explicit Kim's-table
     per-[scale] literals (:root default + the [scale] selectors, the #25 --md-sys-compact pattern); \`× var(--md-sys-scale)\`
     left the control path. What stays on \`*\` below is genuinely DERIVED (a var() over a subtree-repointable
     multiplier that MUST re-substitute per element): the gap (× --md-sys-density, reads the inherited --md-sys-font),
     --md-sys-typescale-*-size (× --md-sys-scale, the surviving DISPLAY consumer), and --md-sys-space-* (× --md-sys-density). */

  /* Rhythm: the gap = font / 2, and density rides it (× var(--md-sys-density)). This is the ONE quantity
     density touches — the frame (height/font/inline-pad) is density-invariant. (gap also carries scale,
     via font.) A control reads \`--md-sys-gap-{size}\` for its slot↔label spacing. */
  --md-sys-gap-sm: calc(var(--md-sys-font-sm) / 2 * var(--md-sys-density));
  --md-sys-gap-md: calc(var(--md-sys-font-md) / 2 * var(--md-sys-density));
  --md-sys-gap-lg: calc(var(--md-sys-font-lg) / 2 * var(--md-sys-density));

  /* --md-sys-typescale-*-size (ADR-0078 cl.2 — retires ADR-0025 cl.3's --ui-type-*-size) — the fleet
     typographic scale's ONE scale-riding leg, a peer of --md-sys-font-* but a SEPARATE ledger: --md-sys-font-* is
     the control-band glyph (paired to --md-sys-height-*, the square-centring law); the typescale is free-
     standing DOCUMENT typography (its own line-height, no control frame). Rides [scale] (× var(--md-sys-scale))
     — the same pre-substitution reason as --md-sys-font-*, so a subtree [scale] re-multiplies type — and is
     declared on \`*\` (NOT :root) so each element re-substitutes the --md-sys-scale it inherits. Type is DENSITY-
     INVARIANT: glyph size is a frame-family quantity, not rhythm, so NO var(--md-sys-density) here ([density]
     re-multiplies gaps only — geometry.md's frame/rhythm split). The 27 rows are M3-verbatim (15 core) +
     editorial extensions (12, cl.2b, marked); the scale-free -weight/-line-height/-tracking legs are :root
     constants (above). */
  --md-sys-typescale-display-large-size: calc(57px * var(--md-sys-scale));
  --md-sys-typescale-display-medium-size: calc(45px * var(--md-sys-scale));
  --md-sys-typescale-display-small-size: calc(36px * var(--md-sys-scale));
  --md-sys-typescale-headline-large-size: calc(32px * var(--md-sys-scale));
  --md-sys-typescale-headline-medium-size: calc(28px * var(--md-sys-scale));
  --md-sys-typescale-headline-small-size: calc(24px * var(--md-sys-scale));
  --md-sys-typescale-title-large-size: calc(22px * var(--md-sys-scale));
  --md-sys-typescale-title-medium-size: calc(16px * var(--md-sys-scale));
  --md-sys-typescale-title-small-size: calc(14px * var(--md-sys-scale));
  --md-sys-typescale-body-large-size: calc(16px * var(--md-sys-scale));
  --md-sys-typescale-body-medium-size: calc(14px * var(--md-sys-scale));
  --md-sys-typescale-body-small-size: calc(12px * var(--md-sys-scale));
  --md-sys-typescale-label-large-size: calc(14px * var(--md-sys-scale));
  --md-sys-typescale-label-medium-size: calc(12px * var(--md-sys-scale));
  --md-sys-typescale-label-small-size: calc(11px * var(--md-sys-scale));
  /* extension — not MD3 (cl.2b) */
  --md-sys-typescale-kicker-large-size: calc(14px * var(--md-sys-scale));
  --md-sys-typescale-kicker-medium-size: calc(12px * var(--md-sys-scale));
  --md-sys-typescale-kicker-small-size: calc(11px * var(--md-sys-scale));
  --md-sys-typescale-overline-large-size: calc(14px * var(--md-sys-scale));
  --md-sys-typescale-overline-medium-size: calc(12px * var(--md-sys-scale));
  --md-sys-typescale-overline-small-size: calc(11px * var(--md-sys-scale));
  --md-sys-typescale-lead-large-size: calc(22px * var(--md-sys-scale));
  --md-sys-typescale-lead-medium-size: calc(18px * var(--md-sys-scale));
  --md-sys-typescale-lead-small-size: calc(16px * var(--md-sys-scale));
  --md-sys-typescale-quote-large-size: calc(22px * var(--md-sys-scale));
  --md-sys-typescale-quote-medium-size: calc(18px * var(--md-sys-scale));
  --md-sys-typescale-quote-small-size: calc(16px * var(--md-sys-scale));

  /* --md-sys-space — the LAYOUT-SPACING ladder (ADR-0015 cl.4, geometry.md "--space-* is layout spacing,
     not control geometry"). The gap/padding/margin BETWEEN laid-out children (Row/Column/List/Grid gap,
     Card padding) — a DIFFERENT ledger from the control frame (the h/2 centring law). Two rules set it
     apart from the ramp above:
       • density rides it (rhythm family): each step is \`calc(<base px> * var(--md-sys-density))\`, so a subtree
         [density] re-multiplies it (declared on \`*\`, not :root — same pre-substitution reason as the gap).
       • [scale] does NOT touch it: the base px is a LITERAL (no var(--md-sys-scale)), because layout rhythm is
         not control-frame size — a [scale] theme resizes the controls, not the gutters between them.
     A 4px-grid t-shirt vocabulary; \`none\`=0 (the no-gap case). The flexProps \`gap\` enum (s2) is exactly
     these step names. Extensible (add 3xl… with the family) — repointing a value is seam-stable; a new
     step name widens the gap enum (a deliberate addition, not drift). */
  --md-sys-space-none: 0;
  --md-sys-space-xs: calc(4px * var(--md-sys-density));
  --md-sys-space-sm: calc(8px * var(--md-sys-density));
  --md-sys-space-md: calc(12px * var(--md-sys-density));
  --md-sys-space-lg: calc(16px * var(--md-sys-density));
  --md-sys-space-xl: calc(24px * var(--md-sys-density));
  --md-sys-space-2xl: calc(32px * var(--md-sys-density));

  /* --ui-bar-inline-inset — the fleet's ONE bar-content inline inset (GH #626, Kim-ruled 2026-08-09).
     Deliberately a cross-component \`--ui-*\` role, not a per-control one: it is the shared rhythm that
     lets separately-owned boxes on DIFFERENT sides of a bar boundary land on the same x. A bar itself
     is a padding-less RAIL (background + seam only — GH #543's \`ui-tabs\` tablist precedent, generalised
     to \`ui-super-shell\`'s \`[data-part='bar']\` here); its CONTENTS carry the inset, and they read it from
     this one token so a bar-hosted column and a canvas-hosted column stay aligned by construction
     instead of by two hand-matched literals. That is what GH #626 fixed: the docs site's app footer sat
     6px (\`module / 3\`) further in than the pager below it, because the bar owned padding the pager's
     region did not.
     The stop is \`xl\` (24px): the docs site's reading column already insets 24px each side
     (\`min(64rem, 100% - 3rem)\`, \`_page.css\`), and \`.app-context-header\` already spelled that same 24px
     as \`--md-sys-space-xl\` — this names the value the site had converged on rather than introducing a
     new one, so the pick is visually a no-op for the canvas column and a −6px correction for bar content.
     Rides [density] through the ramp; untouched by [scale] (layout rhythm, not control frame). */
  --ui-bar-inline-inset: var(--md-sys-space-xl);
}

/* extension — not MD3 (ADR-0150): the compact-window body register — the token layer's ONE
   viewport-responsive lever. Below 52.5rem (840px, M3's compact/medium window boundary — a documented
   LITERAL: custom properties are invalid in media-query conditions, so this value cannot be tokenized;
   a second use repeats it verbatim and cites ADR-0150) the body COLUMN drops 1px: 16/14/12 → 15/13/11.
   ONLY the three body -size legs move — every other role, all :root constants (unitless line-height
   compresses proportionally by design), and the ADR-0038 control ladder are untouched. Declared on \`*\`
   (NOT :root — the same pre-substitution law as the ramp above: a :root override would freeze
   --md-sys-scale at 1 and kill subtree [scale] below the line) and AFTER the base ramp — both blocks
   are specificity 0,0,0 and a media query adds none, so LATER DECLARATION is the only thing that makes
   this win. Do not move this block above the base \`*\` ramp. */
@media (width < 52.5rem) {
  * {
    --md-sys-typescale-body-large-size: calc(15px * var(--md-sys-scale));
    --md-sys-typescale-body-medium-size: calc(13px * var(--md-sys-scale));
    --md-sys-typescale-body-small-size: calc(11px * var(--md-sys-scale));
  }
}

/* [scale] — Kim's (scale × size) → §1-row LOOKUP selector (ADR-0038, supersedes ADR-0032's multiplier ladder
   for CONTROLS). Each tier re-tables --md-sys-{height,font,icon}-{sm,md,lg} to its chosen §1 row (height picks the
   row; font/icon derive from it — ONE consistent row per cell, the thing the multiplier broke). Descendants
   inherit the re-tabled tokens, so subtree [scale] works WITHOUT --md-sys-scale (the #25 --md-sys-compact proof). The
   tiers ALSO re-table --md-sys-compact-* (the WIDGET-BOX ramp, ADR-0041 — now CONSUMED by Indicator/Range). Two
   bands by reading distance — ui-* tight (UI
   density), content-* generous (reading density) — and content-* is the ui-* band SHIFTED UP ONE §1 row, so
   content-sm ≡ ui-md and content-md ≡ ui-lg (Kim's design: 6 names → 4 distinct registers; only content-lg
   exceeds the ui band). ui-md is the DEFAULT (= :root, byte-identical). Each tier STILL sets --md-sys-scale to its
   tier value — but ONLY --md-sys-typescale-*-size (DISPLAY, the ADR-0025/0033 ruled-linear fork) reads it now; --md-sys-scale
   has LEFT the control path (controls are the explicit literals above/here). */
[scale="ui-sm"] {
  --md-sys-scale: 0.875;
  --md-sys-height-sm: 20px;
  --md-sys-height-md: 24px;
  --md-sys-height-lg: 28px;
  --md-sys-font-sm: 12px;
  --md-sys-font-md: 13px;
  --md-sys-font-lg: 14px;
  --md-sys-icon-sm: 14px;
  --md-sys-icon-md: 16px;
  --md-sys-icon-lg: 18px;
  --md-sys-compact-sm: 12px;
  --md-sys-compact-md: 14px;
  --md-sys-compact-lg: 16px;
}
[scale="ui-md"] {
  --md-sys-scale: 1;
  --md-sys-height-sm: 24px;
  --md-sys-height-md: 28px;
  --md-sys-height-lg: 36px;
  --md-sys-font-sm: 13px;
  --md-sys-font-md: 14px;
  --md-sys-font-lg: 16px;
  --md-sys-icon-sm: 16px;
  --md-sys-icon-md: 18px;
  --md-sys-icon-lg: 20px;
  --md-sys-compact-sm: 14px;
  --md-sys-compact-md: 16px;
  --md-sys-compact-lg: 18px;
}
[scale="ui-lg"] {
  --md-sys-scale: 1.125;
  --md-sys-height-sm: 28px;
  --md-sys-height-md: 36px;
  --md-sys-height-lg: 48px;
  --md-sys-font-sm: 14px;
  --md-sys-font-md: 16px;
  --md-sys-font-lg: 18px;
  --md-sys-icon-sm: 18px;
  --md-sys-icon-md: 20px;
  --md-sys-icon-lg: 24px;
  --md-sys-compact-sm: 16px;
  --md-sys-compact-md: 18px;
  --md-sys-compact-lg: 20px;
}
[scale="content-sm"] {
  --md-sys-scale: 1.375;
  --md-sys-height-sm: 24px;
  --md-sys-height-md: 28px;
  --md-sys-height-lg: 36px;
  --md-sys-font-sm: 13px;
  --md-sys-font-md: 14px;
  --md-sys-font-lg: 16px;
  --md-sys-icon-sm: 16px;
  --md-sys-icon-md: 18px;
  --md-sys-icon-lg: 20px;
  --md-sys-compact-sm: 18px;
  --md-sys-compact-md: 20px;
  --md-sys-compact-lg: 22px;
}
[scale="content-md"] {
  --md-sys-scale: 1.5;
  --md-sys-height-sm: 28px;
  --md-sys-height-md: 36px;
  --md-sys-height-lg: 48px;
  --md-sys-font-sm: 14px;
  --md-sys-font-md: 16px;
  --md-sys-font-lg: 18px;
  --md-sys-icon-sm: 18px;
  --md-sys-icon-md: 20px;
  --md-sys-icon-lg: 24px;
  --md-sys-compact-sm: 20px;
  --md-sys-compact-md: 22px;
  --md-sys-compact-lg: 24px;
}
[scale="content-lg"] {
  --md-sys-scale: 1.75;
  --md-sys-height-sm: 36px;
  --md-sys-height-md: 48px;
  --md-sys-height-lg: 64px;
  --md-sys-font-sm: 16px;
  --md-sys-font-md: 18px;
  --md-sys-font-lg: 20px;
  --md-sys-icon-sm: 20px;
  --md-sys-icon-md: 24px;
  --md-sys-icon-lg: 28px;
  --md-sys-compact-sm: 22px;
  --md-sys-compact-md: 24px;
  --md-sys-compact-lg: 28px;
}

/* [density] — multiplies the RHYTHM only (the gap), never the frame (geometry.md). Repoints --md-sys-density,
   so the gap recomputes while height/font/inline-pad hold. */
[density="compact"] {
  --md-sys-density: 0.5;
}
[density="comfortable"] {
  --md-sys-density: 1;
}
[density="spacious"] {
  --md-sys-density: 1.5;
}
`,m=o(f);if(m.length===0)throw Error(`tokens.ts: parseColorRoles resolved 0 roles — tokens.css did not match the expected :root shape`);var h=d(m),g=l(f);if(Object.keys(g).length===0)throw Error(`tokens.ts: parseColorPrimitives resolved 0 families — tokens.css did not match the expected :root shape`);var _=[{prefix:`md-sys-height`,label:`--md-sys-height-*`,note:`The Control-class block-size (button · text-field · select · field) — the frame the h/2 centring law measures from.`},{prefix:`md-sys-font`,label:`--md-sys-font-*`,note:`The control-band glyph size, paired 1:1 with --md-sys-height-* (the square-centring law) — never the document type scale.`},{prefix:`md-sys-icon`,label:`--md-sys-icon-*`,note:`The fixed CONTENT-icon register (a field’s leading icon, a status glyph) — distinct from an inline affordance, which is sized = font.`},{prefix:`md-sys-compact`,label:`--md-sys-compact-*`,note:`The Indicator/Range widget-box ramp (checkbox · switch · radio · slider) — a separate size system from Control height.`},{prefix:`md-sys-space`,label:`--md-sys-space-*`,note:`Layout spacing BETWEEN components (gaps, padding, margin) — density-derived, never control geometry (geometry.md’s "not interchangeable" rule).`}];for(let{prefix:e}of _)if(s(`/* dimensions.css — the dimensional token ramp (geometry.md, the law; values from geometry-sizing-spec.md
 * §1, the hand-tabled ramp). The CONTROL band: per-size height + font for sm/md/lg, plus the two global
 * multipliers the geometry consumes — [scale] (the frame size) and [density] (the rhythm).
 *
 * The two families (geometry.md): FRAME ∝ height (height, inline-pad, min-inline-size, radius) and RHYTHM
 * ∝ font (gap = font/2, caret = font). [scale] multiplies BOTH the frame and the font; [density] multiplies
 * the RHYTHM ONLY (the gap) — never the frame, since scaling the frame un-centers the glyph and breaks the
 * square. So height/font carry \`var(--md-sys-scale)\`; the gap carries \`var(--md-sys-density)\` (and font, hence scale).
 *
 * Loaded AFTER tokens.css (color) in the foundation CSS stack; consumed by a control's \`:where(ui-{cmp})\`
 * block (e.g. button.css repoints \`--ui-button-height: var(--md-sys-height-md)\` etc.). Pure tokens — no imports.
 */

:root {
  /* The two global multipliers. Default = 1; an ancestor [scale]/[density] repoints them for its subtree
     (custom properties inherit, so the nearest ancestor wins by cascade proximity). */
  --md-sys-scale: 1;
  --md-sys-density: 1;

  /* --md-sys-compact-* — the WIDGET-BOX ramp (ADR-0041; Kim's 8-value ramp 12·14·16·18·20·22·24·28). The box of
     the Indicator (checkbox/switch/radio) + Range (slider) classes — a SEPARATE size system from the Control
     height (geometry-sizing-spec §5.1), so NOT --md-sys-height-*. Same explicit lookup as ADR-0038: a LITERAL
     per-[scale] table (:root default + the [scale] selectors re-table it; [size] picks sm/md/lg), NO --md-sys-scale
     multiplier — so it can't ride \`*\` (a literal on \`*\` re-declares per descendant and defeats subtree
     inheritance). ui-md default 14·16·18 (byte-identical to the §5.2 default). Unlike the control fonts, the 6
     tiers are ALL-DISTINCT (the widget ramp is dense/linear — no content-sm ≡ ui-md overlap). */
  --md-sys-compact-sm: 14px;
  --md-sys-compact-md: 16px;
  --md-sys-compact-lg: 18px;

  /* --md-sys-widget-inset (ADR-0041 cl.3) — the THUMB inset law for thumbed widgets (switch knob, slider handle):
     thumb = box − 2×inset, track = the widget box. A FLAT fleet CONSTANT (like a 1px border / --md-sys-shape-corner-base),
     NOT box-scaled — 2px reads correctly from the 12-box to the 28-box. Geometric (frame family) → density-
     INVARIANT (density rides the gap, never the inset). On :root, not the \`*\` ramp. */
  --md-sys-widget-inset: 2px;

  /* Control-band HEIGHT + FONT + ICON — Kim's explicit (scale × size) → §1-row LOOKUP (ADR-0038, supersedes
     the MULTIPLIER: ADR-0007's control leg + ADR-0032's 0.875…1.75 ladder; re-tables ADR-0035's non-default
     font/icon). The ui-md default triples (height 24·28·36, font 13·14·16, icon 16·18·20 — byte-identical to
     today); each [scale] tier re-tables ALL THREE below to its §1 row — height picks the row, font/icon/caret/
     gap/pad all derive from that ONE row (the consistency the multiplier broke). NO multiplier: \`× var(--md-sys-
     scale)\` LEAVES the control path entirely; --md-sys-scale survives for --md-sys-typescale-*-size DISPLAY only (below). LITERALS,
     so they sit on :root (default) + the [scale] selectors, NEVER \`*\` (a literal on \`*\` re-declares per
     descendant and defeats subtree inheritance — the #25 --md-sys-compact proof). gap = font/2 (on \`*\`, reads the
     inherited --md-sys-font) + caret = font follow for free. Kim's band overlap: content-sm ≡ ui-md, content-md ≡
     ui-lg (the 6 [scale] names render 4 distinct registers). */
  --md-sys-height-sm: 24px;
  --md-sys-height-md: 28px;
  --md-sys-height-lg: 36px;

  --md-sys-font-sm: 13px;
  --md-sys-font-md: 14px;
  --md-sys-font-lg: 16px;

  --md-sys-icon-sm: 16px;
  --md-sys-icon-md: 18px;
  --md-sys-icon-lg: 20px;

  /* Single-line control line-height (ADR-0036) — a CONSTANT 1: a control glyph is ONE line centred in the
     frame by the h/2 law, so line-height 1 keeps the text box = the font box (a >1 leading would inflate the
     line box and fight the square-centring). Controls read \`line-height: var(--md-sys-control-line-height)\` on
     :scope. Not [scale]/[density]-derived → :root, like the focus-ring / motion constants. */
  --md-sys-control-line-height: 1;

  /* Focus-ring geometry (ADR-0009) — CONSTANTS, not derived via a subtree-repointable multiplier, so they
     stay on :root, NOT on \`*\`: ADR-0007's universal-selector rule covers only DERIVED tokens (a var() over
     --md-sys-scale/--md-sys-density that must re-substitute per element); a constant on \`*\` would be needless churn.
     2px width / 2px offset — the shared ring every control's \`:focus-visible\` outline reads. */
  --md-sys-state-focus-ring-width: 2px;
  --md-sys-state-focus-ring-offset: 2px;

  /* Unobtrusive-scrollbar affordance (GH #867) — the shared thin/auto-hiding scroll-surface geometry: a
     CONSTANT (no [scale]/[density] multiplier — a scrollbar gutter does not resize with the control ramp),
     so it sits on :root like the focus-ring geometry above, NOT the \`*\` ramp. Feeds BOTH engines' knobs from
     ONE number: Firefox's \`scrollbar-width: thin\` keyword (unitless, reads no token) plus \`::-webkit-
     scrollbar { width/height }\` (Chromium/WebKit, which has no "thin" keyword of its own) — so this constant
     is the WebKit leg's own thin-ness, and the thumb radius derives from it (half the gutter) rather than a
     second hand-tuned number. A component mints its own-chain \`--ui-{cmp}-scrollbar-size\` from this in its
     \`:where()\` token block and consumes THAT in \`@scope\`, same as every other dimensional constant here. */
  --md-sys-scrollbar-size: 8px;

  /* Motion (the interaction-states standard) — state-transition timing. CONSTANTS (no var() over a
     subtree-repointable multiplier), so on :root like the focus-ring geometry, NOT the \`*\` ramp. A control's
     \`@scope\` block transitions its state-PAINT properties (background/colour/border) over --md-sys-motion-duration-fast —
     and one non-paint exception: state-driven \`transform\` (a moving selection indicator, e.g.
     ui-segmented-control's \`::before\` that slides between segments, ADR-0095 — the presentation ADR-0086
     originally minted on \`ui-radio-group[variant='segmented']\`, since promoted to its own standalone tag).
     That is exempt because it is compositor-only — it causes no reflow and the indicator's SIZE still snaps;
     only its POSITION animates, so it does not fight the sizing law. Still NEVER a [scale]/[density]/[size]
     sizing-ramp change (those must snap — animating the ramp fights the sizing law). prefers-reduced-motion is
     honoured at the consumption site (the control zeroes the transition). */
  --md-sys-motion-duration-fast: 300ms;
  --md-sys-motion-easing-standard: cubic-bezier(0.25, 0.1, 0.25, 1); /* Apple "smooth" easing */

  /* Pending/stale-content convention (ADR-0191, GH #974's companion styling half; booked repair GH #999) —
     the fleet-wide \`:state(pending)\` host custom state's own token pair (TKT-0062's filled-state-law SHAPE
     re-applied to async staleness — interaction-states.md §5). \`--ui-pending-duration\` ALIASES
     \`--md-sys-motion-duration-fast\` (no new motion token — the ui-drawer/ADR-0188 cl.5 precedent applied
     here too) — a plain :root CONSTANT, like the motion pair above (no [scale]/[density] multiplier).
     \`--ui-pending-opacity\` is a genuinely NEW literal (\`0.6\`) — the stale-content DIM step (never a
     recolor: TKT-0062's bg/border/ink law stays untouched under it; pending content can be arbitrary,
     unknown-depth DOM, which a role-repoint cannot reach in general), grounded in TKT-0047's disabled-
     opacity multi-layer-stacking exception, NOT a nonexistent "disabled defaults to opacity" convention
     (the fleet's disabled canon is role-repoint). Both are \`--ui-*\` fleet-wide constants, NOT on the
     sanctioned direct-read list (tokens.md's Consumption invariants, TKT-0066 item 5) — a component routes
     them through its OWN \`--ui-{cmp}-*\` chain, e.g.
     \`--ui-status-stream-pending-opacity: var(--ui-pending-opacity);\` in the control's \`:where()\` block. */
  --ui-pending-duration: var(--md-sys-motion-duration-fast);
  --ui-pending-opacity: 0.6;

  /* Working/live-surface-mutation convention (ADR-0199, GH #1104) — the fleet-wide \`:state(working)\`
     breathing treatment's constants (interaction-states.md §7). \`--ui-working-duration\` is the fleet's
     FIRST LOOP-motion literal, deliberately NOT an alias of \`--md-sys-motion-duration-fast\` (300ms is a
     state-TRANSITION duration; a breathing half-cycle at 300ms is a strobe, not a breath — ADR-0199
     cl.4): ~1.6s per half-cycle (≈3.2s full breath, ≈0.3Hz, the calm-ambient band). The opacity pair is
     the breath's two rungs on the ::after overlay (the overlay's OPACITY animates — compositor-only —
     never the box-shadow value itself); \`--ui-working-blur\` is the "large diffused" inset spread, a
     paint constant like the focus-ring width (no [scale] ramp participation — it never animates). All
     :root CONSTANTS, and NOT on the sanctioned direct-read list (TKT-0066 item 5) — a consuming control
     routes them through its OWN chain, e.g. \`--ui-surface-host-working-duration:
     var(--ui-working-duration);\` in the control's \`:where()\` block. The color half of the treatment
     (\`--ui-working-color\`) lives in tokens.css. */
  --ui-working-duration: 1600ms;
  --ui-working-opacity-min: 0.15;
  --ui-working-opacity-max: 0.55;
  --ui-working-blur: 24px;

  /* Container radius (ADR-0015 cl.5) — ONE shared fleet radius. A CONSTANT on :root, NOT the \`*\` ramp:
     unlike a control's pill radius (frame family ∝ height, scaled), a container's corner radius is fixed
     regardless of [scale] (the ADR is explicit — "not subtree-derived"). A root container reads
     \`border-radius: var(--ui-card-radius, var(--md-sys-shape-corner-base))\`; it seeds the one-level nested-radius
     chain (ADR-0018: child = max(0px, radius − padding)) and is the radius the ui-text-field follow-up
     (#71) adopts — one referent serving controls and containers. */
  --md-sys-shape-corner-base: 12px;

  /* Monospace family — the shared typeface CONSTANT for code/figure surfaces (code blocks, inline-code
     chips, captions). A :root constant like the focus-ring / radius constants, NOT the \`*\` ramp: a
     font-family carries no [scale]/[density] multiplier (it has no scheme/AA/forced-colors dimension
     either — it is a typeface, not a colour role). Named --md-sys-typeface-mono (NOT --md-sys-font-*) to stay clear of the
     --md-sys-font-{sm,md,lg} SIZE namespace and the :root \`--md-sys-font\` guard (dimensions.test.ts). */
  --md-sys-typeface-mono: ui-monospace, SFMono-Regular, Menlo, monospace;

  /* Sans (UI) family — the shared typeface constant for everything else: the document base layer
     (base.css) and any host chrome consume it, so the fleet's one sans stack has ONE home (it was
     previously hand-rolled in the docs shell's _page.css only, and a shell-less page fell back to the
     UA serif). Same constant class + naming rationale as --md-sys-typeface-mono above. */
  --md-sys-typeface-sans: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;

  /* Type scale (ADR-0078 cl.2/cl.2b — retires ADR-0025 cl.3's --ui-type-*) — the fleet typographic ramp,
     now the M3 typescale namespace: --md-sys-typescale-{role}-{size}-{property}, role ∈ display/headline/
     title/body/label (M3-verbatim, cl.2) + kicker/overline/quote/lead (editorial extensions, cl.2b), size ∈
     large/medium/small (M3 spelling, NOT lg/md/sm — the sm/md/lg ↔ large/medium/small mapping is text.css's
     job). -weight/-line-height/-tracking are CONSTANTS on :root (like the focus-ring / motion constants),
     NOT the \`*\` ramp: none rides [scale]/[density] — a subtree theme rescales the -size leg only (below).
     -line-height is UNITLESS (M3 line-height-px ÷ M3 size-px, 3dp — so it scales WITH the already-scaled
     -size). -tracking is EM (M3 tracking-px ÷ M3 size-px, 3dp; literal 0 where M3 tracking is 0 — letter-
     spacing rides font-size naturally under [scale]). A control never reads these — ui-text reads
     --ui-text-* (text.css), which repoints to this family. The 15 M3-core rows are verbatim against the
     canonical MD3 default type scale (m3.material.io / material-web tokens v0.192 — verified 2026-07-04);
     the 12 extension rows are marked, each derived from an M3 anchor (ADR-0078 cl.2b). */
  --md-sys-typescale-display-large-weight: 400;
  --md-sys-typescale-display-large-line-height: 1.123;
  --md-sys-typescale-display-large-tracking: -0.004em;
  --md-sys-typescale-display-medium-weight: 400;
  --md-sys-typescale-display-medium-line-height: 1.156;
  --md-sys-typescale-display-medium-tracking: 0;
  --md-sys-typescale-display-small-weight: 400;
  --md-sys-typescale-display-small-line-height: 1.222;
  --md-sys-typescale-display-small-tracking: 0;

  --md-sys-typescale-headline-large-weight: 400;
  --md-sys-typescale-headline-large-line-height: 1.25;
  --md-sys-typescale-headline-large-tracking: 0;
  --md-sys-typescale-headline-medium-weight: 400;
  --md-sys-typescale-headline-medium-line-height: 1.286;
  --md-sys-typescale-headline-medium-tracking: 0;
  --md-sys-typescale-headline-small-weight: 400;
  --md-sys-typescale-headline-small-line-height: 1.333;
  --md-sys-typescale-headline-small-tracking: 0;

  --md-sys-typescale-title-large-weight: 400;
  --md-sys-typescale-title-large-line-height: 1.273;
  --md-sys-typescale-title-large-tracking: 0;
  --md-sys-typescale-title-medium-weight: 500;
  --md-sys-typescale-title-medium-line-height: 1.5;
  --md-sys-typescale-title-medium-tracking: 0.009em;
  --md-sys-typescale-title-small-weight: 500;
  --md-sys-typescale-title-small-line-height: 1.429;
  --md-sys-typescale-title-small-tracking: 0.007em;

  --md-sys-typescale-body-large-weight: 400;
  --md-sys-typescale-body-large-line-height: 1.5;
  --md-sys-typescale-body-large-tracking: 0.031em;
  --md-sys-typescale-body-medium-weight: 400;
  --md-sys-typescale-body-medium-line-height: 1.429;
  --md-sys-typescale-body-medium-tracking: 0.018em;
  --md-sys-typescale-body-small-weight: 400;
  --md-sys-typescale-body-small-line-height: 1.333;
  --md-sys-typescale-body-small-tracking: 0.033em;

  --md-sys-typescale-label-large-weight: 500;
  --md-sys-typescale-label-large-line-height: 1.429;
  --md-sys-typescale-label-large-tracking: 0.007em;
  --md-sys-typescale-label-medium-weight: 500;
  --md-sys-typescale-label-medium-line-height: 1.333;
  --md-sys-typescale-label-medium-tracking: 0.042em;
  --md-sys-typescale-label-small-weight: 500;
  --md-sys-typescale-label-small-line-height: 1.455;
  --md-sys-typescale-label-small-tracking: 0.045em;

  /* GH #370, Kim's ruling 2026-07-30 (option (a) — "the role itself changes"): the kicker role's weight
     700 → 400 and tracking 0.08em → 0.2em ("all caps, 20% letter-spaced, 400 weight" — a kicker that is
     tightly tracked and BOLDER than the rows it eyebrows was never a kicker). All THREE sizes move
     together: a role whose sizes disagree on weight is not a role. Casing stays at the CONSUMER
     (text.css's \`[variant='kicker']\` uppercase treatment; nav-rail.css's context-label now matches it) —
     these are dimension tokens, so no transform axis was minted.
     THE RECORD: cl.2b's own table (and its overline row's "distinct from kicker by weight (500 vs 700)")
     described the pre-ruling values, and is corrected by an append-only amendment — see **ADR-0078
     REV 2026-07-30**, which restates the kicker row, records that overline is now the HEAVIER of the
     editorial pair, and carries the rest of this ruling's consequences. */
  /* extension — not MD3 (cl.2b): the headline eyebrow — label metrics at REGULAR weight, WIDELY tracked,
     + uppercase (text.css). Ink stays the one neutral on-surface role (ADR-0057 — color is not the
     load-bearing signifier). */
  --md-sys-typescale-kicker-large-weight: 400;
  --md-sys-typescale-kicker-large-line-height: 1.429;
  --md-sys-typescale-kicker-large-tracking: 0.2em;
  --md-sys-typescale-kicker-medium-weight: 400;
  --md-sys-typescale-kicker-medium-line-height: 1.333;
  --md-sys-typescale-kicker-medium-tracking: 0.2em;
  --md-sys-typescale-kicker-small-weight: 400;
  --md-sys-typescale-kicker-small-line-height: 1.455;
  --md-sys-typescale-kicker-small-tracking: 0.2em;

  /* extension — not MD3 (cl.2b): M2's overline heritage (10px/1.5px ≡ 0.15em, which M3 dropped) mapped
     onto label metrics + uppercase (text.css); distinct from kicker by weight (500 vs 400 since GH #370)
     + tracking (0.15em vs kicker's wider 0.2em). */
  --md-sys-typescale-overline-large-weight: 500;
  --md-sys-typescale-overline-large-line-height: 1.429;
  --md-sys-typescale-overline-large-tracking: 0.15em;
  --md-sys-typescale-overline-medium-weight: 500;
  --md-sys-typescale-overline-medium-line-height: 1.333;
  --md-sys-typescale-overline-medium-tracking: 0.15em;
  --md-sys-typescale-overline-small-weight: 500;
  --md-sys-typescale-overline-small-line-height: 1.455;
  --md-sys-typescale-overline-small-tracking: 0.15em;

  /* extension — not MD3 (cl.2b): the enlarged opening paragraph — body at title-class sizes with body's
     weight (lg borrows title-large's 22px at weight 400; sm ≡ body-large; md the midpoint). */
  --md-sys-typescale-lead-large-weight: 400;
  --md-sys-typescale-lead-large-line-height: 1.455;
  --md-sys-typescale-lead-large-tracking: 0;
  --md-sys-typescale-lead-medium-weight: 400;
  --md-sys-typescale-lead-medium-line-height: 1.444;
  --md-sys-typescale-lead-medium-tracking: 0;
  --md-sys-typescale-lead-small-weight: 400;
  --md-sys-typescale-lead-small-line-height: 1.5;
  --md-sys-typescale-lead-small-tracking: 0.031em;

  /* extension — not MD3 (cl.2b): block quotation — ≡ lead rows (own tokens, changeable independently);
     italic + rule + indent are text.css treatments, not typescale properties. */
  --md-sys-typescale-quote-large-weight: 400;
  --md-sys-typescale-quote-large-line-height: 1.455;
  --md-sys-typescale-quote-large-tracking: 0;
  --md-sys-typescale-quote-medium-weight: 400;
  --md-sys-typescale-quote-medium-line-height: 1.444;
  --md-sys-typescale-quote-medium-tracking: 0;
  --md-sys-typescale-quote-small-weight: 400;
  --md-sys-typescale-quote-small-line-height: 1.5;
  --md-sys-typescale-quote-small-tracking: 0.031em;
}

/* The DERIVED ramp lives on \`*\` (universal), NOT \`:root\` — deliberately. A var() inside a custom-property
   value is substituted where the property is DECLARED, not where it is read: declared on :root, every ramp
   token would freeze the :root values of --md-sys-scale/--md-sys-density (= 1) into a literal, so a SUBTREE
   [scale]/[density] (on a wrapper, not <html>) would repoint the multiplier but the ramp would never
   re-multiply — subtree scale/density would be dead. Declaring the ramp on \`*\` makes EACH element
   re-substitute the --md-sys-scale/--md-sys-density IT inherits, so subtree repointing works. Do NOT "simplify"
   this back onto :root — that re-breaks subtree scale/density. (~9 inheritable custom-prop declarations per
   element; declarations don't trigger layout/paint, so the cost is negligible.) */
* {
  /* Control HEIGHT + FONT + ICON are NO LONGER on this \`*\` ramp — ADR-0038 makes all three explicit Kim's-table
     per-[scale] literals (:root default + the [scale] selectors, the #25 --md-sys-compact pattern); \`× var(--md-sys-scale)\`
     left the control path. What stays on \`*\` below is genuinely DERIVED (a var() over a subtree-repointable
     multiplier that MUST re-substitute per element): the gap (× --md-sys-density, reads the inherited --md-sys-font),
     --md-sys-typescale-*-size (× --md-sys-scale, the surviving DISPLAY consumer), and --md-sys-space-* (× --md-sys-density). */

  /* Rhythm: the gap = font / 2, and density rides it (× var(--md-sys-density)). This is the ONE quantity
     density touches — the frame (height/font/inline-pad) is density-invariant. (gap also carries scale,
     via font.) A control reads \`--md-sys-gap-{size}\` for its slot↔label spacing. */
  --md-sys-gap-sm: calc(var(--md-sys-font-sm) / 2 * var(--md-sys-density));
  --md-sys-gap-md: calc(var(--md-sys-font-md) / 2 * var(--md-sys-density));
  --md-sys-gap-lg: calc(var(--md-sys-font-lg) / 2 * var(--md-sys-density));

  /* --md-sys-typescale-*-size (ADR-0078 cl.2 — retires ADR-0025 cl.3's --ui-type-*-size) — the fleet
     typographic scale's ONE scale-riding leg, a peer of --md-sys-font-* but a SEPARATE ledger: --md-sys-font-* is
     the control-band glyph (paired to --md-sys-height-*, the square-centring law); the typescale is free-
     standing DOCUMENT typography (its own line-height, no control frame). Rides [scale] (× var(--md-sys-scale))
     — the same pre-substitution reason as --md-sys-font-*, so a subtree [scale] re-multiplies type — and is
     declared on \`*\` (NOT :root) so each element re-substitutes the --md-sys-scale it inherits. Type is DENSITY-
     INVARIANT: glyph size is a frame-family quantity, not rhythm, so NO var(--md-sys-density) here ([density]
     re-multiplies gaps only — geometry.md's frame/rhythm split). The 27 rows are M3-verbatim (15 core) +
     editorial extensions (12, cl.2b, marked); the scale-free -weight/-line-height/-tracking legs are :root
     constants (above). */
  --md-sys-typescale-display-large-size: calc(57px * var(--md-sys-scale));
  --md-sys-typescale-display-medium-size: calc(45px * var(--md-sys-scale));
  --md-sys-typescale-display-small-size: calc(36px * var(--md-sys-scale));
  --md-sys-typescale-headline-large-size: calc(32px * var(--md-sys-scale));
  --md-sys-typescale-headline-medium-size: calc(28px * var(--md-sys-scale));
  --md-sys-typescale-headline-small-size: calc(24px * var(--md-sys-scale));
  --md-sys-typescale-title-large-size: calc(22px * var(--md-sys-scale));
  --md-sys-typescale-title-medium-size: calc(16px * var(--md-sys-scale));
  --md-sys-typescale-title-small-size: calc(14px * var(--md-sys-scale));
  --md-sys-typescale-body-large-size: calc(16px * var(--md-sys-scale));
  --md-sys-typescale-body-medium-size: calc(14px * var(--md-sys-scale));
  --md-sys-typescale-body-small-size: calc(12px * var(--md-sys-scale));
  --md-sys-typescale-label-large-size: calc(14px * var(--md-sys-scale));
  --md-sys-typescale-label-medium-size: calc(12px * var(--md-sys-scale));
  --md-sys-typescale-label-small-size: calc(11px * var(--md-sys-scale));
  /* extension — not MD3 (cl.2b) */
  --md-sys-typescale-kicker-large-size: calc(14px * var(--md-sys-scale));
  --md-sys-typescale-kicker-medium-size: calc(12px * var(--md-sys-scale));
  --md-sys-typescale-kicker-small-size: calc(11px * var(--md-sys-scale));
  --md-sys-typescale-overline-large-size: calc(14px * var(--md-sys-scale));
  --md-sys-typescale-overline-medium-size: calc(12px * var(--md-sys-scale));
  --md-sys-typescale-overline-small-size: calc(11px * var(--md-sys-scale));
  --md-sys-typescale-lead-large-size: calc(22px * var(--md-sys-scale));
  --md-sys-typescale-lead-medium-size: calc(18px * var(--md-sys-scale));
  --md-sys-typescale-lead-small-size: calc(16px * var(--md-sys-scale));
  --md-sys-typescale-quote-large-size: calc(22px * var(--md-sys-scale));
  --md-sys-typescale-quote-medium-size: calc(18px * var(--md-sys-scale));
  --md-sys-typescale-quote-small-size: calc(16px * var(--md-sys-scale));

  /* --md-sys-space — the LAYOUT-SPACING ladder (ADR-0015 cl.4, geometry.md "--space-* is layout spacing,
     not control geometry"). The gap/padding/margin BETWEEN laid-out children (Row/Column/List/Grid gap,
     Card padding) — a DIFFERENT ledger from the control frame (the h/2 centring law). Two rules set it
     apart from the ramp above:
       • density rides it (rhythm family): each step is \`calc(<base px> * var(--md-sys-density))\`, so a subtree
         [density] re-multiplies it (declared on \`*\`, not :root — same pre-substitution reason as the gap).
       • [scale] does NOT touch it: the base px is a LITERAL (no var(--md-sys-scale)), because layout rhythm is
         not control-frame size — a [scale] theme resizes the controls, not the gutters between them.
     A 4px-grid t-shirt vocabulary; \`none\`=0 (the no-gap case). The flexProps \`gap\` enum (s2) is exactly
     these step names. Extensible (add 3xl… with the family) — repointing a value is seam-stable; a new
     step name widens the gap enum (a deliberate addition, not drift). */
  --md-sys-space-none: 0;
  --md-sys-space-xs: calc(4px * var(--md-sys-density));
  --md-sys-space-sm: calc(8px * var(--md-sys-density));
  --md-sys-space-md: calc(12px * var(--md-sys-density));
  --md-sys-space-lg: calc(16px * var(--md-sys-density));
  --md-sys-space-xl: calc(24px * var(--md-sys-density));
  --md-sys-space-2xl: calc(32px * var(--md-sys-density));

  /* --ui-bar-inline-inset — the fleet's ONE bar-content inline inset (GH #626, Kim-ruled 2026-08-09).
     Deliberately a cross-component \`--ui-*\` role, not a per-control one: it is the shared rhythm that
     lets separately-owned boxes on DIFFERENT sides of a bar boundary land on the same x. A bar itself
     is a padding-less RAIL (background + seam only — GH #543's \`ui-tabs\` tablist precedent, generalised
     to \`ui-super-shell\`'s \`[data-part='bar']\` here); its CONTENTS carry the inset, and they read it from
     this one token so a bar-hosted column and a canvas-hosted column stay aligned by construction
     instead of by two hand-matched literals. That is what GH #626 fixed: the docs site's app footer sat
     6px (\`module / 3\`) further in than the pager below it, because the bar owned padding the pager's
     region did not.
     The stop is \`xl\` (24px): the docs site's reading column already insets 24px each side
     (\`min(64rem, 100% - 3rem)\`, \`_page.css\`), and \`.app-context-header\` already spelled that same 24px
     as \`--md-sys-space-xl\` — this names the value the site had converged on rather than introducing a
     new one, so the pick is visually a no-op for the canvas column and a −6px correction for bar content.
     Rides [density] through the ramp; untouched by [scale] (layout rhythm, not control frame). */
  --ui-bar-inline-inset: var(--md-sys-space-xl);
}

/* extension — not MD3 (ADR-0150): the compact-window body register — the token layer's ONE
   viewport-responsive lever. Below 52.5rem (840px, M3's compact/medium window boundary — a documented
   LITERAL: custom properties are invalid in media-query conditions, so this value cannot be tokenized;
   a second use repeats it verbatim and cites ADR-0150) the body COLUMN drops 1px: 16/14/12 → 15/13/11.
   ONLY the three body -size legs move — every other role, all :root constants (unitless line-height
   compresses proportionally by design), and the ADR-0038 control ladder are untouched. Declared on \`*\`
   (NOT :root — the same pre-substitution law as the ramp above: a :root override would freeze
   --md-sys-scale at 1 and kill subtree [scale] below the line) and AFTER the base ramp — both blocks
   are specificity 0,0,0 and a media query adds none, so LATER DECLARATION is the only thing that makes
   this win. Do not move this block above the base \`*\` ramp. */
@media (width < 52.5rem) {
  * {
    --md-sys-typescale-body-large-size: calc(15px * var(--md-sys-scale));
    --md-sys-typescale-body-medium-size: calc(13px * var(--md-sys-scale));
    --md-sys-typescale-body-small-size: calc(11px * var(--md-sys-scale));
  }
}

/* [scale] — Kim's (scale × size) → §1-row LOOKUP selector (ADR-0038, supersedes ADR-0032's multiplier ladder
   for CONTROLS). Each tier re-tables --md-sys-{height,font,icon}-{sm,md,lg} to its chosen §1 row (height picks the
   row; font/icon derive from it — ONE consistent row per cell, the thing the multiplier broke). Descendants
   inherit the re-tabled tokens, so subtree [scale] works WITHOUT --md-sys-scale (the #25 --md-sys-compact proof). The
   tiers ALSO re-table --md-sys-compact-* (the WIDGET-BOX ramp, ADR-0041 — now CONSUMED by Indicator/Range). Two
   bands by reading distance — ui-* tight (UI
   density), content-* generous (reading density) — and content-* is the ui-* band SHIFTED UP ONE §1 row, so
   content-sm ≡ ui-md and content-md ≡ ui-lg (Kim's design: 6 names → 4 distinct registers; only content-lg
   exceeds the ui band). ui-md is the DEFAULT (= :root, byte-identical). Each tier STILL sets --md-sys-scale to its
   tier value — but ONLY --md-sys-typescale-*-size (DISPLAY, the ADR-0025/0033 ruled-linear fork) reads it now; --md-sys-scale
   has LEFT the control path (controls are the explicit literals above/here). */
[scale="ui-sm"] {
  --md-sys-scale: 0.875;
  --md-sys-height-sm: 20px;
  --md-sys-height-md: 24px;
  --md-sys-height-lg: 28px;
  --md-sys-font-sm: 12px;
  --md-sys-font-md: 13px;
  --md-sys-font-lg: 14px;
  --md-sys-icon-sm: 14px;
  --md-sys-icon-md: 16px;
  --md-sys-icon-lg: 18px;
  --md-sys-compact-sm: 12px;
  --md-sys-compact-md: 14px;
  --md-sys-compact-lg: 16px;
}
[scale="ui-md"] {
  --md-sys-scale: 1;
  --md-sys-height-sm: 24px;
  --md-sys-height-md: 28px;
  --md-sys-height-lg: 36px;
  --md-sys-font-sm: 13px;
  --md-sys-font-md: 14px;
  --md-sys-font-lg: 16px;
  --md-sys-icon-sm: 16px;
  --md-sys-icon-md: 18px;
  --md-sys-icon-lg: 20px;
  --md-sys-compact-sm: 14px;
  --md-sys-compact-md: 16px;
  --md-sys-compact-lg: 18px;
}
[scale="ui-lg"] {
  --md-sys-scale: 1.125;
  --md-sys-height-sm: 28px;
  --md-sys-height-md: 36px;
  --md-sys-height-lg: 48px;
  --md-sys-font-sm: 14px;
  --md-sys-font-md: 16px;
  --md-sys-font-lg: 18px;
  --md-sys-icon-sm: 18px;
  --md-sys-icon-md: 20px;
  --md-sys-icon-lg: 24px;
  --md-sys-compact-sm: 16px;
  --md-sys-compact-md: 18px;
  --md-sys-compact-lg: 20px;
}
[scale="content-sm"] {
  --md-sys-scale: 1.375;
  --md-sys-height-sm: 24px;
  --md-sys-height-md: 28px;
  --md-sys-height-lg: 36px;
  --md-sys-font-sm: 13px;
  --md-sys-font-md: 14px;
  --md-sys-font-lg: 16px;
  --md-sys-icon-sm: 16px;
  --md-sys-icon-md: 18px;
  --md-sys-icon-lg: 20px;
  --md-sys-compact-sm: 18px;
  --md-sys-compact-md: 20px;
  --md-sys-compact-lg: 22px;
}
[scale="content-md"] {
  --md-sys-scale: 1.5;
  --md-sys-height-sm: 28px;
  --md-sys-height-md: 36px;
  --md-sys-height-lg: 48px;
  --md-sys-font-sm: 14px;
  --md-sys-font-md: 16px;
  --md-sys-font-lg: 18px;
  --md-sys-icon-sm: 18px;
  --md-sys-icon-md: 20px;
  --md-sys-icon-lg: 24px;
  --md-sys-compact-sm: 20px;
  --md-sys-compact-md: 22px;
  --md-sys-compact-lg: 24px;
}
[scale="content-lg"] {
  --md-sys-scale: 1.75;
  --md-sys-height-sm: 36px;
  --md-sys-height-md: 48px;
  --md-sys-height-lg: 64px;
  --md-sys-font-sm: 16px;
  --md-sys-font-md: 18px;
  --md-sys-font-lg: 20px;
  --md-sys-icon-sm: 20px;
  --md-sys-icon-md: 24px;
  --md-sys-icon-lg: 28px;
  --md-sys-compact-sm: 22px;
  --md-sys-compact-md: 24px;
  --md-sys-compact-lg: 28px;
}

/* [density] — multiplies the RHYTHM only (the gap), never the frame (geometry.md). Repoints --md-sys-density,
   so the gap recomputes while height/font/inline-pad hold. */
[density="compact"] {
  --md-sys-density: 0.5;
}
[density="comfortable"] {
  --md-sys-density: 1;
}
[density="spacious"] {
  --md-sys-density: 1.5;
}
`,e).length===0)throw Error(`tokens.ts: parseDimensionRamp resolved 0 tiers for --${e}-* — dimensions.css did not match the expected shape`);var v=u(p);if(v.length===0)throw Error(`tokens.ts: parseTypescale resolved 0 rows — dimensions.css did not match the expected typescale shape`);var y=[...new Set(v.map(e=>e.role))],{content:b}=e({title:`Token reference`,intro:`${m.length} colour roles across ${h.length} families, the numbered tonal primitives, the five dimensional ladders, plus the ${y.length}-role type scale — parsed live from the foundation sheets and rendered on the shipped token-surface primitives, not hand-copied. If this page and the shipped tokens ever disagree, the page is stale and its derivation is the bug.`});b.append(t(`Every value below is read straight from @agent-ui/shared’s two foundation sheets: tokens.css (colour) and dimensions.css (geometry + spacing), rendered through ui-swatch/ui-ramp/ui-ladder (ADR-0118) — the SAME live resolution as before (each swatch carries its own color-scheme and reads the real custom property via the browser’s actual light-dark() resolution), now dogfooding the shipped primitives instead of bespoke display code. For the theming CONTRACT (how a page adopts these), see the theming guide; for the geometry LAW the dimensional ladders implement, see the sizing guide.`));function x(e,t){let n=document.createElement(`td`),r=document.createElement(`ui-swatch`);return r.setAttribute(`color`,e.varName),r.setAttribute(`label`,e.role),r.setAttribute(`scheme`,t),n.append(r),n}function S(e){let t=document.createElement(`tr`),n=document.createElement(`td`),r=document.createElement(`code`);return r.textContent=e.varName,n.append(r),t.append(n,x(e,`light`),x(e,`dark`)),t}b.append(n(2,`Colour roles`));for(let e of h){let t=m.filter(t=>t.family===e),r=document.createElement(`section`);r.append(n(3,e));let i=document.createElement(`table`);i.className=`token-table`;let a=document.createElement(`thead`),o=document.createElement(`tr`);for(let e of[`Token`,`Light`,`Dark`]){let t=document.createElement(`th`);t.textContent=e,o.append(t)}a.append(o);let s=document.createElement(`tbody`);for(let e of t)s.append(S(e));i.append(a,s),r.append(i),b.append(r)}b.append(n(2,`Tonal primitives`)),b.append(t(`The numbered base steps behind each family’s semantic roles — a genuinely ORDERED progression (unlike the role set above), the honest home for the ramp idiom. Derived live via the additive parseColorPrimitives helper — the same sheet, a different filter.`));for(let e of h){let t=g[e]??[];if(t.length===0)continue;let r=document.createElement(`section`);r.append(n(3,e));let i=document.createElement(`ui-ramp`);i.setAttribute(`steps`,JSON.stringify(t.map(e=>({label:e.step,value:e.varName})))),i.setAttribute(`label`,`${e} tonal range`),r.append(i),b.append(r)}b.append(n(2,`Dimensional ladders`)),b.append(t(`The default (ui-md-equivalent) tier of each ladder — the row every control resolves from before a [scale] ancestor re-tables it. See the sizing guide for the full [scale] × [size] stepping demo.`));for(let{prefix:e,label:t,note:r}of _){let i=s(p,e),a=document.createElement(`section`);a.append(n(3,t));let o=document.createElement(`p`);o.textContent=r,a.append(o);let c=document.createElement(`ui-ladder`);c.setAttribute(`tiers`,JSON.stringify(i.map(e=>({label:e.tier,value:e.value})))),c.setAttribute(`label`,t),a.append(c),b.append(a)}var C=n(2,`Type scale`);C.id=`type-scale`,b.append(C);{let e=document.createElement(`p`);e.className=`page-lead`,e.append(document.createTextNode(`The ${y.length}-role × 3-size fleet type scale (--md-sys-typescale-{role}-{size}-*, ADR-0078): the five M3-verbatim roles plus the editorial extensions, each cell four properties — size (the one leg that rides [scale]) · weight · line-height · tracking. Rendered live below at each cell’s own resolved values. Note: kicker and overline render uppercase in consumers (a text.css treatment, not a typescale property). Controls never read these directly — ui-text does, via its own --ui-text-* repoint. How a subtree rescales the -size leg is the `),(()=>{let e=document.createElement(`a`);return e.href=`./theming.html`,e.textContent=`theming guide`,e})(),document.createTextNode(`’s story; where the type scale sits among the five size systems is the `),(()=>{let e=document.createElement(`a`);return e.href=`./sizing.html`,e.textContent=`sizing guide`,e})(),document.createTextNode(`’s.`)),b.append(e)}for(let e of y){let t=document.createElement(`section`);t.append(n(3,e));for(let n of v.filter(t=>t.role===e)){let e=`--md-sys-typescale-${n.role}-${n.size}`,r=document.createElement(`div`);r.className=`typescale-row`;let i=document.createElement(`code`);i.className=`typescale-meta`,i.textContent=`${e}-*  ·  ${n.sizeValue}  ·  ${n.weight}  ·  ${n.lineHeight}  ·  ${n.tracking}`;let a=document.createElement(`div`);a.className=`typescale-specimen`,a.style.fontSize=`var(${e}-size)`,a.style.fontWeight=`var(${e}-weight)`,a.style.lineHeight=`var(${e}-line-height)`,a.style.letterSpacing=`var(${e}-tracking)`,a.textContent=`${n.role} ${n.size} — Sphinx of black quartz, judge my vow`,r.append(i,a),t.append(r)}b.append(t)}